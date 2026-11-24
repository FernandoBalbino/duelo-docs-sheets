// Regras do duelo, sem rede. O relógio e o sorteio são injetáveis para os testes.
import { randomBytes } from 'node:crypto';
import { challengesOf, type Challenge } from '../shared/challenges.ts';
import type { Kind, Phase, PublicRoom, Side, Winner } from '../shared/protocol.ts';
import {
  AVATARS, DEFAULT_SETTINGS, DRAW_MS, EARLY_CLOSE_MS, LIMITS, MAX_CONTENT, MAX_NAME, MAX_PLAYERS, MODES, VOTE_GRACE_MS,
  type Settings,
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

  constructor(opts: { clock?: Clock; rnd?: () => number; onChange?: (room: Room) => void } = {}) {
    this.clock = opts.clock ?? realClock;
    this.rnd = opts.rnd ?? Math.random;
    this.onChange = opts.onChange ?? (() => {});
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
      champions: [], usedByPair: new Map(), usedByPlayer: new Map(), lastPair: '', kindTurn: 0, timer: null,
      touched: this.clock.now(),
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
    if (room.phase !== 'lobby' && room.phase !== 'result') throw new GameError('Mude as configurações entre um duelo e outro.');
    const next = { ...room.settings };
    for (const key of ['duelSeconds', 'voteSeconds', 'target'] as const) {
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
    Object.assign(room, { phase: 'lobby', duel: null, champions: [], lastPair: '', kindTurn: 0 });
    room.contents.clear();
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
      serverNow: this.clock.now(),
    };
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
