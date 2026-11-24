// Regras do duelo, sem rede. O relógio e o sorteio são injetáveis para os testes.
import { randomBytes } from 'node:crypto';
import { CHALLENGES, CHALLENGE_BY_ID, challengesOf, type Challenge } from '../shared/challenges.ts';
import type { Kind, Phase, PublicRoom, PublicTask, Side, Winner } from '../shared/protocol.ts';
import {
  ALL_ADD_MS, ALL_INTRO_MS, AVATARS, DEFAULT_SETTINGS, DRAW_MS, EARLY_CLOSE_MS, LIMITS, MAX_CONTENT, MAX_FRAMES, MAX_FRAMES_CHARS,
  MAX_NAME, MAX_PLAYERS, MODES, VOTE_GRACE_MS, type Settings,
} from '../shared/rules.ts';

export class GameError extends Error {}

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface Player {
  id: string;
  token: string;
  name: string;
  avatar: number;
  points: number;
  duels: number;
  online: boolean;
}

interface Duel {
  round: number;
  a: string;
  b: string;
  challengeId: string;
  kind: Kind;
  startsAt: number;
  endsAt: number;
  voteEndsAt: number;
  votes: Map<string, Side>;
  winner: Winner | null;
}

export interface Room {
  code: string;
  teacherToken: string;
  phase: Phase;
  settings: Settings;
  players: Map<string, Player>;
  avatarSeq: number;
  round: number;
  duel: Duel | null;
  contents: Map<string, string>; // último documento de cada duelista (a TV recupera ao recarregar)
  champions: string[];
  usedByPair: Map<string, Set<string>>; // desafios que a dupla já fez: nunca repetem
  usedByPlayer: Map<string, Set<string>>;
  lastPair: string;
  kindTurn: number;
  task: PublicTask | null; // contra todos
  submissions: Map<string, string[]>; // quadros do progresso de cada aluno (replay na TV)
  scores: Record<string, number> | null;
  usedAll: Set<string>;
  timer: unknown;
  touched: number;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL_MS = 6 * 3600_000;
const ADD_TIME_MS = 30_000;

export const cleanName = (raw: unknown) =>
  String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim();
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const pairKey = (x: string, y: string) => [x, y].sort().join('+');

export class Game {
  rooms = new Map<string, Room>();
  private clock: Clock;
  private rnd: () => number;
  private onChange: (room: Room) => void;
  private onFrames: (room: Room, id: string, frames: string[]) => void;

  constructor(opts: {
    clock?: Clock; rnd?: () => number; onChange?: (room: Room) => void; onFrames?: (room: Room, id: string, frames: string[]) => void;
  } = {}) {
    this.clock = opts.clock ?? realClock;
    this.rnd = opts.rnd ?? Math.random;
    this.onChange = opts.onChange ?? (() => {});
    this.onFrames = opts.onFrames ?? (() => {});
  }

  touch(room: Room) {
    room.touched = this.clock.now();
  }

  private changed(room: Room) {
    this.touch(room);
    this.onChange(room);
  }

  private schedule(room: Room, ms: number, fn: () => void) {
    this.clock.clearTimeout(room.timer);
    room.timer = this.clock.setTimeout(fn, Math.max(0, ms));
  }

  private pick<T>(list: T[]): T {
    return list[Math.floor(this.rnd() * list.length)];
  }

