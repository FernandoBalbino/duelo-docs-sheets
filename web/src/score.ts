// Quanto o trabalho do aluno chegou perto do modelo (0–100%). Roda na TV, sem servidor.
// Metade da nota é o texto (Docs) ou os valores (Sheets); a outra metade é cada formatação do modelo (negrito, cor,
// estilo de título, alinhamento, R$, bordas...), com desconto para formatação que o modelo não tem.
// As partes que viram a lista de critérios ✓/✗ na TV são as mesmas que formam a %.
import type { Challenge } from '../../shared/challenges.ts';
import { display, parseCells, parseRef, refOf, toNumber, type Cell, type Cells } from '../../shared/sheet.ts';
import { colorLabel } from './google/palette.ts';

export interface Criterion { label: string; ok: boolean; pct: number }
export interface Score { pct: number; criteria: Criterion[] }
type Attrs = Record<string, string>; // só valores fora do padrão; '' = padrão

// ---------- distância de edição com alinhamento (quais letras do aluno correspondem a quais do modelo)
function align(a: string[], b: string[]) {
  const n = a.length;
  const m = b.length;
  const W = m + 1;
  const dir = new Uint8Array((n + 1) * W); // 0 = diagonal, 1 = cima (faltou), 2 = esquerda (sobrou)
  let prev = new Uint32Array(W);
  let cur = new Uint32Array(W);
  for (let j = 0; j <= m; j++) (prev[j] = j), (dir[j] = 2);
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    dir[i * W] = 1;
    for (let j = 1; j <= m; j++) {
      let best = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      let d = 0;
      if (prev[j] + 1 < best) (best = prev[j] + 1), (d = 1);
      if (cur[j - 1] + 1 < best) (best = cur[j - 1] + 1), (d = 2);
      cur[j] = best;
      dir[i * W + j] = d;
    }
    [prev, cur] = [cur, prev];
  }
  const pairs: [number, number][] = [];
  for (let i = n, j = m; i > 0 || j > 0;) {
    const d = i > 0 && j > 0 ? dir[i * W + j] : i > 0 ? 1 : 2;
    if (d === 0) {
      if (a[i - 1] === b[j - 1]) pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (d === 1) i--;
    else j--;
  }
  return { dist: prev[m], pairs };
}
const similar = (a: string, b: string) => (a || b ? 1 - align([...a], [...b]).dist / Math.max(a.length, b.length) : 1);

// ---------- cores e estilos
function hex(raw: string): string {
  const c = raw.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)$/.exec(c);
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) === 0)) return '';
  return `#${rgb.slice(1, 4).map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`;
}
const ptOf = (v: string) => String(Math.round(parseFloat(v) * (v.trim().endsWith('px') ? 0.75 : 1)));

