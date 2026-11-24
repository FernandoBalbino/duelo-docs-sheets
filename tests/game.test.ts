import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHALLENGES, CHALLENGE_BY_ID } from '../shared/challenges.ts';
import { DRAW_MS, EARLY_CLOSE_MS, VOTE_GRACE_MS } from '../shared/rules.ts';
import { display, parseCells, sheet, toNumber } from '../shared/sheet.ts';
import { Game, GameError, pairKey, type Clock, type Room } from '../server/game.ts';

function fakeClock() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    now: () => now,
    setTimeout: (fn, ms) => (timers.set(++seq, { at: now + ms, fn }), seq),
    clearTimeout: (h) => void timers.delete(h as number),
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((x, y) => x[1].at - y[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = end;
  };
  return { clock, advance };
}

function setup(names: string[]) {
  const { clock, advance } = fakeClock();
  const game = new Game({ clock });
  const room = game.createRoom();
  const ids = names.map((n) => game.join(room.code, n).player.id);
  return { game, room, ids, advance };
}

// Joga um duelo inteiro: sorteio → desafio → votação (todos votam no lado pedido).
function playDuel(game: Game, room: Room, advance: (ms: number) => void, side: 'a' | 'b' | 'tie' = 'a') {
  game.draw(room);
  advance(DRAW_MS);
  assert.equal(room.phase, 'duel');
  game.endDuel(room);
  const d = room.duel!;
  const voters = [...room.players.keys()].filter((id) => id !== d.a && id !== d.b);
  voters.forEach((id, i) => game.vote(room, id, side === 'tie' ? (i % 2 ? 'b' : 'a') : side));
  advance(EARLY_CLOSE_MS);
  assert.equal(room.phase, 'result');
  return d;
}

test('46 desafios com ids únicos: 36 básicos (18 + 18) e 10 intermediários (5 + 5)', () => {
  assert.equal(CHALLENGE_BY_ID.size, 46);
  const count = (kind: string, level: string) => CHALLENGES.filter((c) => c.kind === kind && c.level === level).length;
  assert.deepEqual([count('docs', 'basico'), count('sheets', 'basico'), count('docs', 'intermediario'), count('sheets', 'intermediario')], [18, 18, 5, 5]);
});

test('a mesma dupla nunca repete desafio (36 duelos seguidos)', () => {
  const { game, room, advance } = setup(['Ana', 'Beto']);
  game.setSettings(room, { target: 10 });
  const seen = new Set<string>();
  for (let i = 0; i < 36; i++) {
    if (room.champions.length) game.restart(room); // recomeçar não apaga o histórico da dupla
    const d = playDuel(game, room, advance);
    assert.ok(!seen.has(d.challengeId), `repetiu ${d.challengeId} no duelo ${i + 1}`);
    seen.add(d.challengeId);
  }
});

test('modo alternar troca Docs e Sheets; sorteio prioriza quem duelou menos', () => {
  const { game, room, ids, advance } = setup(['Ana', 'Beto', 'Caio', 'Duda']);
  const d1 = playDuel(game, room, advance);
  const d2 = playDuel(game, room, advance);
  assert.equal(d1.kind, 'docs');
  assert.equal(d2.kind, 'sheets');
  assert.deepEqual(new Set([d1.a, d1.b, d2.a, d2.b]), new Set(ids)); // os 4 duelaram uma vez
});

test('votos: duelista não vota, voto duplo bloqueado, vencedor ganha ponto', () => {
  const { game, room, ids, advance } = setup(['Ana', 'Beto', 'Caio', 'Duda', 'Eva']);
  game.draw(room);
  advance(DRAW_MS);
  game.endDuel(room);
  const d = room.duel!;
  const voters = ids.filter((id) => id !== d.a && id !== d.b);
  assert.throws(() => game.vote(room, d.a, 'a'), GameError);
  game.vote(room, voters[0], 'b');
  assert.throws(() => game.vote(room, voters[0], 'a'), /já votou/);
  game.vote(room, voters[1], 'b');
  assert.equal(room.phase, 'vote');
  game.vote(room, voters[2], 'a');
  advance(EARLY_CLOSE_MS);
  assert.equal(d.winner, 'b');
  assert.equal(room.players.get(d.b)!.points, 1);
  assert.equal(room.players.get(d.a)!.points, 0);
});

test('empate leva os dois; sem votos ninguém pontua; campeão na meta', () => {
  const { game, room, advance } = setup(['Ana', 'Beto', 'Caio', 'Duda']);
  const tie = playDuel(game, room, advance, 'tie');
  assert.equal(tie.winner, 'tie');
  assert.equal(room.players.get(tie.a)!.points + room.players.get(tie.b)!.points, 2);

  game.draw(room);
  advance(DRAW_MS);
  game.endDuel(room);
  advance(room.settings.voteSeconds * 1000);
  assert.equal(room.duel!.winner, 'none');

  game.setSettings(room, { target: 1 });
  assert.equal(room.champions.length, 2);
  assert.throws(() => game.draw(room), /campeão/);
  game.setSettings(room, { target: 3 }); // subir a meta deixa continuar
  assert.equal(room.champions.length, 0);
});

