// Servidor de tempo real (Render free). Só troca mensagens pequenas; as telas ficam no GitHub Pages.
import express from 'express';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '../shared/protocol.ts';
import { IDLE_MS } from '../shared/rules.ts';
import { Game, GameError, type Clock, type Room } from './game.ts';

type Auth = { code: string; kind: 'teacher' } | { code: string; kind: 'player'; playerId: string };
type Data = { auth?: Auth; since: number };
type Sock = Socket<ClientEvents, ServerEvents, Record<string, never>, Data>;

export function createGameServer(origins: string[], clock?: Clock) {
  const app = express();
  app.disable('x-powered-by');
  const http = createServer(app);
  const io = new Server<ClientEvents, ServerEvents, Record<string, never>, Data>(http, {
    cors: { origin: origins, methods: ['GET', 'POST'] },
    allowRequest: (req, cb) => cb(null, !req.headers.origin || origins.includes(req.headers.origin)),
    maxHttpBufferSize: 400 * 1024, // quadros do contra todos (até MAX_FRAMES_CHARS caracteres, uma vez por aluno)
    perMessageDeflate: false,
    serveClient: false,
  });
  const tv = (code: string) => `${code}:tv`;

  // Várias mudanças no mesmo instante viram um único envio de estado.
  const pending = new Set<string>();
  const game = new Game({
    clock,
    onChange: (room) => {
      if (pending.has(room.code)) return;
      pending.add(room.code);
      queueMicrotask(() => {
        pending.delete(room.code);
        if (game.rooms.has(room.code)) io.to(room.code).emit('state', game.view(room));
      });
    },
    onFrames: (room, id, frames) => io.to(tv(room.code)).emit('frames', { round: room.task!.round, id, frames }),
  });

  // Sala parada há muito tempo: desconecta todo mundo para o Render free poder dormir.
  // As telas mostram "Reconectar" e voltam para o mesmo ponto.
  setInterval(() => {
    const now = Date.now();
    game.cleanup();
    for (const room of game.rooms.values()) {
      if (now - room.touched < IDLE_MS) continue;
      io.to(room.code).emit('idle');
      io.in(room.code).disconnectSockets(true);
    }
    for (const s of io.sockets.sockets.values()) if (!s.data.auth && now - s.data.since > 10 * 60_000) s.disconnect(true);
  }, 60_000).unref();

  app.get('/health', (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*').json({ ok: true, rooms: game.rooms.size });
  });

  const handle = <T extends object>(ack: unknown, fn: () => T) => {
    if (typeof ack !== 'function') return;
    try {
      ack({ ok: true, ...fn() });
    } catch (err) {
      ack({ ok: false, error: err instanceof GameError ? err.message : 'Erro inesperado. Tente de novo.' });
      if (!(err instanceof GameError)) console.error(err);
    }
  };

  const attach = (socket: Sock, room: Room, auth: Auth) => {
    socket.data.auth = auth;
    socket.join(room.code);
    socket.emit('state', game.view(room));
    if (auth.kind !== 'teacher') return;
    socket.join(tv(room.code));
    // A TV recarregou no meio do duelo: devolve o que os duelistas já fizeram.
    if (room.phase === 'work' || room.phase === 'reveal') {
      for (const [id, frames] of room.submissions) socket.emit('frames', { round: room.task!.round, id, frames });
      for (const id of room.contents.keys()) socket.emit('saved', { id });
    } else if (room.duel) for (const [id, data] of room.contents) socket.emit('content', { round: room.duel.round, id, data });
  };
  const socketsOf = (room: Room, playerId: string) =>
    [...io.sockets.sockets.values()].filter((s) => {
      const a = s.data.auth;
      return a?.kind === 'player' && a.code === room.code && a.playerId === playerId;
    });

  io.on('connection', (socket: Sock) => {
    socket.data.since = Date.now();
    const authed = () => {
      const auth = socket.data.auth;
      if (!auth) throw new GameError('Entre em uma sala primeiro.');
      return { auth, room: game.room(auth.code) };
    };
    const teacherRoom = () => {
      const { auth, room } = authed();
      if (auth.kind !== 'teacher') throw new GameError('Só o professor pode fazer isso.');
      return room;
    };

    socket.on('teacher:create', (_p, ack) =>
      handle(ack, () => {
        const room = game.createRoom();
        attach(socket, room, { code: room.code, kind: 'teacher' });
        return { code: room.code, token: room.teacherToken };
      }));

    socket.on('teacher:resume', (p, ack) =>
      handle(ack, () => {
        const room = game.teacher(p?.code, p?.token);
        game.touch(room);
        attach(socket, room, { code: room.code, kind: 'teacher' });
        return {};
      }));

    socket.on('teacher:settings', (p, ack) => handle(ack, () => (game.setSettings(teacherRoom(), p), {})));

    socket.on('teacher:action', (p, ack) =>
      handle(ack, () => {
        const room = teacherRoom();
        switch (p?.action) {
          case 'draw': game.draw(room); break;
          case 'redraw': game.redraw(room); break;
          case 'endDuel': game.endDuel(room); break;
          case 'addTime': game.addTime(room); break;
          case 'endVote': game.endVote(room); break;
          case 'restart': game.restart(room); break;
          case 'startAll': game.startAll(room); break;
          case 'endWork': game.endWork(room); break;
          case 'nextTask': game.nextTask(room); break;
          case 'kick': {
            const kicked = game.kick(room, p.playerId);
            for (const s of socketsOf(room, kicked.id)) {
              s.emit('kicked');
              s.leave(room.code);
              s.data.auth = undefined;
            }
            break;
          }
          default: throw new GameError('Ação desconhecida.');
        }
        return {};
      }));

    socket.on('player:join', (p, ack) =>
      handle(ack, () => {
        const { room, player } = game.join(p?.code, p?.name);
        attach(socket, room, { code: room.code, kind: 'player', playerId: player.id });
        return { playerId: player.id, token: player.token };
      }));

    socket.on('player:resume', (p, ack) =>
      handle(ack, () => {
        const { room, player } = game.resume(p?.code, p?.token);
        attach(socket, room, { code: room.code, kind: 'player', playerId: player.id });
        game.setOnline(room, player.id, true);
        return { playerId: player.id };
      }));

    // Documento do duelista: vai só para a TV. Sem ack para economizar mensagens.
    socket.on('player:content', (p) => {
      const auth = socket.data.auth;
      if (auth?.kind !== 'player') return;
      const room = game.rooms.get(auth.code);
      if (room?.phase === 'work') {
        if (game.checkpoint(room, auth.playerId, p?.round, p?.data)) io.to(tv(room.code)).emit('saved', { id: auth.playerId });
      } else if (room && game.content(room, auth.playerId, p?.round, p?.data))
        io.to(tv(room.code)).emit('content', { round: room.duel!.round, id: auth.playerId, data: p.data });
    });

    // Cada voto vira um evento pequeno para a sala (barras ao vivo), sem reenviar o estado inteiro.
    socket.on('player:vote', (p, ack) =>
      handle(ack, () => {
        const { auth, room } = authed();
        if (auth.kind !== 'player') throw new GameError('Só alunos votam.');
        const t = game.vote(room, auth.playerId, p?.side);
        io.to(room.code).emit('votes', { round: room.duel!.round, ...t });
        return {};
      }));

    socket.on('player:frames', (p, ack) =>
      handle(ack, () => {
        const { auth, room } = authed();
        if (auth.kind !== 'player') throw new GameError('Só alunos enviam trabalho.');
        game.saveFrames(room, auth.playerId, p?.round, p?.frames);
        return {};
      }));

    socket.on('teacher:scores', (p, ack) => handle(ack, () => (game.finishAll(teacherRoom(), p?.scores), {})));

    socket.on('disconnect', () => {
      const auth = socket.data.auth;
      if (auth?.kind !== 'player') return;
      const room = game.rooms.get(auth.code);
      // Outra aba do mesmo aluno ainda conectada? Então continua online.
      if (room && !socketsOf(room, auth.playerId).some((s) => s.id !== socket.id)) game.setOnline(room, auth.playerId, false);
    });
  });

  return { app, http, io, game };
}

if (import.meta.main) {
  const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim());
  const port = Number(process.env.PORT ?? 3000);
  createGameServer(origins).http.listen(port, () => console.log(`Duelo Docs × Sheets: servidor na porta ${port} (origens: ${origins.join(', ')})`));
}
