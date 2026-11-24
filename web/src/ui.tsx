// Peças comuns das telas do jogo (TV e aluno).
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CHALLENGE_BY_ID, type Challenge } from '../../shared/challenges.ts';
import type { Kind, PublicPlayer, PublicRoom } from '../../shared/protocol.ts';
import { AVATARS, fmtClock } from '../../shared/rules.ts';
import { bbox, parseCells, type Cells } from '../../shared/sheet.ts';
import { SheetGrid } from './google/Sheets.tsx';
import { sanitizeDoc } from './google/sanitize.ts';
import { DocsLogo, SheetsLogo } from './google/ui.tsx';

export const avatarOf = (p: PublicPlayer | undefined) => AVATARS[(p?.avatar ?? 0) % AVATARS.length];
export const playerOf = (room: PublicRoom, id: string | undefined) => room.players.find((p) => p.id === id);
export const challengeOf = (room: PublicRoom): Challenge | undefined => (room.duel ? CHALLENGE_BY_ID.get(room.duel.challengeId) : undefined);
export const KIND_LABEL: Record<Kind, string> = { docs: 'Google Documentos', sheets: 'Google Planilhas' };
// Número do duelo para mostrar (sortear de novo não conta): duelos já feitos + o atual.
export const duelNumber = (room: PublicRoom) =>
  Math.floor(room.players.reduce((n, p) => n + p.duels, 0) / 2) + (room.phase === 'draw' || room.phase === 'duel' ? 1 : 0);

export function Avatar({ p, size = 44, className = '' }: { p: PublicPlayer | undefined; size?: number; className?: string }) {
  const a = avatarOf(p);
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, fontSize: size * 0.56, ['--c' as string]: a.color }} aria-hidden="true">
      {a.emoji}
    </span>
  );
}

export const KindLogo = ({ kind, size = 32 }: { kind: Kind; size?: number }) => (kind === 'docs' ? <DocsLogo size={size} /> : <SheetsLogo size={size} />);

// Escala o conteúdo (largura fixa) para caber na largura do quadro, com CSS zoom (barato no Chromebook).
export function Fit({ width, children, className = '' }: { width: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current!;
    const update = () => setZoom(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={`fit ${className}`}>
      {zoom > 0 && <div style={{ zoom, width }}>{children}</div>}
    </div>
  );
}

// Tamanho da grade mostrada: o maior entre o modelo e o que o aluno fez, com uma folga.
const sheetSize = (a: Cells, b?: Cells) => {
  const x = bbox(a);
  const y = b ? bbox(b) : { rows: 0, cols: 0 };
  return { rows: Math.min(30, Math.max(x.rows, y.rows, 5) + 1), cols: Math.min(10, Math.max(x.cols, y.cols, 3) + 1) };
};

// Documento para ler de longe: largura de leitura menor que a página (mesma para modelo e trabalhos, então a quebra é justa).
export const DOC_W = 440;
function DocCard({ html, width }: { html: string; width: number }) {
  return (
    <Fit width={width} className="preview-doc">
      <div className="gd-content doc-card" dangerouslySetInnerHTML={{ __html: html }} />
    </Fit>
  );
}

export function ModelPreview({ challenge, docWidth = DOC_W }: { challenge: Challenge; docWidth?: number }) {
  if (challenge.kind === 'docs') return <DocCard html={challenge.html} width={docWidth} />;
  const { rows, cols } = sheetSize(challenge.cells);
  return <Fit width={46 + cols * 100} className="preview-sheet"><SheetGrid cells={challenge.cells} rows={rows} cols={cols} /></Fit>;
}

// Trabalho de um duelista (vindo da rede): o HTML passa pelo filtro antes de aparecer.
export function WorkPreview({ challenge, data, docWidth = DOC_W }: { challenge: Challenge; data: string | undefined; docWidth?: number }) {
  const html = useMemo(() => (challenge.kind === 'docs' ? sanitizeDoc(data ?? '') : ''), [challenge.kind, data]);
  const cells = useMemo(() => (challenge.kind === 'sheets' ? parseCells(data || '{}') : {}), [challenge.kind, data]);
  if (challenge.kind === 'docs') return <DocCard html={html} width={docWidth} />;
  const { rows, cols } = sheetSize(challenge.cells, cells);
  return <Fit width={46 + cols * 100} className="preview-sheet"><SheetGrid cells={cells} rows={rows} cols={cols} /></Fit>;
}

// Cronômetro com anel. O anel anima com stroke-dashoffset (só ele foge da regra transform/opacity).
export function Timer({ left, total, size = 96, label }: { left: number; total: number; size?: number; label?: string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const urgent = left <= 10_000;
  const style: CSSProperties = { width: size, height: size };
  return (
    <div className={`timer${urgent ? ' urgent' : ''}`} style={style} role="timer" aria-label={label ?? 'Tempo restante'}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="track" />
        <circle cx="50" cy="50" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <span style={{ fontSize: size * 0.27 }}>{fmtClock(left)}</span>
    </div>
  );
}

export function VoteBar({ votes, total, side, winner }: { votes: number; total: number; side: 'a' | 'b'; winner?: boolean }) {
  const pct = total ? votes / total : 0;
  return (
    <div className={`votebar ${side}${winner ? ' win' : ''}`}>
      <div className="votebar-fill" style={{ transform: `scaleX(${pct})` }} />
      <span className="votebar-n" key={votes}>{votes}</span>
      <span className="votebar-l">{votes === 1 ? 'voto' : 'votos'}</span>
    </div>
  );
}

// Lista de pontos para a linha de chegada (TV e aluno).
export const byPoints = (players: PublicPlayer[]) =>
  [...players].sort((x, y) => y.points - x.points || x.name.localeCompare(y.name, 'pt-BR'));
