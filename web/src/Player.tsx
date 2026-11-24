// Tela do aluno no Chromebook: espera, sorteio, editor (se foi sorteado), votação e resultado.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Challenge } from '../../shared/challenges.ts';
import type { PublicPlayer, PublicRoom, Side } from '../../shared/protocol.ts';
import { REEL_B_STOP, DRAW_MS, fmtClock } from '../../shared/rules.ts';
import { parseCells, type Cells } from '../../shared/sheet.ts';
import { DocsEditor } from './google/Docs.tsx';
import { SheetsEditor } from './google/Sheets.tsx';
import { Icon, SidePanel } from './google/ui.tsx';
import { send, socket, useTick } from './net.ts';
import Race from './Race.tsx';
import { Avatar, KIND_LABEL, KindLogo, ModelPreview, VoteBar, avatarOf, byPoints, challengeOf, playerOf } from './ui.tsx';

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch { /* sem storage */ }
  },
};

export default function Player({ room, me }: { room: PublicRoom; me: string }) {
  const p = playerOf(room, me);
  const d = room.duel;
  const duelist = !!d && (d.a === me || d.b === me);
  if (!p) return null;
  if ((room.phase === 'duel' || room.phase === 'vote') && duelist) return <Duelist room={room} me={p} />;
  return (
    <div className="kid">
      <header className="kid-bar">
        <Avatar p={p} size={36} />
        <strong>{p.name}</strong>
        <span className="kid-pts" title="Vitórias"><Icon name="emoji_events" size={18} /> {p.points}/{room.settings.target}</span>
        <span className="kid-code">Sala {room.code}</span>
      </header>
      <main className="kid-main" key={`${room.phase}-${d?.round ?? 0}`}>
        {room.phase === 'lobby' && <Waiting room={room} me={p} />}
        {room.phase === 'draw' && <DrawWait room={room} me={p} />}
        {room.phase === 'duel' && <Watch room={room} />}
        {room.phase === 'vote' && <Vote room={room} />}
        {room.phase === 'result' && <Outcome room={room} me={p} />}
      </main>
    </div>
  );
}

function Waiting({ room, me }: { room: PublicRoom; me: PublicPlayer }) {
  return (
    <section className="kid-card center">
      <Avatar p={me} size={110} className="float" />
      <h1>Você está na sala!</h1>
      <p>Olhe a TV: quando o professor sortear, a máquina escolhe dois rivais. Pode ser você!</p>
      <div className="kid-others">
        {room.players.filter((x) => x.id !== me.id).slice(0, 24).map((x) => <Avatar key={x.id} p={x} size={30} className={x.online ? '' : 'dim'} />)}
      </div>
    </section>
  );
}

function DrawWait({ room, me }: { room: PublicRoom; me: PublicPlayer }) {
  const d = room.duel!;
  const now = useTick(200);
  const el = now - (d.startsAt - DRAW_MS);
  const ch = challengeOf(room)!;
  const rival = playerOf(room, d.a === me.id ? d.b : d.a);
  const mine = d.a === me.id || d.b === me.id;
  if (el < REEL_B_STOP) {
    return (
      <section className="kid-card center">
        <div className="mini-reel" aria-hidden="true">
          <div>{[...room.players, ...room.players].slice(0, 16).map((x, i) => <span key={i}>{avatarOf(x).emoji}</span>)}</div>
        </div>
        <h1>Sorteio rolando na TV…</h1>
        <p>Quem será que vai duelar?</p>
      </section>
    );
  }
  if (mine) {
    return (
      <section className="kid-card center chosen">
        <p className="kicker">Você foi sorteado(a)!</p>
        <div className="versus-row"><Avatar p={me} size={84} className="pop" /><b>VS</b><Avatar p={rival} size={84} className="pop" /></div>
        <h1>Prepare-se, {me.name}!</h1>
        <p className="kind-line"><KindLogo kind={ch.kind} size={28} /> {KIND_LABEL[ch.kind]}: <b>{ch.title}</b></p>
        <p className="soon">O editor abre em {Math.max(1, Math.ceil((d.startsAt - now) / 1000))} s</p>
      </section>
    );
  }
  return (
    <section className="kid-card center">
      <div className="versus-row"><Avatar p={playerOf(room, d.a)} size={72} className="pop" /><b>VS</b><Avatar p={playerOf(room, d.b)} size={72} className="pop" /></div>
      <h1>{playerOf(room, d.a)?.name} × {playerOf(room, d.b)?.name}</h1>
      <p>Assista ao duelo na TV. No final, <b>você vota</b> em quem ficou mais parecido com o modelo.</p>
    </section>
  );
}

