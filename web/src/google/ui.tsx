// Peças comuns das réplicas do Google Documentos e Planilhas: ícones, logos, cabeçalho, menus suspensos e painel lateral.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ICONS, type IconName } from './icons.ts';

const BAR = 'M80 0v-160h800V0H80Z'; // barra de cor embaixo dos ícones de cor: desenhada à parte com a cor escolhida

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path d={ICONS[name].replace(BAR, '')} />
    </svg>
  );
}

// Ícone com a barra de cor por baixo (cor do texto, preenchimento).
export function ColorIcon({ name, color }: { name: IconName; color: string }) {
  return (
    <span className="g-coloricon">
      <Icon name={name} />
      <i style={{ background: color }} />
    </span>
  );
}

export function DocsLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="gd-logo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a9cff" />
          <stop offset="1" stopColor="#2f6ef6" />
        </linearGradient>
      </defs>
      <path d="M11 6h13l8 8v18.5a2.5 2.5 0 0 1-2.5 2.5h-18A2.5 2.5 0 0 1 9 32.5v-24A2.5 2.5 0 0 1 11 6z" fill="url(#gd-logo)" />
      <path d="M24 6l8 8h-5.5A2.5 2.5 0 0 1 24 11.5z" fill="#a8c7fa" />
      <rect x="14" y="20" width="12" height="2.2" rx="1.1" fill="#fff" />
      <rect x="14" y="25" width="8.5" height="2.2" rx="1.1" fill="#fff" />
    </svg>
  );
}

export function SheetsLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="gs-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1fc46b" />
          <stop offset="1" stopColor="#0f9d58" />
        </linearGradient>
        <linearGradient id="gs-logo2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#57e0a0" />
          <stop offset="1" stopColor="#8ef0c4" />
        </linearGradient>
      </defs>
      <rect x="6" y="9" width="28" height="22" rx="5" fill="url(#gs-logo)" />
      <path d="M22 9h7a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5h-7z" fill="url(#gs-logo2)" opacity=".75" />
      <rect x="10" y="14" width="13" height="2.6" rx="1.3" fill="#fff" />
      <rect x="10" y="14" width="2.6" height="13" rx="1.3" fill="#fff" />
    </svg>
  );
}

// Paleta do Google: 8 linhas × 10 cores, com os nomes que aparecem ao passar o mouse.
const HUES = ['vermelho berry', 'vermelho', 'laranja', 'amarelo', 'verde', 'ciano', 'azul centáurea', 'azul', 'roxo', 'magenta'];
const GRID = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
  ['#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47'],
  ['#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'],
];
const GREYS = ['preto', 'cinza escuro 4', 'cinza escuro 3', 'cinza escuro 2', 'cinza escuro 1', 'cinza', 'cinza claro 1', 'cinza claro 2', 'cinza claro 3', 'branco'];
const SHADES = ['', '', 'claro 3', 'claro 2', 'claro 1', 'escuro 1', 'escuro 2', 'escuro 3'];
const colorName = (r: number, c: number) => (r === 0 ? GREYS[c] : `${HUES[c]} ${SHADES[r]}`.trim());

