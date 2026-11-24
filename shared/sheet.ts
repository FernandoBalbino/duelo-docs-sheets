// Modelo da planilha: só as células preenchidas, em JSON pequeno. Usado pelo editor, pela TV e pelos desafios.

export type Align = 'l' | 'c' | 'r';
export interface Cell {
  v?: string; // texto digitado
  b?: 1; // negrito
  i?: 1; // itálico
  s?: 1; // tachado
  fs?: number; // tamanho da fonte (pt)
  ff?: string; // fonte
  fc?: string; // cor do texto
  bg?: string; // cor de preenchimento
  al?: Align;
  bd?: 1; // todas as bordas
  fmt?: 'brl' | 'pct';
  dec?: number; // casas decimais
}
export type Cells = Record<string, Cell>;

export const COLS = 26;
export const ROWS = 100;
export const COL_W = 100;
export const ROW_H = 21;
export const FONTS = ['Arial', 'Roboto', 'Times New Roman', 'Courier New', 'Verdana'];

export const colName = (c: number) => String.fromCharCode(65 + c);
export const refOf = (r: number, c: number) => `${colName(c)}${r + 1}`;
export function parseRef(ref: string): { r: number; c: number } | null {
  const m = /^([A-Z])(\d{1,3})$/.exec(ref);
  if (!m) return null;
  const r = Number(m[2]) - 1;
  const c = m[1].charCodeAt(0) - 65;
  return r >= 0 && r < ROWS && c < COLS ? { r, c } : null;
}

// "A1:C3" → todas as referências do retângulo.
export function expand(range: string): string[] {
  const [p, q = p] = range.split(':').map(parseRef);
  if (!p || !q) throw new Error(`Intervalo inválido: ${range}`);
  const out: string[] = [];
  for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++)
    for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) out.push(refOf(r, c));
  return out;
}

// Monta uma planilha a partir de linhas de texto e estilos por intervalo (usado nos desafios).
export function sheet(rows: (string | null)[][], styles: Record<string, Cell> = {}): Cells {
  const cells: Cells = {};
  rows.forEach((row, r) => row.forEach((v, c) => {
    if (v != null && v !== '') cells[refOf(r, c)] = { v };
  }));
  for (const [range, st] of Object.entries(styles))
    for (const ref of range.split(',').flatMap((x) => expand(x.trim()))) cells[ref] = { ...cells[ref], ...st };
  return cells;
}

// Número no jeito brasileiro: "1.234,5", "12,50", "7" ou "3.5".
export function toNumber(v: string | undefined): number | null {
  const t = (v ?? '').trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  return null;
}

// Texto que aparece na célula e alinhamento (número vai para a direita, como no Sheets).
export function display(cell: Cell | undefined): { text: string; align: Align } {
  const v = cell?.v ?? '';
  const n = toNumber(v);
  const align = cell?.al ?? (n == null ? 'l' : 'r');
  if (n == null) return { text: v, align };
  const fixed = (x: number, d: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (cell?.fmt === 'brl') return { text: `R$ ${fixed(n, cell.dec ?? 2)}`, align };
  if (cell?.fmt === 'pct') return { text: `${fixed(n * 100, cell.dec ?? 2)}%`, align };
  if (cell?.dec != null) return { text: fixed(n, cell.dec), align };
  return { text: n.toLocaleString('pt-BR', { maximumFractionDigits: 10 }), align };
}

export const rowHeight = (cells: Cells, r: number) => {
  let max = 10;
  for (let c = 0; c < COLS; c++) max = Math.max(max, cells[refOf(r, c)]?.fs ?? 10);
  return Math.max(ROW_H, Math.ceil(max * 1.333 * 1.5));
};

// Maior linha/coluna usada (para a TV mostrar só o pedaço que importa).
export function bbox(cells: Cells): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const ref of Object.keys(cells)) {
    const p = parseRef(ref);
    if (p) [rows, cols] = [Math.max(rows, p.r + 1), Math.max(cols, p.c + 1)];
  }
  return { rows, cols };
}

// A planilha vem de outro aluno: só passam campos conhecidos com valores seguros.
const COLOR = /^#[0-9a-f]{3,8}$/i;
export function parseCells(json: string): Cells {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {};
  }
  const out: Cells = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [ref, c] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    if (!parseRef(ref) || !c || typeof c !== 'object') continue;
    const cell: Cell = {};
    if (typeof c.v === 'string') cell.v = c.v.slice(0, 200);
    for (const k of ['b', 'i', 's', 'bd'] as const) if (c[k] === 1) cell[k] = 1;
    if (typeof c.fs === 'number' && c.fs >= 6 && c.fs <= 36) cell.fs = c.fs;
    if (typeof c.ff === 'string' && FONTS.includes(c.ff)) cell.ff = c.ff;
    if (typeof c.fc === 'string' && COLOR.test(c.fc)) cell.fc = c.fc;
    if (typeof c.bg === 'string' && COLOR.test(c.bg)) cell.bg = c.bg;
    if (c.al === 'l' || c.al === 'c' || c.al === 'r') cell.al = c.al;
    if (c.fmt === 'brl' || c.fmt === 'pct') cell.fmt = c.fmt;
    if (typeof c.dec === 'number' && Number.isInteger(c.dec) && c.dec >= 0 && c.dec <= 6) cell.dec = c.dec;
    if (Object.keys(cell).length) out[ref] = cell;
  }
  return out;
}
