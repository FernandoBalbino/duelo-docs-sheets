// Constantes do jogo, usadas pelo servidor e pelas telas.

export const MAX_NAME = 18;
export const MAX_PLAYERS = 45;
export const MAX_CONTENT = 40_000; // caracteres do documento/planilha enviados por um duelista

// Linha do tempo do sorteio na TV (ms desde o início do sorteio). O desafio começa em DRAW_MS.
export const REEL_A_STOP = 4200;
export const REEL_B_STOP = 5100;
export const VS_AT = 5400;
export const CHALLENGE_AT = 6300;
export const COUNT_AT = 7800; // 3, 2, 1, valendo!
export const DRAW_MS = 10_800;

export const VOTE_GRACE_MS = 3000; // o conteúdo final ainda chega logo depois do fim do tempo
export const EARLY_CLOSE_MS = 1500; // todos votaram: espera a última barra subir
export const IDLE_MS = 25 * 60_000; // sem nada acontecendo: desconecta para o Render free dormir

export type Mode = 'alternar' | 'docs' | 'sheets' | 'aleatorio';
export const MODES: { id: Mode; label: string }[] = [
  { id: 'alternar', label: 'Alternar' },
  { id: 'docs', label: 'Só Docs' },
  { id: 'sheets', label: 'Só Sheets' },
  { id: 'aleatorio', label: 'Aleatório' },
];

export interface Settings {
  duelSeconds: number;
  voteSeconds: number;
  target: number; // vitórias para ser campeão
  mode: Mode;
}
export const DEFAULT_SETTINGS: Settings = { duelSeconds: 180, voteSeconds: 30, target: 3, mode: 'alternar' };
export const LIMITS = {
  duelSeconds: [30, 900],
  voteSeconds: [10, 120],
  target: [1, 10],
} as const satisfies Record<string, readonly [number, number]>;

export const AVATARS: { emoji: string; color: string }[] = [
  { emoji: '🦊', color: '#f97316' }, { emoji: '🐼', color: '#64748b' }, { emoji: '🐸', color: '#22c55e' },
  { emoji: '🦁', color: '#eab308' }, { emoji: '🐙', color: '#ec4899' }, { emoji: '🐧', color: '#0ea5e9' },
  { emoji: '🦄', color: '#a855f7' }, { emoji: '🐯', color: '#f59e0b' }, { emoji: '🐨', color: '#94a3b8' },
  { emoji: '🐵', color: '#b45309' }, { emoji: '🦉', color: '#78716c' }, { emoji: '🐢', color: '#16a34a' },
  { emoji: '🦖', color: '#15803d' }, { emoji: '🐳', color: '#2563eb' }, { emoji: '🦋', color: '#06b6d4' },
  { emoji: '🐝', color: '#ca8a04' }, { emoji: '🦜', color: '#ef4444' }, { emoji: '🐰', color: '#f472b6' },
  { emoji: '🐮', color: '#525252' }, { emoji: '🐷', color: '#fb7185' }, { emoji: '🦈', color: '#3b82f6' },
  { emoji: '🐞', color: '#dc2626' }, { emoji: '🦩', color: '#d946ef' }, { emoji: '🐹', color: '#d97706' },
];

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