export function Palette({ onPick, resetLabel = 'Redefinir' }: { onPick: (color: string | null) => void; resetLabel?: string }) {
  return (
    <div className="g-palette">
      <button type="button" className="g-palette-reset" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(null)}>
        <Icon name="close" size={18} /> {resetLabel}
      </button>
      {GRID.map((row, r) => (
        <div key={r} className={`g-palette-row${r === 1 ? ' gap' : ''}`}>
          {row.map((hex, c) => (
            <button
              key={hex}
              type="button"
              className="g-swatch"
              style={{ background: hex }}
              title={colorName(r, c)}
              aria-label={colorName(r, c)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(hex)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Botão que abre um menu suspenso. Clicar fora fecha. Não rouba o foco do editor.
export function Drop({
  label, title, className = '', children, menuClass = '', disabled,
}: { label: ReactNode; title: string; className?: string; children: (close: () => void) => ReactNode; menuClass?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);
  return (
    <div className="g-drop" ref={ref}>
      <button
        type="button"
        className={`g-btn ${className}${open ? ' on' : ''}`}
        title={title}
        aria-label={title}
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && <div className={`g-menu ${menuClass}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Btn({
  icon, title, onClick, active, disabled, children, className = '',
}: { icon?: IconName; title: string; onClick?: () => void; active?: boolean; disabled?: boolean; children?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={`g-btn ${className}${active ? ' active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

// Caixa do tamanho da fonte: digita e Enter, ou escolhe na lista que abre ao clicar.
export function SizeBox({ value, sizes, onPick }: { value: number; sizes: number[]; onPick: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const [open, setOpen] = useState(false);
  useEffect(() => setText(String(value)), [value]);
  return (
    <div className="g-drop">
      <input
        className="g-sizebox"
        aria-label="Tamanho da fonte"
        title="Tamanho da fonte"
        value={text}
        inputMode="numeric"
        onFocus={(e) => (e.target.select(), setOpen(true))}
        onBlur={() => (setOpen(false), setText(String(value)))}
        onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          onPick(Number(text) || value);
          setOpen(false);
        }}
      />
      {open && (
        <div className="g-menu g-sizes">
          {sizes.map((s) => (
            <button key={s} type="button" className={`g-menu-item${s === value ? ' sel' : ''}`} onMouseDown={(e) => e.preventDefault()}
              onClick={() => (onPick(s), setOpen(false))}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export const Sep = () => <span className="g-sep" />;
export const Caret = () => <Icon name="arrow_drop_down" size={18} className="g-caret" />;

// Cabeçalho igual ao do Google: logo, título com estrela, menus e botões da direita.
export function AppHeader({ kind, title, menus, avatar }: { kind: 'docs' | 'sheets'; title: string; menus: string[]; avatar: { emoji: string; color: string; name: string } }) {
  return (
    <header className="g-head">
      <div className="g-logo" title={kind === 'docs' ? 'Página inicial do Documentos' : 'Página inicial do Planilhas'}>
        {kind === 'docs' ? <DocsLogo /> : <SheetsLogo />}
      </div>
      <div className="g-titlebox">
        <div className="g-titlerow">
          <span className="g-title">{title}</span>
          <Btn icon="star" title="Marcar com estrela" className="g-star" />
        </div>
        <nav className="g-menubar">
          {menus.map((m) => (
            <span key={m} className="g-menuitem">{m}</span>
          ))}
        </nav>
      </div>
      <div className="g-actions">
        <Btn icon="comment" title="Mostrar todos os comentários" className="g-round" />
        <button type="button" className="g-btn g-round g-meet" title="Participar de uma chamada aqui ou apresentar esta guia na chamada" onMouseDown={(e) => e.preventDefault()}>
          <Icon name="videocam" size={24} />
          <Icon name="arrow_drop_down" size={18} />
        </button>
        <div className="g-share">
          <button type="button" className="g-share-main" onMouseDown={(e) => e.preventDefault()}>
            <Icon name="lock" size={18} /> Compartilhar
          </button>
          <button type="button" className="g-share-drop" aria-label="Opções de compartilhamento" onMouseDown={(e) => e.preventDefault()}>
            <Icon name="arrow_drop_down" size={20} />
          </button>
        </div>
        <button type="button" className="g-upgrade" onMouseDown={(e) => e.preventDefault()}>Fazer upgrade</button>
        <span className="g-account" style={{ background: avatar.color }} title={avatar.name}>{avatar.emoji}</span>
      </div>
    </header>
  );
}

// Painel lateral no estilo do painel do Gemini: aqui fica o modelo do desafio e o tempo.
export function SidePanel({ title, heading, tips, timer, onExpand, children }: { title: string; heading: string; tips: string[]; timer: ReactNode; onExpand: () => void; children: ReactNode }) {
  return (
    <aside className="g-side">
      <div className="g-side-head">
        <Icon name="menu" />
        <span>{title}</span>
      </div>
      <div className="g-side-body">
        <p className="g-side-hello">{heading}</p>
        <button type="button" className="g-side-model" title="Ampliar o modelo" onClick={onExpand} onCopy={(e) => e.preventDefault()}>
          {children}
          <span className="g-side-expand"><Icon name="fullscreen" size={16} />Ampliar</span>
        </button>
        <ul className="g-side-tips">
          {tips.map((t) => (
            <li key={t}>
              <Icon name="subdirectory_arrow_right" size={18} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="g-side-foot">{timer}</div>
    </aside>
  );
}
