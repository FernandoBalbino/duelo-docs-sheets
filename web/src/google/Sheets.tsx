// Réplica do Google Planilhas para o duelo: grade A–Z × 1–100, seleção com mouse e teclado,
// digitação direto na célula, barra de fórmulas e formatação (negrito, cores, bordas, R$...).
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';
import {
  COLS, COL_W, FONTS, ROWS, colName, display, refOf, rowHeight, toNumber, type Align, type Cell, type Cells,
} from '../../../shared/sheet.ts';
import { AppHeader, Btn, Caret, ColorIcon, Drop, Icon, Palette, Sep, SizeBox } from './ui.tsx';
import type { IconName } from './icons.ts';

const MENUS = ['Arquivo', 'Editar', 'Ver', 'Inserir', 'Formatar', 'Dados', 'Ferramentas', 'Gemini', 'Extensões', 'Ajuda'];
const SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 18, 24, 36];
const ZOOMS = [50, 75, 90, 100, 125, 150, 200];
const HEAD_H = 20;
const RH_W = 46;
const ALIGNS: { al: Align; icon: IconName; label: string }[] = [
  { al: 'l', icon: 'format_align_left', label: 'Esquerda' },
  { al: 'c', icon: 'format_align_center', label: 'Centro' },
  { al: 'r', icon: 'format_align_right', label: 'Direita' },
];

const cellCss = (cell: Cell | undefined): CSSProperties => ({
  background: cell?.bg,
  color: cell?.fc,
  fontWeight: cell?.b ? 700 : undefined,
  fontStyle: cell?.i ? 'italic' : undefined,
  textDecoration: cell?.s ? 'line-through' : undefined,
  fontSize: cell?.fs ? `${cell.fs}pt` : undefined,
  fontFamily: cell?.ff,
});

// Uma linha da grade. Só redesenha quando as células dela mudam (a grade tem 2.600 células).
const Row = memo(
  function Row({ r, cols, cells, h, sel }: { r: number; cols: number; cells: Cells; h: number; sel: boolean; sig: string }) {
    const out: ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = cells[refOf(r, c)];
      const { text, align } = display(cell);
      const ov = text && align === 'l' && c < cols - 1 && !cells[refOf(r, c + 1)]?.v; // texto longo invade a vizinha vazia
      out.push(
        <div key={c} className={`gs-c${cell?.bd ? ' bd' : ''}`} data-r={r} data-c={c} style={cellCss(cell)}>
          {text && <div className={`gs-t ${align}${ov ? ' ov' : ''}`}>{text}</div>}
        </div>,
      );
    }
    return (
      <div className="gs-row" style={{ height: h }}>
        <div className={`gs-rh${sel ? ' sel' : ''}`} data-row={r}>{r + 1}</div>
        {out}
      </div>
    );
  },
  (a, b) => a.sig === b.sig && a.h === b.h && a.sel === b.sel && a.cols === b.cols,
);

const rowSig = (cells: Cells, r: number, cols: number) => {
  let s = '';
  for (let c = 0; c < cols; c++) {
    const cell = cells[refOf(r, c)];
    if (cell) s += `${c}${JSON.stringify(cell)}`;
  }
  return s;
};

function ColHeads({ cols, from = -1, to = -1 }: { cols: number; from?: number; to?: number }) {
  return (
    <div className="gs-colheads" style={{ height: HEAD_H }}>
      <div className="gs-corner" />
      {Array.from({ length: cols }, (_, c) => (
        <div key={c} className={`gs-ch${c >= from && c <= to ? ' sel' : ''}`} data-col={c}>{colName(c)}</div>
      ))}
    </div>
  );
}

// Planilha só para ver (TV, votação e modelo do desafio).
export function SheetGrid({ cells, rows, cols }: { cells: Cells; rows: number; cols: number }) {
  return (
    <div className="gs-sheet gs-static" style={{ width: RH_W + cols * COL_W }}>
      <ColHeads cols={cols} />
      {Array.from({ length: rows }, (_, r) => (
        <Row key={r} r={r} cols={cols} cells={cells} h={rowHeight(cells, r)} sel={false} sig={rowSig(cells, r, cols)} />
      ))}
    </div>
  );
}

interface Sel { r: number; c: number; r2: number; c2: number }
const box = (s: Sel) => ({ r0: Math.min(s.r, s.r2), r1: Math.max(s.r, s.r2), c0: Math.min(s.c, s.c2), c1: Math.max(s.c, s.c2) });
const clamp = (n: number, max: number) => Math.max(0, Math.min(max - 1, n));