function Watch({ room }: { room: PublicRoom }) {
  const d = room.duel!;
  const ch = challengeOf(room)!;
  const now = useTick(500);
  return (
    <section className="kid-card">
      <div className="watch-head">
        <div className="versus-row small"><Avatar p={playerOf(room, d.a)} size={44} /><b>VS</b><Avatar p={playerOf(room, d.b)} size={44} /></div>
        <div className="watch-clock"><Icon name="timer" size={20} /> {fmtClock(d.endsAt - now)}</div>
      </div>
      <h1>Olhe a TV!</h1>
      <p>Repare em quem está copiando também a <b>formatação</b>: negrito, cores, tamanhos, alinhamento… Este é o modelo:</p>
      <div className={`kid-model ${ch.kind}`}><ModelPreview challenge={ch} /></div>
    </section>
  );
}

function Vote({ room }: { room: PublicRoom }) {
  const d = room.duel!;
  const key = `duelo-docs-sheets:voto:${room.code}:${d.round}`;
  const [voted, setVoted] = useState<Side | null>(() => store.get(key) as Side | null);
  const [error, setError] = useState('');
  const now = useTick(500);
  const total = d.votes.a + d.votes.b;
  const vote = async (side: Side) => {
    setVoted(side);
    const res = await send('player:vote', { side });
    if (res.ok || /já votou/.test(res.error)) store.set(key, side);
    else {
      setVoted(null);
      setError(res.error);
    }
  };
  const pa = playerOf(room, d.a);
  const pb = playerOf(room, d.b);
  return (
    <section className="kid-card center">
      <p className="kicker"><Icon name="how_to_vote" size={20} /> Votação · {fmtClock(d.voteEndsAt - now)}</p>
      <h1>{voted ? 'Voto registrado!' : 'Quem ficou mais parecido com o modelo?'}</h1>
      {!voted && <p>Compare os dois trabalhos na TV e toque no seu escolhido.</p>}
      <div className="vote-btns">
        {(['a', 'b'] as const).map((s) => {
          const p = s === 'a' ? pa : pb;
          return (
            <button key={s} type="button" className={`vote-btn ${s}${voted === s ? ' picked' : ''}`} disabled={!!voted} onClick={() => vote(s)}>
              <Avatar p={p} size={76} />
              <strong>{p?.name}</strong>
              <small>{s === 'a' ? '← Esquerda na TV' : 'Direita na TV →'}</small>
              {voted && <VoteBar votes={d.votes[s]} total={total} side={s} />}
            </button>
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
      {voted && <p className="soon">{total} de {d.voters} votaram</p>}
    </section>
  );
}

function Outcome({ room, me }: { room: PublicRoom; me: PublicPlayer }) {
  const d = room.duel!;
  const pa = playerOf(room, d.a);
  const pb = playerOf(room, d.b);
  const champs = room.champions.map((id) => playerOf(room, id)?.name).filter(Boolean);
  const won = (d.winner === 'a' && me.id === d.a) || (d.winner === 'b' && me.id === d.b) || (d.winner === 'tie' && (me.id === d.a || me.id === d.b));
  const title = d.winner === 'none' ? 'Ninguém votou' : d.winner === 'tie' ? 'Empate! Os dois avançam' : `${(d.winner === 'a' ? pa : pb)?.name} venceu!`;
  return (
    <section className={`kid-card center${won ? ' won' : ''}`}>
      {won && <p className="kicker">Você avançou uma casa! 🎉</p>}
      <h1>{title}</h1>
      <p className="score-line small"><span className="a">{pa?.name} <b>{d.votes.a}</b></span><i>×</i><span className="b"><b>{d.votes.b}</b> {pb?.name}</span></p>
      {champs.length > 0 && <p className="champ-line">🏆 {champs.join(' e ')} {champs.length > 1 ? 'são os campeões!' : 'é campeão(ã)!'}</p>}
      <div className="kid-race">
        <Race players={byPoints(room.players).slice(0, 8).some((x) => x.id === me.id) ? byPoints(room.players).slice(0, 8) : [...byPoints(room.players).slice(0, 7), me]} target={room.settings.target} me={me.id} />
      </div>
    </section>
  );
}

// Duelista: editor do Docs ou do Sheets em tela cheia. Envia o trabalho para a TV a cada ~1 s, só se mudou.
function Duelist({ room, me }: { room: PublicRoom; me: PublicPlayer }) {
  const d = room.duel!;
  const ch = challengeOf(room)!;
  const key = `duelo-docs-sheets:doc:${room.code}:${d.round}`;
  const initial = useMemo(() => store.get(key) ?? '', [key]);
  const latest = useRef(initial);
  const dirty = useRef(!!initial);
  const now = useTick(500);
  const locked = room.phase !== 'duel' || now >= d.endsAt;
  const rival = playerOf(room, d.a === me.id ? d.b : d.a);
  const [zoomed, setZoomed] = useState(false);

  const flush = useCallback(() => {
    if (!dirty.current || !socket.connected) return;
    dirty.current = false;
    socket.emit('player:content', { round: d.round, data: latest.current });
  }, [d.round]);
  useEffect(() => {
    const t = setInterval(flush, 1000);
    const again = () => ((dirty.current = true), flush());
    socket.on('connect', again);
    return () => {
      clearInterval(t);
      socket.off('connect', again);
    };
  }, [flush]);
  useEffect(() => {
    if (locked) flush();
  }, [locked, flush]);

  const save = useCallback((data: string) => {
    if (data === latest.current) return;
    latest.current = data;
    dirty.current = true;
    store.set(key, data);
  }, [key]);
  const saveCells = useCallback((cells: Cells) => save(JSON.stringify(cells)), [save]);

  const left = d.endsAt - now;
  const side = (
    <SidePanel
      title="Desafio do duelo"
      heading={ch.title}
      tips={ch.tips}
      onExpand={() => setZoomed(true)}
      timer={
        <div className={`duel-clock${left <= 30_000 ? ' urgent' : ''}`}>
          <Icon name="timer" size={22} />
          <div><small>Tempo restante</small><b>{fmtClock(left)}</b></div>
          <span className="rival" title={`Seu rival: ${rival?.name}`}><Avatar p={rival} size={26} />{rival?.name}</span>
        </div>
      }
    >
      <ModelPreview challenge={ch as Challenge} docWidth={380} />
    </SidePanel>
  );
  const a = avatarOf(me);
  const avatar = { ...a, name: me.name };
  return (
    <>
      {ch.kind === 'docs'
        ? <DocsEditor initial={initial} onChange={save} locked={locked} side={side} avatar={avatar} />
        : <SheetsEditor initial={parseCells(initial || '{}')} onChange={saveCells} locked={locked} side={side} avatar={avatar} />}
      {locked && (
        <div className="timeup">
          <div className="timeup-card">
            <span aria-hidden="true">⏰</span>
            <h2>Tempo esgotado!</h2>
            <p>Seu trabalho foi enviado. A turma está votando agora — olhe a TV!</p>
            {room.phase === 'vote' && (
              <div className="timeup-votes">
                {(['a', 'b'] as const).map((s) => (
                  <Fragment key={s}>
                    <span>{playerOf(room, d[s])?.name}</span>
                    <VoteBar votes={d.votes[s]} total={d.votes.a + d.votes.b} side={s} />
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {zoomed && (
        <div className="model-zoom" onClick={() => setZoomed(false)}>
          <div className="model-zoom-card">
            <header><span>Modelo: {ch.title}</span><button type="button" className="btn primary">Fechar</button></header>
            <div className="work-zoom"><ModelPreview challenge={ch} docWidth={560} /></div>
          </div>
        </div>
      )}
      {!locked && now - d.startsAt < 2500 && <div className="go-toast">Valendo! Recrie o modelo do painel ao lado <KindLogo kind={ch.kind} size={22} /></div>}
    </>
  );
}