function attrsOf(tag: string, raw: string): Attrs {
  const a: Attrs = {};
  if (tag === 'b' || tag === 'strong') a.b = '1';
  if (tag === 'i' || tag === 'em') a.i = '1';
  if (tag === 'u') a.u = '1';
  if (tag === 's' || tag === 'strike') a.s = '1';
  if (/^h[1-6]$/.test(tag)) a.tag = tag;
  if (tag === 'ul' || tag === 'ol') a.list = tag;
  const style = /style\s*=\s*"([^"]*)"/i.exec(raw)?.[1] ?? '';
  for (const [, key, value] of style.matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)) {
    const v = value.trim().toLowerCase();
    switch (key.toLowerCase()) {
      case 'font-weight': a.b = v === 'bold' || Number(v) >= 600 ? '1' : ''; break;
      case 'font-style': a.i = v === 'italic' ? '1' : ''; break;
      case 'text-decoration': case 'text-decoration-line':
        a.u = v.includes('underline') ? '1' : '';
        a.s = v.includes('line-through') ? '1' : '';
        break;
      case 'color': a.color = hex(v) === '#000000' ? '' : hex(v); break;
      case 'background-color': a.bg = hex(v) === '#ffffff' ? '' : hex(v); break;
      case 'font-size': a.size = ptOf(v) === '11' ? '' : ptOf(v); break;
      case 'font-family': { const f = v.split(',')[0].replace(/["']/g, '').trim(); a.font = /^(arial|arimo)$/.test(f) ? '' : f; break; }
      case 'text-align': a.align = ['center', 'right', 'justify'].includes(v) ? v : ''; break;
    }
  }
  return a;
}

// ---------- Documentos: HTML (já filtrado) → letras com seus estilos, blocos separados por "\n"
interface Ch { c: string; a: Attrs }
const BLOCKS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'" };

export function docChars(html: string): Ch[] {
  const blocks: Ch[][] = [];
  const stack: { tag: string; a: Attrs; block?: Ch[] }[] = [{ tag: '', a: {} }];
  let cur: Ch[] | null = null;
  for (const m of html.matchAll(/<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g)) {
    if (m[4] != null) {
      const text = m[4].replace(/&(#?\w+);/g, (all, e: string) => ENT[e] ?? (e[0] === '#' ? String.fromCharCode(Number(e.slice(1))) : all));
      if (!cur) {
        if (!text.trim()) continue;
        blocks.push((cur = [])); // texto solto vira parágrafo
      }
      const a = stack[stack.length - 1].a;
      for (const c of text) cur.push({ c, a });
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const i = stack.map((s) => s.tag).lastIndexOf(tag);
      if (i > 0) stack.length = i;
      cur = stack.findLast((s) => s.block)?.block ?? null;
      continue;
    }
    if (tag === 'br' || m[3].endsWith('/')) continue;
    const entry: { tag: string; a: Attrs; block?: Ch[] } = { tag, a: { ...stack[stack.length - 1].a, ...attrsOf(tag, m[3]) } };
    if (BLOCKS.has(tag)) blocks.push((cur = entry.block = []));
    stack.push(entry);
  }
  // Espaços repetidos contam como um; blocos vazios somem.
  const out: Ch[] = [];
  for (const b of blocks) {
    const line: Ch[] = [];
    for (const { c, a } of b) {
      const ch = /\s/.test(c) ? ' ' : c;
      if (ch === ' ' && (!line.length || line[line.length - 1].c === ' ')) continue;
      line.push({ c: ch, a });
    }
    while (line.at(-1)?.c === ' ') line.pop();
    if (!line.length) continue;
    if (out.length) out.push({ c: '\n', a: {} });
    out.push(...line);
  }
  return out;
}

// ---------- critérios a partir das formatações do modelo
const TAGS: Record<string, string> = { h1: 'Estilo Título', h6: 'Estilo Subtítulo', h2: 'Estilo Título 1', h3: 'Estilo Título 2', h4: 'Estilo Título 3', h5: 'Estilo Título 4' };
function label(k: string, v: string, fill: string) {
  switch (k) {
    case 'b': return 'Negrito';
    case 'i': return 'Itálico';
    case 'u': return 'Sublinhado';
    case 's': return 'Tachado';
    case 'bd': return 'Bordas';
    case 'tag': return TAGS[v] ?? v;
    case 'list': return v === 'ul' ? 'Lista com marcadores' : 'Lista numerada';
    case 'align': return { center: 'Centralizado', right: 'Alinhado à direita', justify: 'Justificado', left: 'Alinhado à esquerda' }[v] ?? v;
    case 'color': return `Cor do texto: ${colorLabel(v)}`;
    case 'bg': return `${fill}: ${colorLabel(v)}`;
    case 'size': return `Tamanho ${v}`;
    case 'font': return `Fonte ${v}`;
    case 'fmt': return v === 'brl' ? 'Formato R$' : 'Formato %';
  }
  return k;
}

// model/student: estilos de cada item (letra ou célula); pairs: itens que correspondem; counted: itens do modelo que contam.
function judge(base: number, baseLabel: string, fill: string, model: Attrs[], student: Attrs[], pairs: [number, number][], counted: boolean[]): Score {
  const feats = new Map<string, { k: string; v: string; total: number; hit: number }>();
  model.forEach((a, i) => {
    if (!counted[i]) return;
    for (const [k, v] of Object.entries(a)) {
      if (!v) continue;
      const f = feats.get(`${k}=${v}`) ?? { k, v, total: 0, hit: 0 };
      f.total++;
      feats.set(`${k}=${v}`, f);
    }
  });
  let extra = 0;
  let right = 0;
  for (const [i, j] of pairs) {
    if (counted[i]) for (const f of feats.values()) if (model[i][f.k] === f.v && student[j][f.k] === f.v) f.hit++;
    for (const [k, v] of Object.entries(student[j])) {
      if (!v) continue;
      extra++;
      if (model[i][k] === v) right++;
    }
  }
  const list = [...feats.values()].sort((x, y) => y.total - x.total);
  const recall = list.map((f) => f.hit / f.total);
  const precision = extra ? right / extra : 1;
  const format = (recall.length ? recall.reduce((s, x) => s + x, 0) / recall.length : precision) * (0.5 + 0.5 * precision);
  return {
    pct: Math.round(100 * (0.5 * base + 0.5 * format)),
    criteria: [
      { label: baseLabel, ok: base >= 0.9, pct: base },
      ...list.map((f, k) => ({ label: label(f.k, f.v, fill), ok: recall[k] >= 0.7, pct: recall[k] })),
      { label: 'Sem formatação a mais', ok: pairs.length > 0 && precision >= 0.8, pct: pairs.length ? precision : 0 },
    ],
  };
}

export function scoreDoc(modelHtml: string, html: string): Score {
  const M = docChars(modelHtml);
  // shortcut: texto muito maior que o modelo é cortado para a conta não travar a TV; só importa se alguém colar um livro.
  const S = docChars(html).slice(0, M.length * 2 + 80);
  const { dist, pairs } = align(M.map((x) => x.c), S.map((x) => x.c));
  const text = M.length || S.length ? 1 - dist / Math.max(M.length, S.length) : 1;
  return judge(text, 'Texto igual ao modelo', 'Marca-texto', M.map((x) => x.a), S.map((x) => x.a), pairs, M.map((x) => x.c.trim() !== ''));
}

// ---------- Planilhas: célula a célula (o aluno pode ter começado a tabela em outra posição)
const cellAttrs = (c: Cell | undefined): Attrs => ({
  b: c?.b ? '1' : '', i: c?.i ? '1' : '', s: c?.s ? '1' : '', bd: c?.bd ? '1' : '',
  color: c?.fc && c.fc.toLowerCase() !== '#000000' ? c.fc.toLowerCase() : '',
  bg: c?.bg && c.bg.toLowerCase() !== '#ffffff' ? c.bg.toLowerCase() : '',
  size: c?.fs && c.fs !== 10 ? String(c.fs) : '', font: c?.ff && c.ff !== 'Arial' ? c.ff : '', fmt: c?.fmt ?? '',
  align: c?.al ? { l: 'left', c: 'center', r: 'right' }[c.al] : '',
});
function corner(cells: Cells) {
  let r = Infinity;
  let c = Infinity;
  for (const [ref, cell] of Object.entries(cells)) {
    const p = parseRef(ref);
    if (p && (cell.v || cell.bg || cell.bd)) (r = Math.min(r, p.r)), (c = Math.min(c, p.c));
  }
  return { r, c };
}
function sameValue(a: Cell | undefined, b: Cell | undefined) {
  const x = toNumber(a?.v);
  const y = toNumber(b?.v);
  if (x != null && y != null) return x === y ? 1 : 0;
  return similar(display(a).text.trim(), display(b).text.trim());
}

export function scoreSheet(model: Cells, cells: Cells): Score {
  const m0 = corner(model);
  const s0 = corner(cells);
  const dr = Number.isFinite(s0.r) ? s0.r - m0.r : 0;
  const dc = Number.isFinite(s0.c) ? s0.c - m0.c : 0;
  const shifted: Cells = {};
  for (const [ref, cell] of Object.entries(cells)) {
    const p = parseRef(ref)!;
    if (p.r - dr >= 0 && p.c - dc >= 0) shifted[refOf(p.r - dr, p.c - dc)] = cell;
  }
  const refs = [...new Set([...Object.keys(model), ...Object.keys(shifted)])];
  let sum = 0;
  let n = 0;
  for (const ref of refs) {
    if (!model[ref]?.v && !shifted[ref]?.v) continue;
    n++;
    if (model[ref]?.v && shifted[ref]?.v) sum += sameValue(model[ref], shifted[ref]);
  }
  return judge(n ? sum / n : 1, 'Valores iguais ao modelo', 'Preenchimento', refs.map((r) => cellAttrs(model[r])), refs.map((r) => cellAttrs(shifted[r])),
    refs.map((_, i) => [i, i]), refs.map((r) => !!model[r]));
}

// Trabalho do aluno: Docs = HTML já filtrado por sanitizeDoc; Sheets = JSON das células.
export const scoreWork = (ch: Challenge, data: string): Score =>
  ch.kind === 'docs' ? scoreDoc(ch.html, data) : scoreSheet(ch.cells, parseCells(data || '{}'));
