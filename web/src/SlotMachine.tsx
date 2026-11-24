// Sorteio na TV: máquina caça-níquel vertical com dois rolos, "VS" explosivo, desafio e contagem 3-2-1.
// Tudo é calculado pelo relógio do servidor: se a TV recarregar no meio, volta no ponto certo.
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { PublicPlayer, PublicRoom } from '../../shared/protocol.ts';
import { CHALLENGE_AT, COUNT_AT, DRAW_MS, REEL_A_STOP, REEL_B_STOP, VS_AT } from '../../shared/rules.ts';
import { serverNow, useTick } from './net.ts';
import { play } from './sound.ts';
import { Avatar, KIND_LABEL, KindLogo, challengeOf, duelNumber, playerOf } from './ui.tsx';

const SPIN_FROM = 500;
// Lâmpadas em volta da moldura: 10 em cima, 10 embaixo, 4 de cada lado (posições em %).
const BULBS: [number, number][] = [
  ...Array.from({ length: 10 }, (_, i): [number, number] => [5 + i * 10, 0]),
  ...Array.from({ length: 4 }, (_, i): [number, number] => [100, 20 + i * 20]),
  ...Array.from({ length: 10 }, (_, i): [number, number] => [95 - i * 10, 100]),
  ...Array.from({ length: 4 }, (_, i): [number, number] => [0, 80 - i * 20]),
];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Rolo com nomes embaralhados; o sorteado fica na penúltima posição (centro da janela no fim).
function buildStrip(pool: PublicPlayer[], chosen: PublicPlayer, length: number, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const others = pool.filter((p) => p.id !== chosen.id);
  const src = others.length ? others : [chosen];
  const out: PublicPlayer[] = [];
  for (let i = 0; i < length; i++) out.push(src[Math.floor(rnd() * src.length)]);
  out[length - 2] = chosen;
  return out;
}

const Reel = memo(function Reel({ items, stopAt, t0, side }: { items: PublicPlayer[]; stopAt: number; t0: number; side: 'a' | 'b' }) {
  const strip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = strip.current!;
    const h = (el.firstElementChild as HTMLElement).offsetHeight;
    const end = -(items.length - 3) * h;
    if (reduced()) {
      el.style.transform = `translateY(${end}px)`;
      return;
    }
    const anim = el.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${end}px)` }], {
      duration: stopAt - SPIN_FROM, delay: SPIN_FROM, easing: 'cubic-bezier(0.12, 0.8, 0.22, 1.04)', fill: 'both',
    });
    anim.currentTime = Math.max(0, serverNow() - t0);
    // Tique-taque que desacelera junto com o rolo.
    let timer = 0;
    const tick = () => {
      const el2 = serverNow() - t0;
      if (el2 >= stopAt) return;
      if (el2 >= SPIN_FROM && side === 'a') play('tick', 0.08);
      const p = Math.max(0, Math.min(1, (el2 - SPIN_FROM) / (stopAt - SPIN_FROM)));
      timer = window.setTimeout(tick, 55 + p * p * 420);
    };
    tick();
    return () => {
      anim.cancel();
      clearTimeout(timer);
    };
  }, [items, stopAt, t0, side]);
  return (
    <div className={`reel reel-${side}`}>
      <div className="reel-strip" ref={strip}>
        {items.map((p, i) => (
          <div key={i} className="reel-item">
            <Avatar p={p} size={58} />
            <span>{p.name}</span>
          </div>
        ))}
      </div>
      <div className="reel-shade" />
      <div className="reel-band" />
    </div>
  );
});

export default function SlotMachine({ room }: { room: PublicRoom }) {
  const d = room.duel!;
  const t0 = d.startsAt - DRAW_MS;
  const now = useTick(100);
  const el = now - t0;
  const pa = playerOf(room, d.a);
  const pb = playerOf(room, d.b);
  const ch = challengeOf(room);

  const [stripA, stripB] = useMemo(() => {
    const pool = room.players.filter((p) => p.online);
    return [buildStrip(pool, pa!, 34, d.round * 7 + 1), buildStrip(pool, pb!, 42, d.round * 13 + 5)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.round, d.a, d.b]);

  // Sons nos marcos da linha do tempo (só os que ainda vão acontecer).
  useEffect(() => {
    const cues: [number, Parameters<typeof play>[0]][] = [
      [REEL_A_STOP, 'land'], [REEL_B_STOP, 'land'], [VS_AT, 'slam'], [CHALLENGE_AT, 'reveal'],
      [COUNT_AT, 'count'], [COUNT_AT + 750, 'count'], [COUNT_AT + 1500, 'count'], [COUNT_AT + 2250, 'go'],
    ];
    const start = serverNow() - t0;
    const timers = cues.filter(([at]) => at > start).map(([at, s]) => window.setTimeout(() => play(s), at - start));
    return () => timers.forEach(clearTimeout);
  }, [t0]);

  if (!pa || !pb || !ch) return null;
  const count = el >= COUNT_AT ? Math.floor((el - COUNT_AT) / 750) : -1;
  const stage = [
    el >= REEL_A_STOP && 'stop-a', el >= REEL_B_STOP && 'stop-b', el >= VS_AT && 'vs-on', el >= CHALLENGE_AT && 'chal-on',
    count >= 0 && 'counting',
  ].filter(Boolean).join(' ');

  return (
    <div className={`slot-stage ${stage}`}>
      <div className="beams" aria-hidden="true"><i /><i /></div>
      <h2 className="slot-title">Sorteio do duelo <small>Duelo {duelNumber(room)}</small></h2>
      <div className="machine">
        <div className="bulbs" aria-hidden="true">
          {BULBS.map(([x, y], i) => <i key={i} className={i % 2 ? 'odd' : ''} style={{ left: `${x}%`, top: `${y}%` }} />)}
        </div>
        <div className="machine-inner">
          <div className="reel-wrap a">
            <Reel items={stripA} stopAt={REEL_A_STOP} t0={t0} side="a" />
            <div className="winner-tag a">{pa.name}</div>
          </div>
          <div className="vs" aria-label="versus">
            <span className="vs-ring" />
            <span className="vs-flash" />
            <svg className="bolt l" viewBox="0 0 40 120" aria-hidden="true"><path d="M26 0 4 64h14L10 120 36 46H22z" /></svg>
            <b>V</b><b>S</b>
            <svg className="bolt r" viewBox="0 0 40 120" aria-hidden="true"><path d="M26 0 4 64h14L10 120 36 46H22z" /></svg>
          </div>
          <div className="reel-wrap b">
            <Reel items={stripB} stopAt={REEL_B_STOP} t0={t0} side="b" />
            <div className="winner-tag b">{pb.name}</div>
          </div>
        </div>
      </div>
      <div className={`chal-card ${ch.kind}`}>
        <KindLogo kind={ch.kind} size={56} />
        <div>
          <small>Desafio no {KIND_LABEL[ch.kind]}</small>
          <strong>{ch.title}</strong>
          <span>Recriem o modelo igualzinho: texto <em>e</em> formatação!</span>
        </div>
      </div>
      {count >= 0 && (
        <div className="countdown" key={count} aria-live="assertive">
          {count < 3 ? 3 - count : 'VALENDO!'}
        </div>
      )}
    </div>
  );
}
