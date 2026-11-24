// Alunos-robô para testar uma partida de verdade com poucas pessoas (duelo ou contra todos).
// Uso: node scripts/bots.ts CODIGO [quantos=2]   (SERVER_URL=http://localhost:3000 e ORIGIN=http://localhost:5174 por padrão)
// Duelo: sorteado vai "digitando" o modelo; fora do duelo, vota. Contra todos: faz o desafio e entrega os quadros no fim.
import { io, type Socket } from 'socket.io-client';
import type { ClientEvents, PublicRoom, ServerEvents } from '../shared/protocol.ts';
import { thinFrames } from '../shared/rules.ts';
import { steps } from './bot-steps.ts';

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5174';
const code = (process.argv[2] ?? '').toUpperCase();
const count = Number(process.argv[3] ?? 2);
if (!code) throw new Error('Informe o código da sala: node scripts/bots.ts ABCD');
const NAMES = ['Robô Caio', 'Robô Duda', 'Robô Enzo', 'Robô Gabi', 'Robô Lia'];

for (let k = 0; k < count; k++) {
  const name = NAMES[k % NAMES.length];
  const s: Socket<ServerEvents, ClientEvents> = io(SERVER, { transports: ['websocket'], extraHeaders: { origin: ORIGIN } });
  let me = '';
  let typing = 0;
  let voted = 0;
  let delivered = 0;
  let done: string[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  // Vai "digitando" as partes ao longo do tempo; cada parte é um quadro.
  const work = (round: number, parts: string[], ms: number) => {
    let i = 0;
    done = [];
    clearInterval(timer);
    timer = setInterval(() => {
      if (i >= parts.length) return clearInterval(timer);
      done.push(parts[i]);
      s.emit('player:content', { round, data: parts[i++] }); // duelo: vai para a TV; contra todos: salvamento de segurança
    }, Math.max(1500, ms / parts.length));
  };
  s.on('connect', () => {
    s.emit('player:join', { code, name }, (res) => {
      if (!res.ok) return console.error(`${name}: ${res.error}`);
      me = res.playerId;
      console.log(`${name} entrou na sala ${code}`);
    });
  });
  s.on('state', (r: PublicRoom) => {
    if (!me) return;
    const t = r.task;
    if (r.phase === 'work' && t && typing !== t.round) {
      typing = t.round;
      const careful = Math.random() < 0.55;
      const left = Math.min(90_000, (t.endsAt - Date.now()) * 0.7);
      setTimeout(() => work(t.round, steps(t.challengeId, careful, 0.4 + Math.random() * 0.6), left), Math.max(0, t.startsAt - Date.now()));
      console.log(`${name} fazendo o desafio da turma (${careful ? 'caprichando' : 'só o texto'})`);
    }
    if (r.phase === 'reveal' && t && delivered !== t.round && done.length) {
      delivered = t.round;
      clearInterval(timer);
      s.emit('player:frames', { round: t.round, frames: thinFrames(done) }, () => console.log(`${name} entregou`));
    }
    const d = r.duel;
    if (!d || r.phase === 'work' || r.phase === 'reveal' || r.phase === 'ranking') return;
    const mine = d.a === me || d.b === me;
    if (r.phase === 'duel' && mine && typing !== d.round) {
      typing = d.round;
      const careful = Math.random() < 0.55;
      work(d.round, steps(d.challengeId, careful), (d.endsAt - Date.now()) * 0.7);
      console.log(`${name} duelando (${careful ? 'caprichando' : 'só o texto'})`);
    }
    if (r.phase !== 'duel') clearInterval(timer);
    if (r.phase === 'vote' && !mine && voted !== d.round) {
      voted = d.round;
      const side = Math.random() < 0.5 ? 'a' : 'b';
      setTimeout(() => s.emit('player:vote', { side }, () => console.log(`${name} votou`)), 3000 + Math.random() * 5000);
    }
  });
}
