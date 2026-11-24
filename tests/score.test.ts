import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHALLENGES, CHALLENGE_BY_ID, type DocsChallenge, type SheetsChallenge } from '../shared/challenges.ts';
import { thinFrames } from '../shared/rules.ts';
import { refOf, parseRef, type Cells } from '../shared/sheet.ts';
import { scoreDoc, scoreSheet, scoreWork } from '../web/src/score.ts';

const doc = (id: string) => CHALLENGE_BY_ID.get(id) as DocsChallenge;
const sheetCh = (id: string) => CHALLENGE_BY_ID.get(id) as SheetsChallenge;
const crit = (s: ReturnType<typeof scoreDoc>, label: string) => s.criteria.find((c) => c.label === label);

test('os 46 modelos copiados igualzinho dão 100% e o vazio dá 0%', () => {
  assert.equal(CHALLENGES.length, 46);
  for (const ch of CHALLENGES) {
    const perfect = ch.kind === 'docs' ? ch.html : JSON.stringify(ch.cells);
    assert.equal(scoreWork(ch, perfect).pct, 100, ch.id);
    assert.equal(scoreWork(ch, ch.kind === 'docs' ? '<p><br></p>' : '{}').pct, 0, ch.id);
  }
});

test('Docs: HTML do Chrome (rgb, font-weight, text-align) conta igual ao modelo', () => {
  const chrome = '<h1 style="text-align: center;">Feira de Ciências</h1><p style="text-align: center;">Você está convidado!</p>'
    + '<p><span style="font-weight: bold;">Data:</span> 15 de outubro</p><p><b>Local:</b>&nbsp;quadra da escola</p>'
    + '<p>Traga sua <span style="color: rgb(255, 0, 0);">família</span>!</p>';
  assert.equal(scoreDoc(doc('d01').html, chrome).pct, 100);
});

test('Docs: só o texto fica no meio; formatação a mais tira ponto', () => {
  const m = doc('d01').html;
  const plain = scoreDoc(m, m.replace(/<(?!\/?p\b)[^>]*>/g, '').replace(/<h1[^>]*>|<\/h1>/g, ''));
  assert.ok(plain.pct >= 45 && plain.pct <= 60, `só texto: ${plain.pct}%`);
  assert.equal(crit(plain, 'Texto igual ao modelo')?.ok, true);
  for (const label of ['Estilo Título', 'Centralizado', 'Negrito', 'Cor do texto: vermelho']) assert.equal(crit(plain, label)?.ok, false, label);

  const allBold = scoreDoc(m, `<b>${m}</b>`);
  assert.ok(allBold.pct < 100 && allBold.pct > plain.pct, `tudo em negrito: ${allBold.pct}%`);
  assert.equal(crit(allBold, 'Sem formatação a mais')?.ok, false);

  const typo = scoreDoc(m, m.replace('Ciências', 'Ciencias'));
  assert.ok(typo.pct >= 95 && typo.pct < 100, `sem acento: ${typo.pct}%`);
});

test('Sheets: tabela em outra posição vale; só os valores fica no meio', () => {
  const ch = sheetCh('s19');
  const moved: Cells = {};
  for (const [ref, cell] of Object.entries(ch.cells)) {
    const p = parseRef(ref)!;
    moved[refOf(p.r + 2, p.c + 1)] = cell;
  }
  assert.equal(scoreSheet(ch.cells, moved).pct, 100);
  const values: Cells = Object.fromEntries(Object.entries(ch.cells).filter(([, c]) => c.v).map(([ref, c]) => [ref, { v: c.v }]));
  const s = scoreSheet(ch.cells, values);
  assert.ok(s.pct >= 45 && s.pct <= 60, `só valores: ${s.pct}%`);
  assert.equal(s.criteria.find((c) => c.label === 'Preenchimento: azul centáurea escuro 2')?.ok, false);
  // "R$ 25,00" digitado como texto vale como valor, mas não ganha o critério do formato R$.
  const typed = scoreSheet(ch.cells, { ...ch.cells, C4: { v: 'R$ 25,00' } });
  assert.ok(typed.pct < 100 && typed.pct > 90, `R$ digitado: ${typed.pct}%`);
});

test('quadros do replay: tira repetidos, corta até caber e guarda o primeiro e o último', () => {
  const frames = Array.from({ length: 100 }, (_, i) => `<p>${'x'.repeat(i)}</p>`);
  const thin = thinFrames(['a', 'a', ...frames]);
  assert.ok(thin.length <= 40);
  assert.equal(thin[0], 'a');
  assert.equal(thin.at(-1), frames.at(-1));
  assert.deepEqual(thinFrames(['x'.repeat(60_000), 'y'.repeat(60_000)]), ['y'.repeat(60_000)]);
});