test('relógio: sorteio vira duelo, +30 s, fim do tempo abre votação; conteúdo só vale no duelo', () => {
  const { game, room, advance } = setup(['Ana', 'Beto', 'Caio']);
  game.draw(room);
  const d = room.duel!;
  assert.equal(game.content(room, d.a, d.round, '<p>cedo</p>'), false);
  advance(DRAW_MS);
  assert.equal(game.content(room, d.a, d.round, '<p>oi</p>'), true);
  assert.equal(game.content(room, d.a, d.round + 1, '<p>outra rodada</p>'), false);
  game.addTime(room);
  advance(room.settings.duelSeconds * 1000);
  assert.equal(room.phase, 'duel');
  advance(30_000);
  assert.equal(room.phase, 'vote');
  assert.equal(game.content(room, d.b, d.round, '<p>final</p>'), true); // ainda na tolerância
  advance(VOTE_GRACE_MS + 1);
  assert.equal(game.content(room, d.b, d.round, '<p>tarde</p>'), false);
});

test('sortear de novo troca a dupla e não gasta o desafio', () => {
  const { game, room, advance } = setup(['Ana', 'Beto', 'Caio', 'Duda']);
  game.draw(room);
  const first = pairKey(room.duel!.a, room.duel!.b);
  advance(DRAW_MS);
  game.redraw(room);
  assert.notEqual(pairKey(room.duel!.a, room.duel!.b), first);
  assert.equal(room.usedByPair.size, 0);
  assert.throws(() => game.kick(room, room.duel!.a), /duelando/);
});

test('configurações fora do limite são recusadas', () => {
  const { game, room } = setup(['Ana']);
  assert.throws(() => game.setSettings(room, { duelSeconds: 5 }), GameError);
  assert.throws(() => game.setSettings(room, { mode: 'x' as never }), GameError);
  game.setSettings(room, { duelSeconds: 120, mode: 'sheets' });
  assert.equal(room.settings.duelSeconds, 120);
});

test('planilha: números em pt-BR, R$ e células vindas da rede filtradas', () => {
  assert.equal(toNumber('1.234,5'), 1234.5);
  assert.equal(toNumber('49,9'), 49.9);
  assert.equal(toNumber('10/03'), null);
  assert.equal(display({ v: '49,9', fmt: 'brl' }).text, 'R$ 49,90');
  assert.equal(display({ v: '7' }).align, 'r');
  assert.deepEqual(sheet([['A', 'B']], { 'A1:B1': { b: 1 } }), { A1: { v: 'A', b: 1 }, B1: { v: 'B', b: 1 } });
  const evil = JSON.stringify({ A1: { v: 'oi', bg: 'url(x)', fc: '#ff0000', x: 1 }, 'ZZ999': { v: 'fora' }, B2: { fs: 999 } });
  assert.deepEqual(parseCells(evil), { A1: { v: 'oi', fc: '#ff0000' } });
});

test('contra todos: prova com tempo total, salvamento, quadros, replay e ranking', () => {
  const { clock, advance } = fakeClock();
  const sent: string[] = [];
  const game = new Game({ clock, onFrames: (_r, id) => sent.push(id) });
  const room = game.createRoom();
  const [ana, beto, caio] = ['Ana', 'Beto', 'Caio'].map((n) => game.join(room.code, n).player.id);
  game.setSettings(room, { game: 'all', allMinutes: 50, pick: 'd19' });
  assert.throws(() => game.setSettings(room, { pick: 'x' }), GameError);
  game.startAll(room);
  const t = room.task!;
  assert.equal(room.phase, 'work');
  assert.equal(t.challengeId, 'd19');
  assert.equal(t.endsAt - t.startsAt, 50 * 60_000);
  assert.equal(game.checkpoint(room, ana, t.round, '<p>meio</p>'), true);
  assert.equal(game.checkpoint(room, beto, t.round + 1, '<p>outra</p>'), false);
  game.saveFrames(room, beto, t.round, ['<p>a</p>', '<p>ab</p>']);
  assert.throws(() => game.saveFrames(room, caio, t.round, Array(50).fill('x')), /grande/);
  game.addTime(room);
  advance(55 * 60_000 + 4000);
  assert.equal(room.phase, 'reveal');
  assert.deepEqual(room.submissions.get(ana), ['<p>meio</p>']); // só tinha o salvamento: vira um quadro
  assert.deepEqual(sent, [beto, ana]);
  game.saveFrames(room, caio, t.round, ['<p>atrasado</p>']); // chegou depois do fim, ainda na revelação
  game.finishAll(room, { [ana]: 40, [beto]: 87, [caio]: 101, intruso: 50 });
  assert.equal(room.phase, 'ranking');
  assert.deepEqual(room.scores, { [ana]: 40, [beto]: 87 });
  assert.throws(() => game.saveFrames(room, caio, t.round, ['<p>tarde</p>']), /terminou/);
  game.setSettings(room, { pick: 'intermediario', mode: 'docs' });
  game.startAll(room);
  assert.notEqual(room.task!.challengeId, 'd19');
  assert.equal(CHALLENGE_BY_ID.get(room.task!.challengeId)!.level, 'intermediario');
  game.endWork(room);
  game.restart(room);
  assert.equal(room.task, null);
});
