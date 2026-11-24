// Tela inicial e escolha do papel (professor na TV ou aluno no Chromebook).
import { useEffect, useState, type FormEvent } from 'react';
import { MAX_NAME } from '../../shared/rules.ts';
import { DocsLogo, Icon, SheetsLogo } from './google/ui.tsx';
import Host from './Host.tsx';
import {
  clearRoom, loadSession, reconnect, saveSession, send, socket, useConnected, useIdle, useKicked, useRoom, wake, type Session,
} from './net.ts';
import Player from './Player.tsx';

export default function App() {
  const room = useRoom();
  const kicked = useKicked();
  const idle = useIdle();
  const connected = useConnected();
  const [session, setSession] = useState<Session | null>(loadSession);
  const [error, setError] = useState('');

  // Ao conectar (ou reconectar), volta para a sala salva.
  useEffect(() => {
    const resume = async () => {
      const s = loadSession();
      if (!s) return;
      const res = s.role === 'teacher'
        ? await send('teacher:resume', { code: s.code, token: s.token })
        : await send('player:resume', { code: s.code, token: s.token });
      if (!res.ok) {
        saveSession(null);
        setSession(null);
        clearRoom();
        setError(res.error);
      }
    };
    socket.on('connect', resume);
    if (loadSession()) wake();
    return () => void socket.off('connect', resume);
  }, []);

  const leave = () => {
    saveSession(null);
    setSession(null);
    clearRoom();
  };

  if (kicked) {
    return (
      <div className="home">
        <div className="home-card center">
          <h1>Você saiu da sala</h1>
          <p>O professor removeu seu nome. Se foi engano, entre de novo com o código da TV.</p>
          <button type="button" className="btn primary" onClick={leave}>Entrar de novo</button>
        </div>
      </div>
    );
  }

  if (session && room) {
    return (
      <>
        {session.role === 'teacher' ? <Host room={room} /> : <Player room={room} me={session.playerId} />}
        {idle && (
          <div className="modal">
            <div className="modal-card center">
              <h2>Pausado para economizar o servidor</h2>
              <p>Ficou um tempo sem nada acontecer, então a conexão foi desligada.</p>
              <button type="button" className="btn primary" onClick={reconnect}><Icon name="refresh" /> Continuar</button>
            </div>
          </div>
        )}
        {!idle && !connected && <div className="reconnecting"><Icon name="wifi_off" size={18} /> Reconectando…</div>}
      </>
    );
  }

  if (session) {
    return (
      <div className="home">
        <div className="home-card center">
          <div className="spinner" aria-hidden="true" />
          <h1>Conectando ao servidor…</h1>
          <p>O servidor gratuito dorme quando ninguém usa. Ele pode levar até 1 minuto para acordar.</p>
          {idle && <button type="button" className="btn primary" onClick={reconnect}>Tentar de novo</button>}
          <button type="button" className="btn ghost" onClick={leave}>Cancelar</button>
        </div>
      </div>
    );
  }

  return <Home error={error} onSession={setSession} />;
}

function Home({ error, onSession }: { error: string; onSession: (s: Session) => void }) {
  const [code, setCode] = useState(() => (new URLSearchParams(location.search).get('sala') ?? '').toUpperCase().slice(0, 4));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'' | 'join' | 'host'>('');
  const [slow, setSlow] = useState(false);
  const [err, setErr] = useState(error);

  useEffect(() => {
    if (!busy) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 3500);
    return () => clearTimeout(t);
  }, [busy]);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy('join');
    const res = await send('player:join', { code: code.trim().toUpperCase(), name });
    setBusy('');
    if (!res.ok) return setErr(res.error);
    const s: Session = { role: 'player', code: code.trim().toUpperCase(), token: res.token, playerId: res.playerId };
    saveSession(s);
    onSession(s);
  };
  const host = async () => {
    setErr('');
    setBusy('host');
    const res = await send('teacher:create', null);
    setBusy('');
    if (!res.ok) return setErr(res.error);
    const s: Session = { role: 'teacher', code: res.code, token: res.token };
    saveSession(s);
    onSession(s);
  };

  return (
    <div className="home">
      <div className="home-glow" aria-hidden="true"><i /><i /><i /></div>
      <div className="home-grid">
        <section className="home-hero">
          <div className="hero-logos" aria-hidden="true"><DocsLogo size={72} /><span>VS</span><SheetsLogo size={72} /></div>
          <h1 className="brand-title">Duelo <em className="docs">Docs</em> <i>×</i> <em className="sheets">Sheets</em></h1>
          <p>Dois rivais, um modelo e o relógio correndo. Quem recriar o documento ou a planilha mais parecido vence — e quem decide é a turma.</p>
        </section>
        <form className="home-card" onSubmit={join}>
          <h2>Entrar no duelo</h2>
          <label>
            <span>Código da sala</span>
            <input
              className="code-input"
              value={code}
              onFocus={wake}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              placeholder="ABCD"
              autoComplete="off"
              aria-label="Código da sala"
              required
            />
          </label>
          <label>
            <span>Seu nome</span>
            <input value={name} onFocus={wake} onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))} placeholder="Como a turma te conhece" aria-label="Seu nome" required minLength={2} />
          </label>
          <button type="submit" className="btn primary big" disabled={!!busy || code.length < 4 || name.trim().length < 2}>
            {busy === 'join' ? 'Entrando…' : 'Entrar na sala'}
          </button>
          {err && <p className="error" role="alert">{err}</p>}
          {slow && <p className="hint">Acordando o servidor gratuito… pode levar até 1 minuto.</p>}
          <div className="home-teacher">
            <span>É o professor?</span>
            <button type="button" className="btn ghost" disabled={!!busy} onClick={host}><Icon name="tv" /> {busy === 'host' ? 'Abrindo…' : 'Abrir a TV'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
