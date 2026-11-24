// Réplica do Google Documentos para o duelo. O texto fica num contenteditable e a formatação usa execCommand,
// que o Chrome (e o Chromebook) ainda implementa por completo.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AppHeader, Btn, Caret, ColorIcon, Drop, Icon, Palette, Sep, SizeBox } from './ui.tsx';
import type { IconName } from './icons.ts';

const MENUS = ['Arquivo', 'Editar', 'Ver', 'Inserir', 'Formatar', 'Ferramentas', 'Gemini', 'Extensões', 'Ajuda'];
const STYLES = [
  { tag: 'p', label: 'Texto normal' },
  { tag: 'h1', label: 'Título' },
  { tag: 'h6', label: 'Subtítulo' },
  { tag: 'h2', label: 'Título 1' },
  { tag: 'h3', label: 'Título 2' },
  { tag: 'h4', label: 'Título 3' },
];
const FONTS = ['Arial', 'Courier New', 'Georgia', 'Roboto', 'Times New Roman', 'Verdana'];
const SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96];
const ZOOMS = [50, 75, 90, 100, 125, 150, 200];
const ALIGNS: { cmd: string; icon: IconName; label: string }[] = [
  { cmd: 'justifyLeft', icon: 'format_align_left', label: 'Alinhar à esquerda' },
  { cmd: 'justifyCenter', icon: 'format_align_center', label: 'Centralizar' },
  { cmd: 'justifyRight', icon: 'format_align_right', label: 'Alinhar à direita' },
  { cmd: 'justifyFull', icon: 'format_align_justify', label: 'Justificar' },
];
const EMPTY = '<p><br></p>';

interface Fmt {
  bold: boolean; italic: boolean; underline: boolean; block: string; font: string; size: number; color: string;
  align: string; ul: boolean; ol: boolean;
}
const START: Fmt = { bold: false, italic: false, underline: false, block: 'p', font: 'Arial', size: 11, color: '#000000', align: 'justifyLeft', ul: false, ol: false };

const rgbToHex = (rgb: string) => {
  const m = rgb.match(/\d+/g);
  return m ? `#${m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, '0')).join('')}` : '#000000';
};

// Régua horizontal em centímetros, como a do Docs (página Carta: 21,59 cm, margens de 2,54 cm).
function Ruler() {
  const cm = 816 / 21.59;
  const marks: ReactNode[] = [];
  for (let q = -8; q <= 19 * 4 - 3; q++) {
    const x = 96 + (q / 4) * cm;
    if (x < 2 || x > 814) continue;
    const n = q / 4;
    if (q % 4 === 0 && q !== 0)
      marks.push(<text key={q} x={x} y={13} textAnchor="middle">{Math.abs(n)}</text>);
    else if (q !== 0) marks.push(<line key={q} x1={x} x2={x} y1={q % 2 ? 15 : 12} y2={17} />);
  }
  return (
    <svg className="gd-ruler" width={816} height={24} viewBox="0 0 816 24" aria-hidden="true">
      <rect x={0} y={4} width={96} height={16} className="m" />
      <rect x={720} y={4} width={96} height={16} className="m" />
      {marks}
      <path d="M90 2h12l-6 7z" className="ind" />
      <rect x={90} y={0} width={12} height={2.5} className="ind" />
      <path d="M714 2h12l-6 7z" className="ind" />
    </svg>
  );
}

function VRuler() {
  const cm = 1056 / 27.94;
  const marks: ReactNode[] = [];
  for (let q = -8; q <= 100; q++) {
    const y = 96 + (q / 4) * cm;
    if (y < 2 || y > 1054) continue;
    if (q % 4 === 0 && q !== 0) marks.push(<text key={q} x={8} y={y} transform={`rotate(-90 8 ${y})`} textAnchor="middle" dy={3}>{Math.abs(q / 4)}</text>);
    else if (q !== 0) marks.push(<line key={q} x1={q % 2 ? 11 : 8} x2={14} y1={y} y2={y} />);
  }
  return (
    <svg className="gd-vruler" width={16} height={1056} viewBox="0 0 16 1056" aria-hidden="true">
      <rect x={2} y={0} width={12} height={96} className="m" />
      {marks}
    </svg>
  );
}

