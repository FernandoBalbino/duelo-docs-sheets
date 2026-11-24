// Corrida até a linha de chegada: uma raia por aluno; quem venceu o duelo avança uma casa na frente de todos.
import { useEffect, useState } from 'react';
import type { PublicPlayer } from '../../shared/protocol.ts';
import { play } from './sound.ts';
import { Avatar, byPoints } from './ui.tsx';

export default function Race({ players, target, movers = [], delay = 900, me }: {
  players: PublicPlayer[]; target: number; movers?: string[]; delay?: number; me?: string;
}) {
  const [moved, setMoved] = useState(!movers.length);
  useEffect(() => {
    if (!movers.length) return;
    const t = setTimeout(() => {
      setMoved(true);
      play('step');
    }, delay);
    return () => clearTimeout(t);
  }, [movers.length, delay]);

  const list = byPoints(players);
  const cols = list.length > 14 ? 2 : 1;
  return (
    <>
    <div className={`race-legend cols-${cols}`} aria-hidden="true"><span /><div><span>Largada</span><span>Chegada 🏁</span></div></div>
    <div className={`race cols-${cols}`} style={{ ['--target' as string]: target }}>
      {list.map((p, i) => {
        const mover = movers.includes(p.id);
        const pts = Math.min(target, mover && !moved ? p.points - 1 : p.points);
        const done = p.points >= target;
        return (
          <div key={p.id} className={`lane${mover ? ' mover' : ''}${done ? ' done' : ''}${p.id === me ? ' me' : ''}`} style={{ ['--i' as string]: i }}>
            <div className="lane-name">
              <span>{p.name}</span>
              <b>{p.points}</b>
            </div>
            <div className="lane-track">
              {Array.from({ length: target - 1 }, (_, k) => <i key={k} className="lane-step" style={{ left: `${((k + 1) / target) * 100}%` }} />)}
              <div className="lane-finish" />
              <div className="runner" style={{ transform: `translateX(${(pts / target) * 100}%)` }}>
                <Avatar p={p} size={34} className={mover && moved ? 'hop' : ''} />
                {mover && moved && <em className="plus">+1</em>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