export function SheetsEditor({
  initial, onChange, locked, side, avatar,
}: { initial: Cells; onChange: (cells: Cells) => void; locked: boolean; side: ReactNode; avatar: { emoji: string; color: string; name: string } }) {
  const [cells, setCells] = useState<Cells>(initial);
  const [sel, setSel] = useState<Sel>({ r: 0, c: 0, r2: 0, c2: 0 });
  const [edit, setEdit] = useState<null | 'type' | 'edit'>(null);
  const [draft, setDraft] = useState('');
  const [zoom, setZoom] = useState(100);
  const undo = useRef<Cells[]>([]);
  const redo = useRef<Cells[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const tops = useMemo(() => {
    const t = [0];
    for (let r = 0; r < ROWS; r++) t.push(t[r] + rowHeight(cells, r));
    return t;
  }, [cells]);
  const { r0, r1, c0, c1 } = box(sel);
  const active = cells[refOf(sel.r, sel.c)];

  const commitCells = useCallback((next: Cells) => {
    undo.current.push(cells);
    if (undo.current.length > 60) undo.current.shift();
    redo.current = [];
    setCells(next);
    onChange(next);
  }, [cells, onChange]);

  const tidy = (cell: Cell) => {
    const out = { ...cell };
    for (const k of Object.keys(out) as (keyof Cell)[]) if (out[k] == null || out[k] === '') delete out[k];
    return out;
  };

  // Aplica uma mudança em todas as células selecionadas.
  const apply = (fn: (cell: Cell) => Partial<Cell>) => {
    if (locked) return;
    const next = { ...cells };
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const ref = refOf(r, c);
        const cell = tidy({ ...next[ref], ...fn(next[ref] ?? {}) });
        if (Object.keys(cell).length) next[ref] = cell;
        else delete next[ref];
      }
    commitCells(next);
    input.current?.focus();
  };
  const all = (key: keyof Cell) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!cells[refOf(r, c)]?.[key]) return false;
    return true;
  };
  const toggle = (key: 'b' | 'i' | 's') => {
    const on = !all(key);
    apply(() => ({ [key]: on ? 1 : undefined }));
  };
  const decimals = (cell: Cell) => cell.dec ?? (cell.fmt ? 2 : (String(toNumber(cell.v) ?? '').split('.')[1]?.length ?? 0));

  const startEdit = (mode: 'type' | 'edit', text: string) => {
    if (locked) return;
    setEdit(mode);
    setDraft(text);
  };
  const finishEdit = (save: boolean) => {
    if (edit && save && draft !== (active?.v ?? '')) {
      const ref = refOf(sel.r, sel.c);
      const cell = tidy({ ...cells[ref], v: draft });
      const next = { ...cells };
      if (Object.keys(cell).length) next[ref] = cell;
      else delete next[ref];
      commitCells(next);
    }
    setEdit(null);
    setDraft('');
  };
  const move = (dr: number, dc: number, extend = false) => {
    setSel((s) => {
      if (extend) return { ...s, r2: clamp(s.r2 + dr, ROWS), c2: clamp(s.c2 + dc, COLS) };
      const r = clamp(s.r + dr, ROWS);
      const c = clamp(s.c + dc, COLS);
      return { r, c, r2: r, c2: c };
    });
  };
  const history = (from: RefObject<Cells[]>, to: RefObject<Cells[]>) => {
    const prev = from.current.pop();
    if (!prev || locked) return;
    to.current.push(cells);
    setCells(prev);
    onChange(prev);
  };

  useEffect(() => {
    if (locked) finishEdit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  // Mantém a célula ativa visível ao andar com as setas.
  useEffect(() => {
    const g = grid.current;
    if (!g) return;
    const z = zoom / 100;
    const x = (RH_W + sel.c * COL_W) * z;
    const y = (HEAD_H + tops[sel.r]) * z;
    const h = (tops[sel.r + 1] - tops[sel.r]) * z;
    if (x < g.scrollLeft + RH_W * z) g.scrollLeft = x - RH_W * z;
    else if (x + COL_W * z > g.scrollLeft + g.clientWidth) g.scrollLeft = x + COL_W * z - g.clientWidth;
    if (y < g.scrollTop + HEAD_H * z) g.scrollTop = y - HEAD_H * z;
    else if (y + h > g.scrollTop + g.clientHeight) g.scrollTop = y + h - g.clientHeight;
  }, [sel.r, sel.c, tops, zoom]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (ctrl && (k === 'b' || k === 'i' || k === '5')) {
      e.preventDefault();
      if (edit) finishEdit(true);
      toggle(k === 'b' ? 'b' : k === 'i' ? 'i' : 's');
      return;
    }
    if (ctrl && (k === 'z' || k === 'y') && !edit) {
      e.preventDefault();
      if (k === 'z' && !e.shiftKey) history(undo, redo);
      else history(redo, undo);
      return;
    }
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (edit) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        finishEdit(true);
        if (e.key === 'Tab') move(0, e.shiftKey ? -1 : 1);
        else move(e.shiftKey ? -1 : 1, 0);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(false);
      } else if (arrows[e.key] && edit === 'type') {
        e.preventDefault();
        finishEdit(true);
        move(...arrows[e.key]);
      }
      return;
    }
    if (arrows[e.key]) {
      e.preventDefault();
      move(...arrows[e.key], e.shiftKey);
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startEdit('edit', active?.v ?? '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      move(0, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      apply(() => ({ v: undefined }));
    }
  };

  const cellAt = (e: MouseEvent | globalThis.MouseEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
    return t ? { r: Number(t.dataset.r), c: Number(t.dataset.c) } : null;
  };
  const onDown = (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t === input.current) return;
    e.preventDefault();
    if (edit) finishEdit(true);
    const col = t.closest<HTMLElement>('[data-col]');
    const row = t.closest<HTMLElement>('[data-row]');
    if (col) setSel({ r: 0, c: Number(col.dataset.col), r2: ROWS - 1, c2: Number(col.dataset.col) });
    else if (row) setSel({ r: Number(row.dataset.row), c: 0, r2: Number(row.dataset.row), c2: COLS - 1 });
    else if (t.closest('.gs-corner')) setSel({ r: 0, c: 0, r2: ROWS - 1, c2: COLS - 1 });
    else {
      const p = cellAt(e);
      if (!p) return;
      setSel((s) => (e.shiftKey ? { ...s, r2: p.r, c2: p.c } : { r: p.r, c: p.c, r2: p.r, c2: p.c }));
      dragging.current = true;
    }
    input.current?.focus();
  };
  useEffect(() => {
    const over = (e: globalThis.MouseEvent) => {
      if (!dragging.current) return;
      const p = cellAt(e);
      if (p) setSel((s) => (s.r2 === p.r && s.c2 === p.c ? s : { ...s, r2: p.r, c2: p.c }));
    };
    const up = () => (dragging.current = false);
    document.addEventListener('mousemove', over);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', over);
      document.removeEventListener('mouseup', up);
    };
  }, []);
  useEffect(() => input.current?.focus(), []);

  const selBox: CSSProperties = {
    left: RH_W + c0 * COL_W, top: HEAD_H + tops[r0], width: (c1 - c0 + 1) * COL_W + 1, height: tops[r1 + 1] - tops[r0] + 1,
  };
  const actBox: CSSProperties = {
    left: RH_W + sel.c * COL_W, top: HEAD_H + tops[sel.r], width: COL_W + 1, height: tops[sel.r + 1] - tops[sel.r] + 1,
  };
  const multi = r0 !== r1 || c0 !== c1;
  const nameBox = multi ? `${refOf(r0, c0)}:${refOf(r1, c1)}` : refOf(sel.r, sel.c);
  const font = active?.ff ?? 'Padrão (Arial)';
  const align = active?.al ?? display(active).align;

  const fmtBtn = (label: string, title: string, fn: () => void, cls = '') => (
    <button type="button" className={`g-btn g-txtbtn ${cls}`} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={fn}>{label}</button>
  );

  // Itens do fim da barra: somem em telas estreitas e vão para o botão "⋮".
  const tail = (
    <>
      <Btn icon="link" title="Inserir link (Ctrl+K)" />
      <Btn icon="add_comment" title="Inserir comentário (Ctrl+Alt+M)" />
      <Btn icon="insert_chart" title="Inserir gráfico" />
      <Btn icon="filter_alt" title="Criar um filtro" />
      <Drop title="Visualizações de tabela" label={<><Icon name="table_view" /><Caret /></>}>{() => <p className="g-menu-note">Não usado no duelo.</p>}</Drop>
      <Btn icon="functions" title="Funções" />
    </>
  );

  return (
    <div className={`g-app gs${locked ? ' locked' : ''}`}>
      <AppHeader kind="sheets" title="Planilha sem título" menus={MENUS} avatar={avatar} />
      <div className="g-main">
        <div className="g-work">
          <div className="g-toolbar gs-tb">
            <div className="g-search"><Icon name="search" size={18} /><span>Menus</span></div>
            <Btn icon="undo" title="Desfazer (Ctrl+Z)" onClick={() => history(undo, redo)} />
            <Btn icon="redo" title="Refazer (Ctrl+Y)" onClick={() => history(redo, undo)} />
            <Btn icon="print" title="Imprimir (Ctrl+P)" />
            <Btn icon="format_paint" title="Pintar formatação" />
            <Drop title="Zoom" className="g-select w64" label={<><span>{zoom}%</span><Caret /></>}>
              {(close) => ZOOMS.map((z) => (
                <button key={z} type="button" className={`g-menu-item${z === zoom ? ' sel' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => (setZoom(z), close())}>{z}%</button>
              ))}
            </Drop>
            <Sep />
            {fmtBtn('R$', 'Formatar como moeda', () => apply((c) => ({ fmt: c.fmt === 'brl' ? undefined : 'brl', dec: undefined })), active?.fmt === 'brl' ? 'active' : '')}
            {fmtBtn('%', 'Formatar como porcentagem', () => apply((c) => ({ fmt: c.fmt === 'pct' ? undefined : 'pct', dec: undefined })), active?.fmt === 'pct' ? 'active' : '')}
            <Btn icon="decimal_decrease" title="Diminuir casas decimais" onClick={() => apply((c) => ({ dec: Math.max(0, decimals(c) - 1) }))} />
            <Btn icon="decimal_increase" title="Aumentar casas decimais" onClick={() => apply((c) => ({ dec: Math.min(6, decimals(c) + 1) }))} />
            <Drop title="Mais formatos" className="g-txtbtn" label={<span>123</span>}>
              {(close) => (
                <button type="button" className="g-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => (apply(() => ({ fmt: undefined, dec: undefined })), close())}>Automático</button>
              )}
            </Drop>
            <Sep />
            <Drop title="Fonte" className="g-select w90" label={<><span className="ellip">{font}</span><Caret /></>}>
              {(close) => FONTS.map((f) => (
                <button key={f} type="button" className={`g-menu-item${f === active?.ff ? ' sel' : ''}`} style={{ fontFamily: f }} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (apply(() => ({ ff: f === 'Arial' ? undefined : f })), close())}>{f}</button>
              ))}
            </Drop>
            <Sep />
            <Btn icon="remove" title="Diminuir tamanho da fonte" onClick={() => apply((c) => ({ fs: [...SIZES].reverse().find((s) => s < (c.fs ?? 10)) ?? 6 }))} />
            <SizeBox value={active?.fs ?? 10} sizes={SIZES} onPick={(n) => apply(() => ({ fs: Math.max(6, Math.min(36, n)) === 10 ? undefined : Math.max(6, Math.min(36, n)) }))} />
            <Btn icon="add" title="Aumentar tamanho da fonte" onClick={() => apply((c) => ({ fs: SIZES.find((s) => s > (c.fs ?? 10)) ?? 36 }))} />
            <Sep />
            <Btn icon="format_bold" title="Negrito (Ctrl+B)" active={!!active?.b} onClick={() => toggle('b')} />
            <Btn icon="format_italic" title="Itálico (Ctrl+I)" active={!!active?.i} onClick={() => toggle('i')} />
            <Btn icon="strikethrough_s" title="Tachado (Alt+Shift+5)" active={!!active?.s} onClick={() => toggle('s')} />
            <Drop title="Cor do texto" label={<ColorIcon name="format_color_text" color={active?.fc ?? '#000000'} />}>
              {(close) => <Palette onPick={(c) => (apply(() => ({ fc: c ?? undefined })), close())} />}
            </Drop>
            <Sep />
            <Drop title="Cor de preenchimento" label={<Icon name="format_color_fill" />}>
              {(close) => <Palette onPick={(c) => (apply(() => ({ bg: c ?? undefined })), close())} />}
            </Drop>
            <Drop title="Bordas" label={<Icon name="border_all" />} menuClass="g-menu-row">
              {(close) => (
                <>
                  <Btn icon="border_all" title="Todas as bordas" onClick={() => (apply(() => ({ bd: 1 })), close())} />
                  <Btn icon="border_clear" title="Limpar bordas" onClick={() => (apply(() => ({ bd: undefined })), close())} />
                </>
              )}
            </Drop>
            <button type="button" className="g-btn" title="Mesclar células" aria-label="Mesclar células" disabled><Icon name="cell_merge" /><Caret /></button>
            <Sep />
            <Drop title="Alinhamento horizontal" label={<><Icon name={ALIGNS.find((a) => a.al === align)?.icon ?? 'format_align_left'} /><Caret /></>} menuClass="g-menu-row">
              {(close) => ALIGNS.map((a) => (
                <Btn key={a.al} icon={a.icon} title={a.label} active={active?.al === a.al} onClick={() => (apply(() => ({ al: a.al })), close())} />
              ))}
            </Drop>
            <div className="tb-tail">
              <Drop title="Alinhamento vertical" label={<><Icon name="vertical_align_bottom" /><Caret /></>}>{() => <p className="g-menu-note">Não usado no duelo.</p>}</Drop>
              <Drop title="Quebra de texto" label={<><Icon name="wrap_text" /><Caret /></>}>{() => <p className="g-menu-note">Não usado no duelo.</p>}</Drop>
              <Drop title="Rotação do texto" label={<><Icon name="text_rotation_none" /><Caret /></>}>{() => <p className="g-menu-note">Não usado no duelo.</p>}</Drop>
              <Sep />
              {tail}
            </div>
            <Drop title="Mais" className="tb-more" label={<Icon name="more_vert" />} menuClass="g-menu-row wrap">{() => tail}</Drop>
            <div className="g-tb-right">
              <Btn icon="keyboard_arrow_up" title="Ocultar os menus (Ctrl+Shift+F)" />
            </div>
          </div>
          <div className="gs-fbar">
            <div className="gs-namebox"><span>{nameBox}</span><Icon name="arrow_drop_down" size={18} /></div>
            <span className="gs-fx">fx</span>
            <input
              className="gs-formula"
              aria-label="Barra de fórmulas"
              value={edit ? draft : active?.v ?? ''}
              disabled={locked}
              onFocus={() => !edit && startEdit('edit', active?.v ?? '')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  finishEdit(true);
                  move(1, 0);
                  input.current?.focus();
                } else if (e.key === 'Escape') {
                  finishEdit(false);
                  input.current?.focus();
                }
              }}
            />
          </div>
          <div className="gs-grid" ref={grid}>
            <div className="gs-sheet" style={{ width: RH_W + COLS * COL_W, zoom: zoom / 100 }} onMouseDown={onDown}
              onDoubleClick={(e) => cellAt(e) && startEdit('edit', active?.v ?? '')}>
              <ColHeads cols={COLS} from={c0} to={c1} />
              {Array.from({ length: ROWS }, (_, r) => (
                <Row key={r} r={r} cols={COLS} cells={cells} h={tops[r + 1] - tops[r]} sel={r >= r0 && r <= r1} sig={rowSig(cells, r, COLS)} />
              ))}
              {multi && <div className="gs-range" style={selBox} />}
              <div className="gs-active" style={actBox}>{!edit && <i className="gs-handle" />}</div>
              <input
                ref={input}
                className={`gs-input${edit ? ' on' : ''}`}
                style={{ ...actBox, ...cellCss(active), textAlign: edit ? 'left' : undefined }}
                aria-label={`Célula ${refOf(sel.r, sel.c)}`}
                value={edit ? draft : ''}
                readOnly={locked}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => (edit ? setDraft(e.target.value) : startEdit('type', e.target.value))}
                onKeyDown={onKey}
                onPaste={(e) => {
                  if (edit) return;
                  e.preventDefault();
                  startEdit('type', e.clipboardData.getData('text/plain').split(/\r?\n/)[0]);
                }}
              />
            </div>
          </div>
          <div className="gs-bottom">
            <Btn icon="add" title="Adicionar página" className="g-round" />
            <Btn icon="menu" title="Todas as páginas" className="g-round" />
            <div className="gs-tab">Página1<Icon name="arrow_drop_down" size={18} /></div>
          </div>
        </div>
        {side}
      </div>
    </div>
  );
}
