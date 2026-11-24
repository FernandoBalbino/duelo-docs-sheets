// Conexão com o servidor e estado da sala compartilhado entre as telas.
// A conexão só abre quando precisa (entrar/criar sala): a página inicial não acorda o Render à toa.
import { io, type Socket } from 'socket.io-client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Ack, ClientEvents, PublicRoom, ServerEvents } from '../../shared/protocol.ts';

export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL || `${location.protocol}//${location.hostname}:3000`;

export const socket: Socket<ServerEvents, ClientEvents> = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnectionDelayMax: 4000,
  autoConnect: false,
});
export const wake = () => {
  if (!socket.connected && !socket.active) socket.connect();
};

let room: PublicRoom | null = null;
let kicked = false;
let idle = false;
const contents = new Map<string, string>(); // TV: documento atual de cada duelista (rodada atual)
let contentRound = 0;
const offsets: number[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

// O relógio do servidor manda: a amostra com menor atraso de rede é a de maior diferença.
const sample = (serverNow: number) => {
  offsets.push(serverNow - Date.now());
  if (offsets.length > 12) offsets.shift();
};
export const serverNow = () => Date.now() + (offsets.length ? Math.max(...offsets) : 0);

socket.on('state', (r) => {
  sample(r.serverNow);
  if (r.duel?.round !== contentRound) {
    contentRound = r.duel?.round ?? 0;
    contents.clear();
  }
  room = r;
  emit();
});
socket.on('votes', ({ round, a, b }) => {
  if (!room?.duel || room.duel.round !== round) return;
  room = { ...room, duel: { ...room.duel, votes: { a, b } } };
  emit();
});
socket.on('content', ({ round, id, data }) => {
  if (round !== contentRound) return;
  contents.set(id, data);
  emit();
});
socket.on('kicked', () => {
  kicked = true;
  room = null;
  saveSession(null);
  emit();
});
socket.on('idle', () => {
  idle = true;
  emit();
});

export const clearRoom = () => {
  room = null;
  kicked = false;
  emit();
};
export const reconnect = () => {
  idle = false;
  emit();
  socket.connect();
};

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};
export const useRoom = () => useSyncExternalStore(subscribe, () => room);
export const useKicked = () => useSyncExternalStore(subscribe, () => kicked);
export const useIdle = () => useSyncExternalStore(subscribe, () => idle);
export const useContent = (id: string | undefined) => useSyncExternalStore(subscribe, () => (id ? contents.get(id) : undefined));

let connected = socket.connected;
socket.on('connect', () => ((connected = true), emit()));
socket.on('disconnect', () => ((connected = false), emit()));
export const useConnected = () => useSyncExternalStore(subscribe, () => connected);

type AckOf<E extends keyof ClientEvents> = Parameters<ClientEvents[E]> extends [unknown, (res: infer R) => void] ? R : Ack;
export async function send<E extends keyof ClientEvents>(event: E, payload: Parameters<ClientEvents[E]>[0]): Promise<AckOf<E>> {
  wake();
  try {
    // @ts-expect-error emitWithAck não consegue inferir o tipo do ack genérico
    return await socket.timeout(12000).emitWithAck(event, payload);
  } catch {
    return { ok: false, error: 'Sem resposta do servidor. Verifique a internet.' } as AckOf<E>;
  }
}

// Força um novo desenho algumas vezes por segundo (cronômetros e animações por tempo).
export function useTick(every = 250) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), every);
    return () => clearInterval(t);
  }, [every]);
  return serverNow();
}

// Sessão salva para voltar depois de recarregar a página.
export type Session =
  | { role: 'teacher'; code: string; token: string }
  | { role: 'player'; code: string; token: string; playerId: string };
const KEY = 'duelo-docs-sheets:sessao';
export function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}
export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* modo anônimo sem storage: a sessão só vale até recarregar */
  }
}
