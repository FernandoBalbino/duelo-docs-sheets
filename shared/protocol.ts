// Mensagens entre navegador e servidor. Pequenas de propósito: a banda e as horas do Render free são limitadas.
import type { Settings } from './rules.ts';

export type Phase = 'lobby' | 'draw' | 'duel' | 'vote' | 'result' | 'work' | 'reveal' | 'ranking' | 'final';
export type Kind = 'docs' | 'sheets';
export type Side = 'a' | 'b';
export type Winner = Side | 'tie' | 'none';

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: number; // índice em AVATARS
  points: number; // duelos vencidos
  duels: number;
  online: boolean;
}

export interface PublicDuel {
  round: number;
  a: string; // id do duelista da esquerda
  b: string; // id do duelista da direita
  challengeId: string;
  kind: Kind;
  startsAt: number; // fim do sorteio = começo do desafio (relógio do servidor)
  endsAt: number; // fim do desafio
  voteEndsAt: number; // 0 até a votação abrir
  votes: { a: number; b: number };
  voters: number; // alunos conectados que podem votar
  winner: Winner | null;
}

// Contra todos: um dos desafios da partida, para a turma inteira.
export interface PublicTask {
  round: number;
  index: number; // posição na lista do professor (0 = primeiro)
  count: number; // quantos desafios a partida tem
  challengeId: string;
  kind: Kind;
  startsAt: number;
  endsAt: number;
}

export interface PublicRoom {
  code: string;
  phase: Phase;
  settings: Settings;
  players: PublicPlayer[];
  duel: PublicDuel | null;
  champions: string[]; // ids de quem chegou na linha de chegada
  task: PublicTask | null;
  scores: Record<string, number> | null; // % de cada aluno (calculada pela TV) no desafio que acabou
  board: Record<string, (number | null)[]> | null; // % de cada aluno em cada desafio da partida (pódio final)
  serverNow: number;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Cb<T = object> = (res: Ack<T>) => void;

export type TeacherAction = 'draw' | 'redraw' | 'endDuel' | 'addTime' | 'endVote' | 'restart' | 'kick' | 'startAll' | 'endWork' | 'nextTask';

export interface ClientEvents {
  'teacher:create': (p: null, ack: Cb<{ code: string; token: string }>) => void;
  'teacher:resume': (p: { code: string; token: string }, ack: Cb) => void;
  'teacher:settings': (p: Partial<Settings>, ack: Cb) => void;
  'teacher:action': (p: { action: TeacherAction; playerId?: string }, ack: Cb) => void;
  'player:join': (p: { code: string; name: string }, ack: Cb<{ playerId: string; token: string }>) => void;
  'player:resume': (p: { code: string; token: string }, ack: Cb<{ playerId: string }>) => void;
  // Sem ack: o duelista manda o documento de tempos em tempos e só a TV recebe.
  'player:content': (p: { round: number; data: string }) => void;
  'player:vote': (p: { side: Side }, ack: Cb) => void;
  // Contra todos: o progresso inteiro vai uma vez só, no fim (o salvamento por minuto usa player:content).
  'player:frames': (p: { round: number; frames: string[] }, ack: Cb) => void;
  'teacher:scores': (p: { scores: Record<string, number> }, ack: Cb) => void;
}

export interface ServerEvents {
  state: (room: PublicRoom) => void; // só em mudança de fase, entrada e saída
  votes: (p: { round: number; a: number; b: number }) => void; // cada voto, sem reenviar a sala
  content: (p: { round: number; id: string; data: string }) => void; // só para a TV
  kicked: () => void;
  idle: () => void; // sala parada: o servidor desconecta todo mundo
  frames: (p: { round: number; id: string; frames: string[] }) => void; // só para a TV
  saved: (p: { id: string }) => void; // só para a TV: aluno salvou (sem o conteúdo)
}
