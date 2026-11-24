// Contra todos na TV: prova da turma inteira, replay de cada aluno com a % do modelo e ranking.
// A % é calculada aqui na TV (score.ts): o servidor só guarda e repassa os quadros.
import confetti from 'canvas-confetti';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CHALLENGE_BY_ID, type Challenge } from '../../shared/challenges.ts';
import type { PublicPlayer, PublicRoom } from '../../shared/protocol.ts';
import { sanitizeDoc } from './google/sanitize.ts';
import { Icon } from './google/ui.tsx';
import { act, send, useFrames, useSaved, useTick } from './net.ts';
import { scoreWork, type Criterion, type Score } from './score.ts';
import { play } from './sound.ts';
import { Avatar, KIND_LABEL, KindLogo, ModelPreview, Timer, WorkPreview } from './ui.tsx';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const taskChallenge = (room: PublicRoom) => CHALLENGE_BY_ID.get(room.task!.challengeId)!;
const clean = (ch: Challenge, frames: string[]) => (ch.kind === 'docs' ? frames.map(sanitizeDoc) : frames);
export const finalScore = (ch: Challenge, frames: string[] | undefined) => (frames?.length ? scoreWork(ch, clean(ch, frames.slice(-1))[0]).pct : 0);

// ---------- Durante a prova
export function AllWork({ room }: { room: PublicRoom }) {
  const t = room.task!;
  const ch = taskChallenge(room);
  const now = useTick(250);
  const saved = useSaved();
  const frames = useFrames(); // quem já entregou
  const count = Math.ceil((t.startsAt - now) / 1000) - 1; // 3, 2, 1, 0 = valendo
  useEffect(() => {
    if (count >= 0 && count <= 3) play(count ? 'count' : 'go');
  }, [count]);
  const online = room.players.filter((p) => p.online).length;
  return (
    <div className="arena allwork">
      <div className="arena-top">
        <div className="arena-title">
          <KindLogo kind={ch.kind} size={40} />
          <div>
            <small>Desafio {t.index + 1} de {t.count} · {KIND_LABEL[ch.kind]}</small>
            <strong>{ch.title}</strong>
          </div>
        </div>
        <Timer left={t.endsAt - now} total={t.endsAt - t.startsAt} size={96} label="Tempo do desafio" />
        <div className="arena-actions">
          <button type="button" className="btn ghost" onClick={() => act('addTime')}><Icon name="more_time" /> +1 min</button>
          <button type="button" className="btn primary" onClick={() => confirm('Encerrar a prova agora e mostrar os resultados?') && act('endWork')}>
            <Icon name="stop_circle" /> Encerrar e ver resultados
          </button>
        </div>
      </div>
      <div className="allwork-cols">
        <section className="model">
          <div className="model-vs">MODELO</div>
          <div className={`work model-work ${ch.kind}`}><ModelPreview challenge={ch} contain /></div>
          <ul className="model-tips">{ch.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </section>
        <section className="people-panel">
          <h3><Icon name="groups" /> {room.players.filter((p) => frames.has(p.id)).length} de {online} entregaram</h3>
          <div className="people">
            {room.players.map((p) => {
              const at = saved.get(p.id);
              const done = frames.has(p.id);
              const status = done ? '✓ entregou' : !p.online ? 'desconectado' : at ? `salvou há ${Math.max(0, Math.floor((Date.now() - at) / 60_000))} min` : 'trabalhando…';
              return (
                <div key={p.id} className={`person${p.online ? '' : ' off'}${at ? ' saved' : ''}${done ? ' done' : ''}`}>
                  <Avatar p={p} size={38} />
                  <div><strong>{p.name}</strong><small>{status}</small></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {count >= 0 && (
        <div className="all-intro chal-on">
          <div className={`chal-card ${ch.kind}`}>
            <KindLogo kind={ch.kind} size={56} />
            <div>
              <small>Desafio {t.index + 1} de {t.count} · {KIND_LABEL[ch.kind]}</small>
              <strong>{ch.title}</strong>
              <span>Todos fazem o mesmo modelo. Acabou o tempo ou todos entregaram: replay e % de cada um!</span>
            </div>
          </div>
          <div className="countdown" key={count}>{count ? count : 'VALENDO!'}</div>
        </div>
      )}
    </div>
  );
}

// ---------- Revelação: um aluno por vez
const INTRO_MS = 900;
const REPLAY_MS = 4500;
const CRIT_MS = 520;
const HOLD_MS = 2800;
const GATHER_MS = 10_000;

function Typed({ text, speed, onDone }: { text: string; speed: number; onDone?: () => void }) {
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (n >= text.length) return void done.current?.();
    const t = setTimeout(() => {
      setN(n + 1);
      if (n % 2 === 0) play('type', 0.05);
    }, speed);
    return () => clearTimeout(t);
  }, [n, text.length, speed]);
  return <>{text.slice(0, n)}{n < text.length && <i className="caret" aria-hidden="true" />}</>;
}

function CriterionRow({ c }: { c: Criterion }) {
  const [typed, setTyped] = useState(false);
  useEffect(() => {
    if (typed) play(c.ok ? 'ok' : 'bad');
  }, [typed, c.ok]);
  return (
    <li className={`crit${typed ? (c.ok ? ' ok' : ' bad') : ''}`}>
      <span className="crit-mark" aria-hidden="true">{typed ? (c.ok ? '✓' : '✕') : ''}</span>
      <span className="crit-text"><Typed text={c.label} speed={16} onDone={() => setTyped(true)} /></span>
      {typed && <em>{Math.round(c.pct * 100)}%</em>}
    </li>
  );
}

const verdict = (pct: number) => (pct >= 95 ? 'Perfeito!' : pct >= 80 ? 'Muito bom!' : pct >= 60 ? 'Bom trabalho!' : pct >= 30 ? 'Quase lá…' : 'Faltou capricho');

function RevealCard({ p, n, total, ch, frames, onDone, label }: {
  p: PublicPlayer; n: number; total: number; ch: Challenge; frames: string[]; onDone: () => void; label: string;
}) {
  const shots = useMemo(() => clean(ch, frames), [ch, frames]);
  const scores = useMemo(() => shots.map((f) => scoreWork(ch, f)), [ch, shots]);
  const final: Score = scores.at(-1) ?? scoreWork(ch, '');
  const [step, setStep] = useState(-1); // quadro do replay na tela (-1 = em branco)
  const [shown, setShown] = useState(0); // critérios já digitados
  const [done, setDone] = useState(false);
  const next = useRef(onDone);
  next.current = onDone;

  // Linha do tempo: nome → replay com a barra subindo → critérios ✓/✕ um a um → nota final.
  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const per = shots.length ? REPLAY_MS / shots.length : 0;
    shots.forEach((_, k) => at(INTRO_MS + per * (k + 1), () => {
      setStep(k);
      play('tick', 0.04);
    }));
    const c0 = INTRO_MS + (shots.length ? REPLAY_MS : 600) + 300;
    final.criteria.forEach((_, k) => at(c0 + k * CRIT_MS, () => setShown(k + 1)));
    const end = c0 + final.criteria.length * CRIT_MS + 250;
    at(end, () => {
      setDone(true);
      play(final.pct >= 70 ? 'fanfare' : 'reveal');
      if (final.pct >= 90 && !reduced()) confetti({ particleCount: 120, spread: 90, origin: { y: 0.7 }, disableForReducedMotion: true });
    });
    at(end + HOLD_MS, () => next.current());
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = done ? final.pct : step >= 0 ? scores[step].pct : 0;
  return (
    <div className={`rv${done ? ' done' : ''}`}>
      <header className="rv-head">
        <Avatar p={p} size={62} className="pop" />
        <h2><Typed text={p.name} speed={45} /></h2>
        <span className="rv-count">{label} · aluno {n} de {total}</span>
      </header>
      <div className="rv-cols">
        <section className="rv-panel">
          <h3>Trabalho de {p.name}{step >= 0 && !done && <span className="rv-rec">● replay</span>}</h3>
          <div className={`work ${ch.kind}`}>
            {step >= 0
              ? <WorkPreview challenge={ch} data={shots[step]} contain />
              : <div className="work-empty"><KindLogo kind={ch.kind} size={44} /><span>{shots.length ? 'Começando do zero…' : 'Não entregou nada'}</span></div>}
          </div>
        </section>
        <section className="rv-panel model">
          <h3>Modelo original</h3>
          <div className={`work ${ch.kind}`}><ModelPreview challenge={ch} contain /></div>
        </section>
      </div>
      <div className="rv-bar" style={{ ['--p' as string]: pct / 100 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="rv-fill" />
        <span className="rv-label">do modelo</span>
        <b className="rv-pct" key={done ? 'final' : 'run'}>{pct}%</b>
      </div>
      <div className="rv-bottom">
        <ul className="rv-crit">{final.criteria.slice(0, shown).map((c) => <CriterionRow key={c.label} c={c} />)}</ul>
        {done && <div className="rv-verdict">{verdict(final.pct)}</div>}
      </div>
    </div>
  );
}

const session = {
  get: (k: string) => {
    try {
      return Number(sessionStorage.getItem(k)) || 0;
    } catch {
      return 0;
    }
  },
  set: (k: string, v: number) => {
    try {
      sessionStorage.setItem(k, String(v));
    } catch { /* sem storage */ }
  },
};

export function Reveal({ room }: { room: PublicRoom }) {
  const t = room.task!;
  const ch = taskChallenge(room);
  const frames = useFrames();
  const key = `duelo-docs-sheets:revelacao:${room.code}:${t.round}`;
  // Os Chromebooks só mandam os quadros quando o tempo acaba: espera todos (no máximo GATHER_MS) antes do primeiro replay.
  const expected = useMemo(() => room.players.filter((p) => p.online), [t.round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const tm = setTimeout(() => setReady(true), GATHER_MS);
    return () => clearTimeout(tm);
  }, []);
  useEffect(() => {
    if (expected.every((p) => frames.has(p.id))) setReady(true);
  }, [expected, frames]);
  // Ordem embaralhada (fixa na rodada): ninguém sabe se vem o melhor ou o pior.
  const order = useMemo(() => {
    let s = t.round * 7919 + 13;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    return room.players.filter((p) => p.online || frames.has(p.id)).map((p) => [rnd(), p] as const).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.round, ready]);
  const [idx, setIdx] = useState(() => session.get(key));
  useEffect(() => session.set(key, idx), [key, idx]);
  const over = ready && idx >= order.length;
  useEffect(() => {
    if (!over) return;
    const scores = Object.fromEntries(order.map((p) => [p.id, finalScore(ch, frames.get(p.id))]));
    void send('teacher:scores', { scores }).then((res) => !res.ok && alert(res.error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);
  if (!ready) {
    return (
      <div className="reveal-wait">
        <div className="spinner" />
        <h2>Recolhendo os trabalhos… {expected.filter((p) => frames.has(p.id)).length} de {expected.length}</h2>
        <div className="gather">{expected.map((p) => <span key={p.id} className={frames.has(p.id) ? 'in' : ''}><Avatar p={p} size={44} /></span>)}</div>
      </div>
    );
  }
  if (over) return <div className="reveal-wait"><div className="spinner" /><h2>Montando o ranking…</h2></div>;
  const p = order[idx];
  return (
    <div className="reveal">
      <RevealCard key={p.id} p={p} n={idx + 1} total={order.length} ch={ch} frames={frames.get(p.id) ?? []} onDone={() => setIdx((i) => i + 1)}
        label={`Desafio ${t.index + 1} de ${t.count}`} />
      <footer className="result-actions">
        <button type="button" className="btn ghost" onClick={() => setIdx((i) => i + 1)}><Icon name="skip_next" /> Próximo aluno</button>
        <button type="button" className="btn primary" onClick={() => setIdx(order.length)}><Icon name="emoji_events" /> Ver ranking</button>
      </footer>
    </div>
  );
}

// ---------- Resultado de um desafio (entre um e outro)
export function Ranking({ room }: { room: PublicRoom }) {
  const t = room.task!;
  const last = t.index + 1 >= t.count;
  const scores = room.scores ?? {};
  const list = room.players.filter((p) => p.id in scores).sort((a, b) => scores[b.id] - scores[a.id] || a.name.localeCompare(b.name, 'pt-BR'));
  useEffect(() => {
    play('fanfare');
    if (!reduced()) confetti({ particleCount: 160, spread: 110, origin: { y: 0.45 }, colors: ['#ffd54a', '#4285f4', '#34a853', '#ffffff'], disableForReducedMotion: true });
  }, []);
  const podium = [list[1], list[0], list[2]];
  return (
    <div className="ranking">
      <section className="rk-podium">
        <h2><Icon name="emoji_events" size={38} /> Desafio {t.index + 1} de {t.count}: quem chegou mais perto</h2>
        <div className="podium">
          {podium.map((p, i) => p && (
            <div key={p.id} className={`pod pod-${[2, 1, 3][i]}`} style={{ ['--i' as string]: [1, 2, 0][i] }}>
              <Avatar p={p} size={[84, 110, 76][i]} className="pop" />
              <strong>{p.name}</strong>
              <em>{scores[p.id]}%</em>
              <div className="pedestal"><b>{[2, 1, 3][i]}º</b></div>
            </div>
          ))}
        </div>
      </section>
      <ol className="rk-list">
        {list.map((p, i) => (
          <li key={p.id} style={{ ['--i' as string]: i, ['--p' as string]: scores[p.id] / 100 }}>
            <b>{i + 1}º</b>
            <Avatar p={p} size={28} />
            <span>{p.name}</span>
            <div className="rk-bar"><i /></div>
            <em>{scores[p.id]}%</em>
          </li>
        ))}
      </ol>
      <footer className="result-actions">
        <button type="button" className="btn primary big" onClick={() => act('nextTask')}>
          {last ? <><Icon name="emoji_events" /> Ver pódio final</> : <><Icon name="skip_next" /> Próximo desafio ({t.index + 2} de {t.count})</>}
        </button>
        <button type="button" className="btn ghost" onClick={() => confirm('Encerrar a partida e voltar para a sala?') && act('restart')}>Voltar para a sala</button>
      </footer>
    </div>
  );
}

// ---------- Pódio final: média da % de todos os desafios da partida (quem faltou num desafio fica com 0 nele)
export const average = (marks: (number | null)[] | undefined, count: number) =>
  Math.round((marks ?? []).reduce<number>((s, v) => s + (v ?? 0), 0) / Math.max(1, count));

export function Final({ room }: { room: PublicRoom }) {
  const board = room.board ?? {};
  const count = room.task?.count ?? 1;
  const list = room.players.filter((p) => p.id in board)
    .map((p) => ({ p, avg: average(board[p.id], count) }))
    .sort((a, b) => b.avg - a.avg || a.p.name.localeCompare(b.p.name, 'pt-BR'));
  useEffect(() => {
    play('fanfare');
    if (reduced()) return;
    const burst = () => confetti({ particleCount: 150, spread: 120, origin: { y: 0.5 }, colors: ['#ffd54a', '#4285f4', '#34a853', '#ffffff'], disableForReducedMotion: true });
    burst();
    const t = setInterval(burst, 3000);
    return () => clearInterval(t);
  }, []);
  const places = [3, 1, 0, 2, 4]; // 4º, 2º, 1º, 3º, 5º da esquerda para a direita
  return (
    <div className="ranking final">
      <section className="rk-podium">
        <h2><Icon name="emoji_events" size={38} /> Pódio final · média dos {count} desafios</h2>
        <div className="podium five">
          {places.map((k) => list[k] && (
            <div key={list[k].p.id} className={`pod pod-${k + 1}`} style={{ ['--i' as string]: 4 - k }}>
              <Avatar p={list[k].p} size={[104, 84, 74, 64, 58][k]} className="pop" />
              <strong>{list[k].p.name}</strong>
              <em>{list[k].avg}%</em>
              <div className="pedestal"><b>{k + 1}º</b></div>
            </div>
          ))}
        </div>
      </section>
      <ol className="rk-list final-list">
        {list.map(({ p, avg }, i) => (
          <li key={p.id} style={{ ['--i' as string]: i, ['--p' as string]: avg / 100 }}>
            <b>{i + 1}º</b>
            <Avatar p={p} size={28} />
            <span>{p.name}</span>
            <div className="marks">{Array.from({ length: count }, (_, k) => (
              <i key={k} title={`Desafio ${k + 1}`} className={board[p.id][k] == null ? 'miss' : ''}>{board[p.id][k] ?? '—'}</i>
            ))}</div>
            <em>{avg}%</em>
          </li>
        ))}
      </ol>
      <footer className="result-actions">
        <button type="button" className="btn primary big" onClick={() => act('startAll')}><Icon name="restart_alt" /> Jogar de novo</button>
        <button type="button" className="btn ghost" onClick={() => confirm('Voltar para a sala?') && act('restart')}>Voltar para a sala</button>
      </footer>
    </div>
  );
}
