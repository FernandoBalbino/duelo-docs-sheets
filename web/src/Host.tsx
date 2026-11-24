// Tela da TV (professor): sala de espera, sorteio, duelo lado a lado, votação ao vivo, resultado e corrida.
import confetti from 'canvas-confetti';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CHALLENGES, CHALLENGE_BY_ID } from '../../shared/challenges.ts';
import type { PublicPlayer, PublicRoom, Side } from '../../shared/protocol.ts';
import { LIMITS, MODES, fmtClock, type Settings } from '../../shared/rules.ts';
import { AllWork, Ranking, Reveal } from './AllMode.tsx';
import { DocsLogo, Icon, SheetsLogo } from './google/ui.tsx';
import { act, send, useContent, useTick } from './net.ts';
import Race from './Race.tsx';
import SlotMachine from './SlotMachine.tsx';
import { play, toggleMuted, useMuted } from './sound.ts';
import { Avatar, KIND_LABEL, KindLogo, ModelPreview, Timer, VoteBar, WorkPreview, byPoints, challengeOf, duelNumber, playerOf } from './ui.tsx';

const shortUrl = () => `${location.host}${location.pathname}`.replace(/\/$/, '');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Host({ room }: { room: PublicRoom }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canSet = room.phase === 'lobby' || room.phase === 'result' || room.phase === 'ranking';
  let body: ReactNode;
  switch (room.phase) {
    case 'lobby': body = <Lobby room={room} />; break;
    case 'draw': body = <SlotMachine room={room} />; break;
    case 'duel': body = <Arena room={room} />; break;
    case 'vote': body = <Arena room={room} voting />; break;
    case 'result': body = <Result room={room} />; break;
    case 'work': body = <AllWork room={room} />; break;
    case 'reveal': body = <Reveal room={room} />; break;
    case 'ranking': body = <Ranking room={room} />; break;
  }
  return (
    <div className={`tv phase-${room.phase}`}>
      <TvBar room={room} onSettings={canSet && room.phase !== 'lobby' ? () => setSettingsOpen(true) : undefined} />
      <div className="tv-body" key={room.phase === 'result' ? `r${room.duel?.round}` : room.phase}>{body}</div>
      {settingsOpen && canSet && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && setSettingsOpen(false)}>
          <div className="modal-card">
            <SettingsPanel s={room.settings} />
            <button type="button" className="btn primary" onClick={() => setSettingsOpen(false)}>Pronto</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TvBar({ room, onSettings }: { room: PublicRoom; onSettings?: () => void }) {
  const muted = useMuted();
  const [full, setFull] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const online = room.players.filter((p) => p.online).length;
  return (
    <header className="tv-bar">
      <div className="tv-brand"><DocsLogo size={26} /><SheetsLogo size={26} /><span>Duelo <b>Docs</b> × <b>Sheets</b></span></div>
      <div className="tv-code">Código <b>{room.code}</b></div>
      <div className="tv-tools">
        <span className="tv-online" title="Alunos conectados"><Icon name="groups" /> {online}</span>
        {onSettings && <button type="button" className="icon-btn" title="Configurações" onClick={onSettings}><Icon name="settings" /></button>}
        <button type="button" className="icon-btn" title={muted ? 'Ligar som' : 'Desligar som'} onClick={toggleMuted}><Icon name={muted ? 'volume_off' : 'volume_up'} /></button>
        <button type="button" className="icon-btn" title="Tela cheia" onClick={() => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}>
          <Icon name={full ? 'fullscreen_exit' : 'fullscreen'} />
        </button>
        {room.phase !== 'lobby' && (
          <button type="button" className="icon-btn" title="Recomeçar a partida (zera os pontos)"
            onClick={() => confirm('Recomeçar a partida? Os pontos de todos voltam a zero.') && act('restart')}>
            <Icon name="restart_alt" />
          </button>
        )}
      </div>
    </header>
  );
}

function Stepper({ label, value, min, max, step, show, onChange }: { label: string; value: number; min: number; max: number; step: number; show: (v: number) => string; onChange: (v: number) => void }) {
  // Valor local: cliques rápidos não se perdem enquanto o servidor ainda não confirmou o anterior.
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const change = (next: number) => {
    setV(next);
    onChange(next);
  };
  return (
    <div className="stepper">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Diminuir ${label}`} disabled={v <= min} onClick={() => change(Math.max(min, v - step))}>−</button>
        <output key={v}>{show(v)}</output>
        <button type="button" aria-label={`Aumentar ${label}`} disabled={v >= max} onClick={() => change(Math.min(max, v + step))}>+</button>
      </div>
    </div>
  );
}

function SettingsPanel({ s }: { s: Settings }) {
  const set = async (patch: Partial<Settings>) => {
    const res = await send('teacher:settings', patch);
    if (!res.ok) alert(res.error);
  };
  return (
    <div className="settings">
      <h3><Icon name="settings" /> Configurações</h3>
      <div className="seg game-seg" role="radiogroup" aria-label="Modo de jogo">
        <div>
          <button type="button" role="radio" aria-checked={s.game === 'duel'} className={s.game === 'duel' ? 'on' : ''} onClick={() => set({ game: 'duel' })}>
            <Icon name="casino" size={18} /> Duelo
          </button>
          <button type="button" role="radio" aria-checked={s.game === 'all'} className={s.game === 'all' ? 'on' : ''} onClick={() => set({ game: 'all' })}>
            <Icon name="groups" size={18} /> Contra todos
          </button>
        </div>
      </div>
      {s.game === 'duel' ? (
        <>
          <Stepper label="Tempo do desafio" value={s.duelSeconds} min={LIMITS.duelSeconds[0]} max={LIMITS.duelSeconds[1]} step={30}
            show={(v) => fmtClock(v * 1000)} onChange={(v) => set({ duelSeconds: v })} />
          <Stepper label="Tempo de votação" value={s.voteSeconds} min={LIMITS.voteSeconds[0]} max={LIMITS.voteSeconds[1]} step={5}
            show={(v) => `${v} s`} onChange={(v) => set({ voteSeconds: v })} />
          <Stepper label="Vitórias para ser campeão" value={s.target} min={LIMITS.target[0]} max={LIMITS.target[1]} step={1}
            show={(v) => String(v)} onChange={(v) => set({ target: v })} />
        </>
      ) : (
        <>
          <Stepper label="Tempo da partida" value={s.allMinutes} min={5} max={LIMITS.allMinutes[1]} step={5}
            show={(v) => `${v} min`} onChange={(v) => set({ allMinutes: v })} />
          <label className="pick">
            <span>Desafio</span>
            <select value={s.pick} onChange={(e) => set({ pick: e.target.value })}>
              <option value="intermediario">Sortear um intermediário</option>
              <option value="basico">Sortear um básico</option>
              {(['intermediario', 'basico'] as const).flatMap((level) => (['docs', 'sheets'] as const).map((kind) => (
                <optgroup key={level + kind} label={`${kind === 'docs' ? 'Documentos' : 'Planilhas'} · ${level === 'basico' ? 'básico' : 'intermediário'}`}>
                  {CHALLENGES.filter((c) => c.kind === kind && c.level === level).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </optgroup>
              )))}
            </select>
          </label>
        </>
      )}
      {(s.game === 'duel' || !CHALLENGE_BY_ID.has(s.pick)) && <div className="seg" role="radiogroup" aria-label="Tipo de desafio">
        <span>Tipo de desafio</span>
        <div>
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={s.mode === m.id} className={s.mode === m.id ? 'on' : ''} onClick={() => set({ mode: m.id })}>
              {m.id === 'docs' && <DocsLogo size={18} />}{m.id === 'sheets' && <SheetsLogo size={18} />}{m.label}
            </button>
          ))}
        </div>
      </div>}
    </div>
  );
}

function Lobby({ room }: { room: PublicRoom }) {
  const online = room.players.filter((p) => p.online).length;
  const all = room.settings.game === 'all';
  const steps = all
    ? ['Todos recebem o mesmo modelo', 'Cada um recria no Docs ou no Sheets', 'A TV mostra o replay e a % de cada um', 'Ranking de quem chegou mais perto']
    : ['A máquina sorteia dois rivais', 'A dupla recria o modelo no Docs ou no Sheets', 'A turma vota em quem ficou mais parecido', 'Quem vence avança até a linha de chegada'];
  return (
    <div className="lobby">
      <section className="lobby-hero">
        <div className="hero-logos" aria-hidden="true"><DocsLogo size={84} /><span>VS</span><SheetsLogo size={84} /></div>
        <h1 className="brand-title">Duelo <em className="docs">Docs</em> <i>×</i> <em className="sheets">Sheets</em></h1>
        <p className="lobby-how">No Chromebook, entre em <b>{shortUrl()}</b> e digite o código:</p>
        <div className="code-tiles" aria-label={`Código ${room.code}`}>
          {room.code.split('').map((ch, i) => <span key={i} style={{ ['--i' as string]: i }}>{ch}</span>)}
        </div>
        <ol className="lobby-steps" key={room.settings.game}>
          {steps.map((text, i) => <li key={text}><b>{i + 1}</b> {text}</li>)}
        </ol>
      </section>
      <aside className="lobby-side">
        <SettingsPanel s={room.settings} />
        {all ? (
          <button type="button" className="btn primary big draw-btn" disabled={online < 1} onClick={() => act('startAll')}>
            <Icon name="groups" size={26} /> Começar para todos
          </button>
        ) : (
          <button type="button" className="btn primary big draw-btn" disabled={online < 2} onClick={() => act('draw')}>
            <Icon name="casino" size={26} /> Sortear duelo
          </button>
        )}
        {online < (all ? 1 : 2) && <p className="hint">Precisa de pelo menos {all ? 'um aluno conectado' : '2 alunos conectados'}.</p>}
      </aside>
      <section className="lobby-players">
        <h3><Icon name="groups" /> {room.players.length ? `${room.players.length} na sala` : 'Esperando os alunos…'}</h3>
        <div className="chips">
          {room.players.map((p) => (
            <div key={p.id} className={`chip${p.online ? '' : ' off'}`}>
              <Avatar p={p} size={34} />
              <span>{p.name}</span>
              <button type="button" title={`Remover ${p.name}`} aria-label={`Remover ${p.name}`}
                onClick={() => confirm(`Remover ${p.name} da sala?`) && act('kick', p.id)}><Icon name="close" size={16} /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Coluna de um duelista: nome em cima e o trabalho ao vivo embaixo.
function Contender({ p, side, room, voting }: { p: PublicPlayer | undefined; side: Side; room: PublicRoom; voting?: boolean }) {
  const ch = challengeOf(room)!;
  const data = useContent(p?.id);
  const [pulse, setPulse] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    setPulse((n) => n + 1);
  }, [data]);
  const d = room.duel!;
  const total = d.votes.a + d.votes.b;
  return (
    <section className={`contender ${side}`}>
      <header>
        <Avatar p={p} size={48} />
        <div>
          <strong>{p?.name ?? '—'}</strong>
          <small>{!p?.online ? 'desconectado' : voting ? (side === 'a' ? 'Esquerda' : 'Direita') : data ? 'trabalhando…' : 'começando…'}</small>
        </div>
        {!voting && <span className="typing" key={pulse} aria-hidden="true"><i /><i /><i /></span>}
      </header>
      <div className={`work ${ch.kind}`}>
        {data ? <WorkPreview challenge={ch} data={data} /> : <div className="work-empty"><KindLogo kind={ch.kind} size={48} /><span>{KIND_LABEL[ch.kind]} em branco</span></div>}
      </div>
      {voting && <VoteBar votes={d.votes[side]} total={total} side={side} />}
    </section>
  );
}

function Arena({ room, voting }: { room: PublicRoom; voting?: boolean }) {
  const d = room.duel!;
  const ch = challengeOf(room)!;
  const now = useTick(250);
  const left = (voting ? d.voteEndsAt : d.endsAt) - now;
  const total = voting ? room.settings.voteSeconds * 1000 : d.endsAt - d.startsAt;
  const votes = d.votes.a + d.votes.b;
  const prev = useRef(votes);
  useEffect(() => {
    if (votes > prev.current) play('vote');
    prev.current = votes;
  }, [votes]);
  useEffect(() => {
    if (voting) play('timeup');
  }, [voting]);
  return (
    <div className={`arena${voting ? ' voting' : ''}`}>
      <div className="arena-top">
        <div className="arena-title">
          <KindLogo kind={ch.kind} size={40} />
          <div>
            <small>{voting ? 'Votação aberta no Chromebook' : `Duelo ${duelNumber(room)} · ${KIND_LABEL[ch.kind]}`}</small>
            <strong>{voting ? 'Quem ficou mais parecido?' : ch.title}</strong>
          </div>
        </div>
        <Timer left={left} total={total} size={84} label={voting ? 'Tempo de votação' : 'Tempo do desafio'} />
        <div className="arena-actions">
          {voting ? (
            <>
              <span className="voted-count"><b>{votes}</b> de {d.voters} votaram</span>
              <button type="button" className="btn primary" onClick={() => act('endVote')}><Icon name="how_to_vote" /> Encerrar votação</button>
            </>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={() => act('addTime')}><Icon name="more_time" /> +30 s</button>
              <button type="button" className="btn ghost" onClick={() => confirm('Sortear outra dupla? Este duelo será descartado.') && act('redraw')}><Icon name="casino" /> Sortear de novo</button>
              <button type="button" className="btn primary" onClick={() => act('endDuel')}><Icon name="stop_circle" /> Encerrar desafio</button>
            </>
          )}
        </div>
      </div>
      <div className="arena-cols">
        <Contender p={playerOf(room, d.a)} side="a" room={room} voting={voting} />
        <section className="model">
          <div className="model-vs">VS</div>
          <h3>Modelo</h3>
          <div className={`work model-work ${ch.kind}`}><ModelPreview challenge={ch} /></div>
          <ul className="model-tips">{ch.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
        <Contender p={playerOf(room, d.b)} side="b" room={room} voting={voting} />
      </div>
    </div>
  );
}

const burst = (colors?: string[]) => {
  if (reduced()) return;
  confetti({ particleCount: 140, spread: 100, origin: { y: 0.55 }, colors, disableForReducedMotion: true });
};

function Result({ room }: { room: PublicRoom }) {
  const d = room.duel!;
  const [step, setStep] = useState<'winner' | 'race' | 'champion'>('winner');
  const pa = playerOf(room, d.a);
  const pb = playerOf(room, d.b);
  const winners = d.winner === 'a' ? [pa] : d.winner === 'b' ? [pb] : d.winner === 'tie' ? [pa, pb] : [];
  const movers = winners.flatMap((p) => (p ? [p.id] : []));
  const champs = room.champions.map((id) => playerOf(room, id)).filter((p): p is PublicPlayer => !!p);

  useEffect(() => {
    play(movers.length ? 'fanfare' : 'timeup');
    if (movers.length) burst(['#4285f4', '#34a853', '#fbbc04', '#ea4335']);
    const t1 = setTimeout(() => setStep('race'), 3600);
    const t2 = champs.length ? setTimeout(() => setStep('champion'), 8200) : 0;
    return () => (clearTimeout(t1), clearTimeout(t2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (step !== 'champion') return;
    play('fanfare');
    burst(['#ffd54a', '#ffffff', '#ff8a00']);
    const t = setInterval(() => burst(['#ffd54a', '#4285f4', '#34a853']), 2600);
    return () => clearInterval(t);
  }, [step]);

  return (
    <div className={`result step-${step}`}>
      {step === 'winner' && (
        <div className="winner-card">
          {movers.length ? (
            <>
              <div className="winner-avatars">{winners.map((p) => <Avatar key={p!.id} p={p} size={150} className="pop" />)}</div>
              <h2>{d.winner === 'tie' ? 'Empate! Os dois avançam' : `${winners[0]!.name} venceu o duelo!`}</h2>
            </>
          ) : (
            <h2>Ninguém votou neste duelo</h2>
          )}
          <p className="score-line">
            <span className="a">{pa?.name} <b>{d.votes.a}</b></span>
            <i>×</i>
            <span className="b"><b>{d.votes.b}</b> {pb?.name}</span>
          </p>
        </div>
      )}
      {step !== 'winner' && (
        <div className="race-panel">
          <h2><Icon name="sports_score" size={34} /> Corrida até a linha de chegada <small>{room.settings.target} {room.settings.target === 1 ? 'vitória' : 'vitórias'} para ganhar</small></h2>
          <Race players={room.players} target={room.settings.target} movers={movers} />
        </div>
      )}
      {step === 'champion' && (
        <div className="champion">
          <div className="rays" aria-hidden="true" />
          <div className="trophy" aria-hidden="true">🏆</div>
          <div className="champ-avatars">{champs.map((p) => <Avatar key={p.id} p={p} size={120} className="pop" />)}</div>
          <h2>{champs.map((p) => p.name).join(' e ')}</h2>
          <p>{champs.length > 1 ? 'cruzaram' : 'cruzou'} a linha de chegada e {champs.length > 1 ? 'são os campeões' : 'é campeão(ã)'} do Duelo Docs × Sheets!</p>
          <ol className="podium-list">
            {byPoints(room.players).slice(0, 5).map((p, i) => <li key={p.id}><b>{i + 1}º</b><Avatar p={p} size={28} />{p.name}<span>{p.points}</span></li>)}
          </ol>
        </div>
      )}
      <footer className="result-actions">
        {champs.length ? (
          <button type="button" className="btn primary big" onClick={() => act('restart')}><Icon name="restart_alt" /> Nova partida</button>
        ) : (
          <button type="button" className="btn primary big" onClick={() => act('draw')}><Icon name="casino" /> Próximo duelo</button>
        )}
        {step === 'winner' && <button type="button" className="btn ghost" onClick={() => setStep('race')}>Ver corrida</button>}
      </footer>
    </div>
  );
}