export function DocsEditor({
  initial, onChange, locked, side, avatar,
}: { initial: string; onChange: (html: string) => void; locked: boolean; side: ReactNode; avatar: { emoji: string; color: string; name: string } }) {
  const ed = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const pendingSize = useRef(11);
  const [fmt, setFmt] = useState<Fmt>(START);
  const [zoom, setZoom] = useState(100);
  const [outline, setOutline] = useState(() => window.innerWidth >= 1640);
  const [heads, setHeads] = useState<{ tag: string; text: string }[]>([]);

  const refresh = useCallback(() => {
    const el = ed.current;
    const sel = getSelection();
    if (!el || !sel?.rangeCount || !el.contains(sel.anchorNode)) return;
    range.current = sel.getRangeAt(0).cloneRange();
    const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
    if (!node) return;
    const cs = getComputedStyle(node);
    const block = node.closest('h1,h2,h3,h4,h5,h6,p,li')?.tagName.toLowerCase() ?? 'p';
    const size = Math.round(parseFloat(cs.fontSize) * 0.75);
    const q = (c: string) => document.queryCommandState(c);
    setFmt({
      bold: q('bold'), italic: q('italic'), underline: q('underline'), block: block === 'li' ? 'p' : block,
      font: cs.fontFamily.split(',')[0].replace(/["']/g, '').replace('Arimo', 'Arial'),
      size, color: rgbToHex(cs.color), align: ALIGNS.find((a) => q(a.cmd))?.cmd ?? 'justifyLeft',
      ul: q('insertUnorderedList'), ol: q('insertOrderedList'),
    });
  }, []);

  const changed = useCallback(() => {
    const el = ed.current;
    if (!el) return;
    // Tamanho de fonte: o execCommand só conhece 1–7; trocamos o <font size=7> por um span em pt.
    el.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = `${pendingSize.current}pt`;
      span.append(...f.childNodes);
      f.replaceWith(span);
    });
    if (!el.innerHTML.trim()) el.innerHTML = EMPTY;
    setHeads([...el.querySelectorAll('h1,h2,h3,h4')].map((h) => ({ tag: h.tagName.toLowerCase(), text: h.textContent ?? '' })).filter((h) => h.text.trim()));
    onChange(el.innerHTML);
  }, [onChange]);

  useLayoutEffect(() => {
    const el = ed.current!;
    el.innerHTML = initial || EMPTY;
    document.execCommand('defaultParagraphSeparator', false, 'p');
    changed();
    el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refresh);
    return () => document.removeEventListener('selectionchange', refresh);
  }, [refresh]);

  // Volta a seleção para o texto (o clique num menu ou no campo de tamanho tira o foco) e aplica o comando.
  const exec = (cmd: string, value?: string, css = true) => {
    const el = ed.current;
    if (!el || locked) return;
    el.focus();
    const sel = getSelection();
    if (range.current && sel) {
      sel.removeAllRanges();
      sel.addRange(range.current);
    }
    document.execCommand('styleWithCSS', false, String(css));
    document.execCommand(cmd, false, value);
    changed();
    refresh();
  };

  const setSize = (pt: number) => {
    pendingSize.current = Math.max(1, Math.min(400, Math.round(pt)));
    exec('fontSize', '7', false);
  };
  const stepSize = (dir: 1 | -1) => {
    const cur = fmt.size;
    const next = dir > 0 ? SIZES.find((s) => s > cur) ?? cur + 1 : [...SIZES].reverse().find((s) => s < cur) ?? Math.max(1, cur - 1);
    setSize(next);
  };

  const styleLabel = STYLES.find((s) => s.tag === fmt.block)?.label ?? 'Texto normal';
  const alignIcon = ALIGNS.find((a) => a.cmd === fmt.align)?.icon ?? 'format_align_left';

  // Botões que o duelo não usa: em telas estreitas (Chromebook com o painel do desafio) vão para o "⋮".
  const extra1 = (
    <>
      <Btn icon="link" title="Inserir link (Ctrl+K)" />
      <Btn icon="add_comment" title="Adicionar comentário (Ctrl+Alt+M)" />
      <Btn icon="image" title="Inserir imagem" />
      <Sep />
    </>
  );
  const extra2 = (
    <>
      <Btn icon="format_line_spacing" title="Espaçamento entre linhas e parágrafos" />
      <Drop title="Lista de verificação" label={<><Icon name="checklist" /><Caret /></>}>{() => <p className="g-menu-note">Use a lista com marcadores no duelo.</p>}</Drop>
    </>
  );
  const extra3 = (
    <>
      <Btn icon="format_indent_decrease" title="Diminuir recuo (Ctrl+[)" onClick={() => exec('outdent')} />
      <Btn icon="format_indent_increase" title="Aumentar recuo (Ctrl+])" onClick={() => exec('indent')} />
      <Btn icon="format_clear" title="Limpar formatação (Ctrl+\)" onClick={() => exec('removeFormat')} />
    </>
  );
  const extra0 = (
    <>
      <Btn icon="spellcheck" title="Verificação ortográfica e gramatical (Ctrl+Alt+X)" />
      <Btn icon="format_paint" title="Pintar formatação" />
    </>
  );

  return (
    <div className={`g-app gd${locked ? ' locked' : ''}`}>
      <AppHeader kind="docs" title="Documento sem título" menus={MENUS} avatar={avatar} />
      <div className="g-main">
        <div className="g-work">
          <div className="g-toolbar gd-tb">
            <div className="g-search"><Icon name="search" size={18} /><span>Menus</span></div>
            <Btn icon="undo" title="Desfazer (Ctrl+Z)" onClick={() => exec('undo')} />
            <Btn icon="redo" title="Refazer (Ctrl+Y)" onClick={() => exec('redo')} />
            <Btn icon="print" title="Imprimir (Ctrl+P)" />
            <div className="tb-tail">{extra0}</div>
            <Drop title="Zoom" className="g-select w64" label={<><span>{zoom}%</span><Caret /></>}>
              {(close) => ZOOMS.map((z) => (
                <button key={z} type="button" className={`g-menu-item${z === zoom ? ' sel' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => (setZoom(z), close())}>{z}%</button>
              ))}
            </Drop>
            <Sep />
            <Drop title="Estilos" className="g-select w110" label={<><span className="ellip">{styleLabel}</span><Caret /></>} menuClass="gd-styles">
              {(close) => STYLES.map((s) => (
                <button key={s.tag} type="button" className={`g-menu-item gd-st-${s.tag}${s.tag === fmt.block ? ' sel' : ''}`} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (exec('formatBlock', s.tag), close())}>{s.label}</button>
              ))}
            </Drop>
            <Sep />
            <Drop title="Fonte" className="g-select w100" label={<><span className="ellip">{fmt.font}</span><Caret /></>}>
              {(close) => FONTS.map((f) => (
                <button key={f} type="button" className={`g-menu-item${f === fmt.font ? ' sel' : ''}`} style={{ fontFamily: f }} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (exec('fontName', f), close())}>{f}</button>
              ))}
            </Drop>
            <Sep />
            <Btn icon="remove" title="Diminuir tamanho da fonte (Ctrl+Shift+,)" onClick={() => stepSize(-1)} />
            <SizeBox value={fmt.size} sizes={SIZES} onPick={setSize} />
            <Btn icon="add" title="Aumentar tamanho da fonte (Ctrl+Shift+.)" onClick={() => stepSize(1)} />
            <Sep />
            <Btn icon="format_bold" title="Negrito (Ctrl+B)" active={fmt.bold} onClick={() => exec('bold')} />
            <Btn icon="format_italic" title="Itálico (Ctrl+I)" active={fmt.italic} onClick={() => exec('italic')} />
            <Btn icon="format_underlined" title="Sublinhado (Ctrl+U)" active={fmt.underline} onClick={() => exec('underline')} />
            <Drop title="Cor do texto" label={<ColorIcon name="format_color_text" color={fmt.color} />}>
              {(close) => <Palette onPick={(c) => (exec('foreColor', c ?? '#000000'), close())} />}
            </Drop>
            <Drop title="Cor de destaque" label={<Icon name="ink_highlighter" />}>
              {(close) => <Palette resetLabel="Nenhuma" onPick={(c) => (exec('hiliteColor', c ?? 'transparent'), close())} />}
            </Drop>
            <Sep />
            <div className="tb-tail">{extra1}</div>
            <Drop title="Alinhar e recuar" label={<><Icon name={alignIcon} /><Caret /></>} menuClass="g-menu-row">
              {(close) => ALIGNS.map((a) => (
                <Btn key={a.cmd} icon={a.icon} title={a.label} active={fmt.align === a.cmd} onClick={() => (exec(a.cmd), close())} />
              ))}
            </Drop>
            <div className="tb-tail">{extra2}</div>
            <Drop title="Lista com marcadores (Ctrl+Shift+8)" className={fmt.ul ? 'active' : ''} label={<><Icon name="format_list_bulleted" /><Caret /></>}>
              {(close) => <button type="button" className="g-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => (exec('insertUnorderedList'), close())}>● Marcadores</button>}
            </Drop>
            <Drop title="Lista numerada (Ctrl+Shift+7)" className={fmt.ol ? 'active' : ''} label={<><Icon name="format_list_numbered" /><Caret /></>}>
              {(close) => <button type="button" className="g-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => (exec('insertOrderedList'), close())}>1. 2. 3. Numeração</button>}
            </Drop>
            <div className="tb-tail">{extra3}</div>
            <Drop title="Mais" className="tb-more" label={<Icon name="more_vert" />} menuClass="g-menu-row wrap">{() => <>{extra0}{extra1}{extra2}{extra3}</>}</Drop>
            <div className="g-tb-right">
              <button type="button" className="g-btn gd-mode" onMouseDown={(e) => e.preventDefault()}>
                <Icon name="edit" /><span>Edição</span><Caret />
              </button>
              <Sep />
              <Btn icon="keyboard_arrow_up" title="Ocultar os menus (Ctrl+Shift+F)" />
            </div>
          </div>
          <div className="gd-canvas" style={{ ['--ol' as string]: outline ? '250px' : '56px' }}>
            {outline ? (
              <div className="gd-outline">
                <Btn icon="arrow_back" title="Fechar guias e estrutura de tópicos" className="g-round" onClick={() => setOutline(false)} />
                <div className="gd-ol-head"><span>Guias no documento</span><Btn icon="add" title="Adicionar guia" /></div>
                <div className="gd-ol-tab"><Icon name="article" /><span>Guia 1</span><Icon name="more_vert" /></div>
                {heads.length ? (
                  <ul className="gd-ol-list">
                    {heads.map((h, i) => <li key={i} className={`ol-${h.tag}`}>{h.text}</li>)}
                  </ul>
                ) : (
                  <p className="gd-ol-note">Os títulos que forem adicionados ao documento aparecerão aqui.</p>
                )}
              </div>
            ) : (
              <div className="gd-outline closed">
                <Btn icon="article" title="Mostrar guias e estrutura de tópicos" className="g-round" onClick={() => setOutline(true)} />
              </div>
            )}
            <div className="gd-scroll">
              <div className="gd-center">
                <VRuler />
                <div className="gd-zoom" style={{ zoom: zoom / 100 }}>
                  <div className="gd-rulerbar"><Ruler /></div>
                  <div
                    ref={ed}
                    className="gd-page gd-content gd-editable"
                    contentEditable={!locked}
                    suppressContentEditableWarning
                    spellCheck={false}
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Documento"
                    onInput={changed}
                    onKeyUp={refresh}
                    onMouseUp={refresh}
                    onPaste={(e) => {
                      e.preventDefault(); // cola só o texto: a formatação tem que ser feita no duelo
                      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                    }}
                    onDrop={(e) => e.preventDefault()}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {side}
      </div>
    </div>
  );
}