  createRoom(): Room {
    let code = '';
    do code = Array.from({ length: 4 }, () => this.pick([...CODE_CHARS])).join('');
    while (this.rooms.has(code));
    const room: Room = {
      code, teacherToken: randomBytes(16).toString('hex'), phase: 'lobby', settings: { ...DEFAULT_SETTINGS },
      players: new Map(), avatarSeq: Math.floor(this.rnd() * AVATARS.length), round: 0, duel: null, contents: new Map(),
      champions: [], usedByPair: new Map(), usedByPlayer: new Map(), lastPair: '', kindTurn: 0, task: null, submissions: new Map(),
      scores: null, usedAll: new Set(), timer: null, touched: this.clock.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  room(code: unknown): Room {
    const room = typeof code === 'string' ? this.rooms.get(code.trim().toUpperCase()) : undefined;
    if (!room) throw new GameError('Sala não encontrada. Confira o código na TV.');
    return room;
  }

  teacher(code: unknown, token: unknown): Room {
    const room = this.room(code);
    if (room.teacherToken !== token) throw new GameError('Sessão do professor inválida.');
    return room;
  }

  join(code: unknown, rawName: unknown) {
    const room = this.room(code);
    const base = cleanName(rawName);
    if (base.length < 2) throw new GameError('Digite seu nome (pelo menos 2 letras).');
    if (room.players.size >= MAX_PLAYERS) throw new GameError(`A sala está cheia (${MAX_PLAYERS} alunos).`);
    const taken = new Set([...room.players.values()].map((p) => fold(p.name)));
    let name = base;
    for (let n = 2; taken.has(fold(name)); n++) name = `${base.slice(0, MAX_NAME - 3)} ${n}`;
    const player: Player = {
      id: randomBytes(5).toString('hex'), token: randomBytes(16).toString('hex'), name,
      avatar: room.avatarSeq++ % AVATARS.length, points: 0, duels: 0, online: true,
    };
    room.players.set(player.id, player);
    this.changed(room);
    return { room, player };
  }

  resume(code: unknown, token: unknown) {
    const room = this.room(code);
    const player = [...room.players.values()].find((p) => p.token === token);
    if (!player) throw new GameError('Você saiu desta sala. Entre de novo com o código.');
    this.touch(room);
    return { room, player };
  }

  setOnline(room: Room, playerId: string, online: boolean) {
    const p = room.players.get(playerId);
    if (!p || p.online === online) return;
    p.online = online;
    this.changed(room);
    this.closeIfAllVoted(room);
  }

  setSettings(room: Room, patch: Partial<Settings>) {
    if (!['lobby', 'result', 'ranking'].includes(room.phase)) throw new GameError('Mude as configurações entre uma rodada e outra.');
    const next = { ...room.settings };
    for (const key of ['duelSeconds', 'voteSeconds', 'target', 'allMinutes'] as const) {
      if (patch?.[key] == null) continue;
      const v = Number(patch[key]);
      const [min, max] = LIMITS[key];
      if (!Number.isInteger(v) || v < min || v > max) throw new GameError('Configuração fora do limite.');
      next[key] = v;
    }
    if (patch?.mode != null) {
      if (!MODES.some((m) => m.id === patch.mode)) throw new GameError('Tipo de desafio inválido.');
      next.mode = patch.mode;
    }
    if (patch?.game != null) {
      if (patch.game !== 'duel' && patch.game !== 'all') throw new GameError('Modo de jogo inválido.');
      next.game = patch.game;
    }
    if (patch?.pick != null) {
      if (patch.pick !== 'basico' && patch.pick !== 'intermediario' && !CHALLENGE_BY_ID.has(patch.pick)) throw new GameError('Desafio inválido.');
      next.pick = patch.pick;
    }
    room.settings = next;
    this.updateChampions(room); // subir a meta depois de um campeão deixa a partida continuar
    this.changed(room);
  }

  private updateChampions(room: Room) {
    room.champions = [...room.players.values()]
      .filter((p) => p.points > 0 && p.points >= room.settings.target)
      .sort((x, y) => y.points - x.points)
      .map((p) => p.id);
  }

  // Quem duelou menos vai primeiro; entre empatados, sorteio. Evita repetir a dupla anterior quando dá.
  private pickPair(room: Room, avoid: string): [Player, Player] {
    const online = [...room.players.values()].filter((p) => p.online);
    if (online.length < 2) throw new GameError('Precisa de pelo menos 2 alunos conectados para sortear.');
    for (let i = online.length - 1; i > 0; i--) {
      const j = Math.floor(this.rnd() * (i + 1));
      [online[i], online[j]] = [online[j], online[i]];
    }
    online.sort((x, y) => x.duels - y.duels);
    for (let i = 0; i < online.length; i++)
      for (let j = i + 1; j < online.length; j++)
        if (pairKey(online[i].id, online[j].id) !== avoid) return [online[i], online[j]];
    return [online[0], online[1]];
  }

  private pickChallenge(room: Room, kind: Kind, a: Player, b: Player): Challenge {
    const byPair = room.usedByPair.get(pairKey(a.id, b.id)) ?? new Set<string>();
    const byA = room.usedByPlayer.get(a.id) ?? new Set<string>();
    const byB = room.usedByPlayer.get(b.id) ?? new Set<string>();
    const other: Kind = kind === 'docs' ? 'sheets' : 'docs';
    const pools = [
      challengesOf(kind).filter((c) => !byPair.has(c.id) && !byA.has(c.id) && !byB.has(c.id)),
      challengesOf(kind).filter((c) => !byPair.has(c.id)),
      challengesOf(other).filter((c) => !byPair.has(c.id)),
      challengesOf(kind),
    ];
    return this.pick(pools.find((p) => p.length)!);
  }

  private kindFor(room: Room): Kind {
    const { mode } = room.settings;
    if (mode === 'docs' || mode === 'sheets') return mode;
    if (mode === 'aleatorio') return this.rnd() < 0.5 ? 'docs' : 'sheets';
    return room.kindTurn % 2 === 0 ? 'docs' : 'sheets';
  }

  draw(room: Room) {
    if (room.phase !== 'lobby' && room.phase !== 'result') throw new GameError('Termine o duelo atual antes de sortear outro.');
    if (room.champions.length) throw new GameError('Já temos campeão! Comece uma nova partida.');
    this.newDuel(room, room.lastPair);
  }

  // Alguém faltou ou travou: sorteia outra dupla (sem gastar o desafio nem contar duelo).
  redraw(room: Room) {
    if (room.phase !== 'draw' && room.phase !== 'duel') throw new GameError('Só dá para sortear de novo durante o duelo.');
    this.newDuel(room, room.lastPair);
  }

  private newDuel(room: Room, avoid: string) {
    const [a, b] = this.pickPair(room, avoid);
    const ch = this.pickChallenge(room, this.kindFor(room), a, b);
    const now = this.clock.now();
    room.round++;
    room.duel = {
      round: room.round, a: a.id, b: b.id, challengeId: ch.id, kind: ch.kind, startsAt: now + DRAW_MS,
      endsAt: now + DRAW_MS + room.settings.duelSeconds * 1000, voteEndsAt: 0, votes: new Map(), winner: null,
    };
    room.contents.clear();
    room.lastPair = pairKey(a.id, b.id);
    room.phase = 'draw';
    this.schedule(room, DRAW_MS, () => {
      room.phase = 'duel';
      this.schedule(room, room.duel!.endsAt - this.clock.now(), () => this.startVote(room));
      this.changed(room);
    });
    this.changed(room);
  }

  addTime(room: Room) {
    if (room.phase === 'work') {
      room.task!.endsAt += ALL_ADD_MS;
      this.schedule(room, room.task!.endsAt - this.clock.now(), () => this.startReveal(room));
      return this.changed(room);
    }
    const d = room.duel;
    if (!d || (room.phase !== 'draw' && room.phase !== 'duel')) throw new GameError('Não há duelo em andamento.');
    d.endsAt += ADD_TIME_MS;
    if (room.phase === 'duel') this.schedule(room, d.endsAt - this.clock.now(), () => this.startVote(room));
    this.changed(room);
  }

  endDuel(room: Room) {
    if (room.phase !== 'duel') throw new GameError('O duelo ainda não começou.');
    this.startVote(room);
  }

  private startVote(room: Room) {
    const d = room.duel!;
    const now = this.clock.now();
    d.endsAt = Math.min(d.endsAt, now);
    d.voteEndsAt = now + room.settings.voteSeconds * 1000;
    room.phase = 'vote';
    const key = pairKey(d.a, d.b);
    for (const [map, k] of [[room.usedByPair, key], [room.usedByPlayer, d.a], [room.usedByPlayer, d.b]] as const) {
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(d.challengeId);
    }
    for (const id of [d.a, d.b]) {
      const p = room.players.get(id);
      if (p) p.duels++;
    }
    room.kindTurn++;
    this.schedule(room, d.voteEndsAt - now, () => this.finishVote(room));
    this.changed(room);
    this.closeIfAllVoted(room);
  }

  private pendingVoters(room: Room) {
    const d = room.duel!;
    return [...room.players.values()].filter((p) => p.online && p.id !== d.a && p.id !== d.b && !d.votes.has(p.id)).length;
  }

  private closeIfAllVoted(room: Room) {
    if (room.phase === 'vote' && this.pendingVoters(room) === 0) this.schedule(room, EARLY_CLOSE_MS, () => this.finishVote(room));
  }

  tally(room: Room) {
    const out = { a: 0, b: 0 };
    for (const side of room.duel?.votes.values() ?? []) out[side]++;
    return out;
  }

  vote(room: Room, playerId: string, side: unknown) {
    const d = room.duel;
    if (room.phase !== 'vote' || !d) throw new GameError('A votação não está aberta.');
    if (!room.players.has(playerId)) throw new GameError('Você não está nesta sala.');
    if (playerId === d.a || playerId === d.b) throw new GameError('Quem duelou não vota.');
    if (side !== 'a' && side !== 'b') throw new GameError('Voto inválido.');
    if (d.votes.has(playerId)) throw new GameError('Você já votou.');
    d.votes.set(playerId, side);
    this.touch(room);
    this.closeIfAllVoted(room);
    return this.tally(room);
  }

  endVote(room: Room) {
    if (room.phase !== 'vote') throw new GameError('A votação não está aberta.');
    this.finishVote(room);
  }

  private finishVote(room: Room) {
    const d = room.duel!;
    this.clock.clearTimeout(room.timer);
    const { a, b } = this.tally(room);
    d.winner = a + b === 0 ? 'none' : a > b ? 'a' : b > a ? 'b' : 'tie';
    // Empate com votos: os dois avançam uma casa.
    const gain = d.winner === 'a' ? [d.a] : d.winner === 'b' ? [d.b] : d.winner === 'tie' ? [d.a, d.b] : [];
    for (const id of gain) {
      const p = room.players.get(id);
      if (p) p.points++;
    }
    this.updateChampions(room);
    room.phase = 'result';
    this.changed(room);
  }

  restart(room: Room) {
    this.clock.clearTimeout(room.timer);
    for (const p of room.players.values()) Object.assign(p, { points: 0, duels: 0 });
    Object.assign(room, { phase: 'lobby', duel: null, champions: [], lastPair: '', kindTurn: 0, task: null, scores: null });
    room.contents.clear();
    room.submissions.clear();
    this.changed(room);
  }

  kick(room: Room, playerId: unknown): Player {
    const p = typeof playerId === 'string' ? room.players.get(playerId) : undefined;
    if (!p) throw new GameError('Aluno não encontrado.');
    const d = room.duel;
    if (d && ['draw', 'duel', 'vote'].includes(room.phase) && (p.id === d.a || p.id === d.b))
      throw new GameError('Este aluno está duelando agora. Use "Sortear de novo" antes.');
    room.players.delete(p.id);
    this.updateChampions(room);
    this.changed(room);
    this.closeIfAllVoted(room);
    return p;
  }

  // Documento do duelista: guardado só enquanto vale (duelo e alguns segundos depois do fim).
  content(room: Room, playerId: string, round: unknown, data: unknown): boolean {
    const d = room.duel;
    if (!d || d.round !== round || (playerId !== d.a && playerId !== d.b)) return false;
    if (typeof data !== 'string' || data.length > MAX_CONTENT) return false;
    const now = this.clock.now();
    if (room.phase !== 'duel' && !(room.phase === 'vote' && now <= d.endsAt + VOTE_GRACE_MS)) return false;
    room.contents.set(playerId, data);
    this.touch(room);
    return true;
  }

  view(room: Room): PublicRoom {
    const d = room.duel;
    return {
      code: room.code,
      phase: room.phase,
      settings: room.settings,
      players: [...room.players.values()].map(({ id, name, avatar, points, duels, online }) => ({ id, name, avatar, points, duels, online })),
      duel: d && {
        round: d.round, a: d.a, b: d.b, challengeId: d.challengeId, kind: d.kind, startsAt: d.startsAt, endsAt: d.endsAt,
        voteEndsAt: d.voteEndsAt, votes: this.tally(room), winner: d.winner,
        voters: [...room.players.values()].filter((p) => p.id !== d.a && p.id !== d.b && (p.online || d.votes.has(p.id))).length,
      },
      champions: room.champions,
      task: room.task,
      scores: room.scores,
      serverNow: this.clock.now(),
    };
  }

  // ---------- Contra todos: todos fazem o mesmo desafio; a TV calcula a % de cada um no fim.

  startAll(room: Room) {
    if (room.phase !== 'lobby' && room.phase !== 'ranking') throw new GameError('Termine a rodada atual antes de começar outra.');
    if (![...room.players.values()].some((p) => p.online)) throw new GameError('Espere pelo menos um aluno entrar.');
    const ch = CHALLENGE_BY_ID.get(room.settings.pick) ?? this.pickForAll(room);
    const now = this.clock.now();
    room.round++;
    const startsAt = now + ALL_INTRO_MS;
    room.task = { round: room.round, challengeId: ch.id, kind: ch.kind, startsAt, endsAt: startsAt + room.settings.allMinutes * 60_000 };
    room.submissions.clear();
    room.contents.clear();
    room.scores = null;
    room.phase = 'work';
    this.schedule(room, room.task.endsAt - now, () => this.startReveal(room));
    this.changed(room);
  }

  private pickForAll(room: Room): Challenge {
    const kind = this.kindFor(room);
    const pool = CHALLENGES.filter((c) => c.kind === kind && c.level === room.settings.pick);
    const fresh = pool.filter((c) => !room.usedAll.has(c.id));
    return this.pick(fresh.length ? fresh : pool);
  }

  endWork(room: Room) {
    if (room.phase !== 'work') throw new GameError('A prova não está em andamento.');
    this.startReveal(room);
  }

  // Fim do tempo: quem só tem o salvamento do minuto entra no replay com um quadro só.
  private startReveal(room: Room) {
    const t = room.task!;
    this.clock.clearTimeout(room.timer);
    t.endsAt = Math.min(t.endsAt, this.clock.now());
    room.phase = 'reveal';
    room.usedAll.add(t.challengeId);
    room.kindTurn++;
    for (const [id, data] of room.contents) {
      if (room.submissions.has(id)) continue;
      room.submissions.set(id, [data]);
      this.onFrames(room, id, [data]);
    }
    this.changed(room);
  }

  // Salvamento de segurança (uma vez por minuto): fica no servidor, a TV só fica sabendo que salvou.
  checkpoint(room: Room, playerId: string, round: unknown, data: unknown): boolean {
    if (room.phase !== 'work' || room.task?.round !== round || !room.players.has(playerId)) return false;
    if (typeof data !== 'string' || data.length > MAX_CONTENT) return false;
    room.contents.set(playerId, data);
    this.touch(room);
    return true;
  }

  saveFrames(room: Room, playerId: string, round: unknown, frames: unknown) {
    const t = room.task;
    if (!t || t.round !== round || (room.phase !== 'work' && room.phase !== 'reveal')) throw new GameError('Esta rodada já terminou.');
    if (!room.players.has(playerId)) throw new GameError('Você não está nesta sala.');
    const ok = Array.isArray(frames) && frames.length > 0 && frames.length <= MAX_FRAMES + 1
      && frames.every((f) => typeof f === 'string' && f.length <= MAX_CONTENT)
      && (frames as string[]).reduce((n, f) => n + f.length, 0) <= MAX_FRAMES_CHARS;
    if (!ok) throw new GameError('Trabalho grande demais para enviar.');
    room.submissions.set(playerId, frames as string[]);
    this.touch(room);
    this.onFrames(room, playerId, frames as string[]);
  }

  // A TV terminou o replay e manda a % de cada aluno: vira o ranking para todos.
  finishAll(room: Room, scores: unknown) {
    if (room.phase !== 'reveal') throw new GameError('Os resultados ainda não terminaram.');
    const out: Record<string, number> = {};
    for (const [id, v] of Object.entries(scores && typeof scores === 'object' ? scores : {}))
      if (room.players.has(id) && Number.isInteger(v) && v >= 0 && v <= 100) out[id] = v;
    room.scores = out;
    room.phase = 'ranking';
    this.changed(room);
  }

  cleanup() {
    const now = this.clock.now();
    for (const [code, room] of this.rooms) {
      if (now - room.touched < ROOM_TTL_MS) continue;
      this.clock.clearTimeout(room.timer);
      this.rooms.delete(code);
    }
  }
}
