// Contra todos de ponta a ponta: TV, dois alunos de verdade (Chromebook) digitando e 4 robôs com níveis diferentes.
// Gera prints do resultado de cada aluno e o vídeo da revelação (replay + barra de progresso + critérios).
// Uso local (servidor e Vite rodando): E2E_URL=http://localhost:5174/duelo-docs-sheets/ node scripts/e2e-todos.ts
import { chromium, type Page } from 'playwright';
import { io, type Socket } from 'socket.io-client';
import { mkdirSync } from 'node:fs';
import type { ClientEvents, PublicRoom, ServerEvents } from '../shared/protocol.ts';
import { thinFrames } from '../shared/rules.ts';
import { steps } from './bot-steps.ts';

const URL = process.env.E2E_URL ?? 'http://localhost:5173/duelo-docs-sheets/';
const SERVER = process.env.SERVER_URL ?? 'http://localhost:3000';
const OUT = process.env.OUT ?? 'qa-evidence';
const VIDEO = process.env.VIDEO ?? `${OUT}/revelacao-contra-todos.webm`;
mkdirSync(OUT, { recursive: true });

type S = Socket<ServerEvents, ClientEvents>;
const step = (msg: string) => console.log('•', msg);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const emit = <T,>(s: S, ev: keyof ClientEvents, p: unknown) =>
  new Promise<T>((ok) => (s.emit as (...a: unknown[]) => void)(ev, p, (r: T) => ok(r)));
const connect = () =>
  new Promise<S>((ok) => {
    const s: S = io(SERVER, { transports: ['websocket'], extraHeaders: { origin: new globalThis.URL(URL).origin } });
    s.on('connect', () => ok(s));
  });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
const errors: string[] = [];
const open = async (w: number, h: number, init?: { session: string }, video = false) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(video ? { recordVideo: { dir: `${OUT}/.video`, size: { width: w, height: h } } } : {}) });
  if (init) await ctx.addInitScript((s) => localStorage.setItem('duelo-docs-sheets:sessao', s), init.session);
  const page = await ctx.newPage();
  pages.push(page);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  return page;
};
const shot = (p: Page, name: string) => p.screenshot({ path: `${OUT}/${name}.png` });
const pages: Page[] = [];

let room: PublicRoom | null = null;
const until = async (fn: () => boolean, ms = 20_000) => {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('tempo esgotado esperando condição');
    await wait(100);
  }
};
const kidJoin = async (code: string, name: string) => {
  const kid = await open(1366, 768);
  await kid.goto(`${URL}?sala=${code}`);
  await kid.getByLabel('Seu nome').fill(name);
  await kid.getByRole('button', { name: 'Entrar na sala' }).click();
  await kid.getByText('Você está na sala!').waitFor();
  return kid;
};
const style = async (p: Page, name: string) => {
  await p.getByRole('button', { name: 'Estilos' }).click();
  await p.locator('.gd-styles').getByRole('button', { name: new RegExp(`^(✓ ?)?${name}$`) }).click();
};
const alignTo = async (p: Page, name: string) => {
  await p.getByRole('button', { name: 'Alinhar e recuar' }).click();
  await p.locator('.g-menu').getByRole('button', { name }).click();
};

// Robôs: perfeito, só texto, pela metade e um que só tem o salvamento do minuto (não entrega os quadros).
const BOTS = [
  { name: 'Caio', careful: true, upTo: 1, frames: true },
  { name: 'Duda', careful: false, upTo: 1, frames: true },
  { name: 'Enzo', careful: true, upTo: 0.5, frames: true },
  { name: 'Gabi', careful: true, upTo: 0.7, frames: false },
];
const bots: { name: string; id: string; s: S; parts: string[]; spec: (typeof BOTS)[number] }[] = [];
const botsWork = () => {
  const t = room!.task!;
  for (const b of bots) {
    b.parts = steps(t.challengeId, b.spec.careful, b.spec.upTo);
    b.s.emit('player:content', { round: t.round, data: b.parts[Math.floor(b.parts.length / 2)] });
  }
};
const botsDeliver = async () => {
  const t = room!.task!;
  for (const b of bots) if (b.spec.frames) await emit(b.s, 'player:frames', { round: t.round, frames: thinFrames(b.parts) });
};

// Assiste à revelação até o ranking, com um print de cada aluno quando a nota final aparece.
const watchReveal = async (tv: Page, prefix: string, max = 99) => {
  const names: string[] = [];
  for (let i = 0; i < max; i++) {
    const done = tv.locator('.rv.done');
    await tv.locator('.rv, .ranking').first().waitFor({ timeout: 40_000 });
    if (await tv.locator('.ranking').isVisible()) break;
    await wait(3600); // no meio do replay: documento sendo montado e barra subindo
    const name = (await tv.locator('.rv-head h2').innerText()).trim();
    const file = `${prefix}-${String(i + 1).padStart(2, '0')}-${name.toLowerCase()}`;
    await shot(tv, `${file}-replay`);
    await done.waitFor({ timeout: 40_000 });
    await wait(1200);
    await shot(tv, file);
    names.push(name);
    if (i + 1 >= max) break;
    await done.waitFor({ state: 'detached', timeout: 15_000 });
  }
  return names;
};

try {
  const tv = await open(1366, 768);
  await tv.goto(URL);
  await tv.getByRole('button', { name: 'Abrir a TV' }).click();
  await tv.locator('.code-tiles').waitFor();
  const sessionJson = (await tv.evaluate(() => localStorage.getItem('duelo-docs-sheets:sessao')))!;
  const { code, token } = JSON.parse(sessionJson);
  step(`sala ${code}`);
  const ctl = await connect();
  ctl.on('state', (r) => (room = r));
  await emit(ctl, 'teacher:resume', { code, token });

  // Professor escolhe "Contra todos" e o desafio "Relatório de manutenção" (intermediário).
  await tv.getByRole('radio', { name: 'Contra todos' }).click();
  await tv.getByRole('combobox').selectOption('d19');
  await until(() => room?.settings.game === 'all' && room.settings.pick === 'd19');

  const ana = await kidJoin(code, 'Ana');
  const beto = await kidJoin(code, 'Beto');
  for (const spec of BOTS) {
    const s = await connect();
    const res = await emit<{ playerId: string }>(s, 'player:join', { code, name: spec.name });
    bots.push({ name: spec.name, id: res.playerId, s, parts: [], spec });
  }
  await wait(900);
  await shot(tv, '30-tv-sala-contra-todos');

  // ---------- Prova
  await tv.getByRole('button', { name: 'Começar para todos' }).click();
  await until(() => room?.phase === 'work');
  await wait(1300);
  await shot(tv, '31-tv-contra-todos-contagem');
  await shot(ana, '32-aluno-prepare-se');
  await ana.getByRole('textbox', { name: 'Documento' }).waitFor();
  await wait(Math.max(0, room!.task!.startsAt - room!.serverNow) + 3200);
  botsWork();

  const ed = ana.getByRole('textbox', { name: 'Documento' });
  await ed.click();
  await style(ana, 'Título');
  await ana.keyboard.type('Relatório de Manutenção');
  await alignTo(ana, 'Centralizar');
  await wait(3300);
  await ana.keyboard.press('Enter');
  await style(ana, 'Subtítulo');
  await ana.keyboard.type('Laboratório de Informática - Sala 3');
  await wait(3300);
  await ana.keyboard.press('Enter');
  await style(ana, 'Título 1');
  await alignTo(ana, 'Alinhar à esquerda');
  await ana.keyboard.type('Problemas encontrados');
  await wait(3300);
  await ana.keyboard.press('Enter');
  await style(ana, 'Texto normal');
  await ana.getByRole('button', { name: 'Lista com marcadores (Ctrl+Shift+8)' }).click();
  await ana.locator('.g-menu').getByRole('button', { name: '● Marcadores' }).click();
  for (const [label, rest] of [['PC 04:', ' não liga'], ['PC 09:', ' teclado com teclas soltas']]) {
    await ana.keyboard.press('Control+b');
    await ana.keyboard.type(label);
    await ana.keyboard.press('Control+b');
    await ana.keyboard.type(rest);
    await ana.keyboard.press('Enter');
    await wait(3300);
  }
  await ana.keyboard.press('Backspace');
  await beto.getByRole('textbox', { name: 'Documento' }).click();
  await beto.keyboard.type('relatorio de manutencao');
  await wait(3300);
  await beto.keyboard.press('Enter');
  await beto.keyboard.type('pc 04 nao liga');
  await wait(1500);
  await shot(ana, '33-aluno-contra-todos-docs');
  await shot(tv, '34-tv-contra-todos-prova');

  await tv.getByRole('button', { name: 'Encerrar e ver resultados' }).click();
  await until(() => room?.phase === 'reveal');
  await botsDeliver();
  await ana.getByText('✓ Seu trabalho foi entregue').waitFor();
  await beto.getByText('✓ Seu trabalho foi entregue').waitFor();
  await shot(ana, '35-aluno-entregue');

  // A TV recarrega gravando vídeo e passa o replay de todos (a primeira TV fecha para não dobrar).
  await tv.context().close();
  const tv2 = await open(1366, 768, { session: sessionJson }, true);
  await tv2.goto(URL);
  await tv2.locator('.reveal-wait, .rv').first().waitFor();
  await shot(tv2, '36-tv-recolhendo-trabalhos');
  const names = await watchReveal(tv2, '37-resultado');
  step(`revelados: ${names.join(', ')}`);
  await until(() => room?.phase === 'ranking');
  await wait(2500);
  await shot(tv2, '38-tv-ranking');
  await shot(ana, '39-aluno-resultado-final');
  const sc = room!.scores!;
  const id = (n: string) => room!.players.find((p) => p.name === n)!.id;
  step(`notas: ${room!.players.map((p) => `${p.name} ${sc[p.id]}%`).join(' · ')}`);
  if (sc[id('Caio')] !== 100) throw new Error('o robô perfeito deveria ter 100%');
  if (!(sc[id('Ana')] > sc[id('Beto')])) throw new Error('Ana formatou e deveria passar o Beto');
  if (!(sc[id('Duda')] >= 40 && sc[id('Duda')] <= 65)) throw new Error('só texto deveria ficar no meio');
  if (!(sc[id('Gabi')] > 0)) throw new Error('o salvamento do minuto deveria contar');
  const video = tv2.video()!;
  await tv2.context().close();
  await video.saveAs(VIDEO);
  step(`vídeo: ${VIDEO}`);

  // ---------- Segunda rodada: Planilhas (intermediário)
  await emit(ctl, 'teacher:settings', { pick: 's19' });
  const tv3 = await open(1366, 768, { session: sessionJson });
  await tv3.goto(URL);
  await tv3.getByRole('button', { name: 'Nova rodada contra todos' }).click();
  await until(() => room?.phase === 'work' && room.task?.challengeId === 's19');
  await wait(Math.max(0, room!.task!.startsAt - room!.serverNow) + 600);
  botsWork();
  const cell = (r: number, c: number) => ana.locator(`.gs-c[data-r="${r}"][data-c="${c}"]`).first();
  await cell(0, 0).click();
  await ana.keyboard.type('Estoque da Loja');
  await ana.keyboard.press('Enter');
  await cell(0, 0).click();
  await ana.getByRole('button', { name: 'Negrito (Ctrl+B)' }).click();
  await wait(3300);
  await cell(2, 0).click();
  for (const v of ['Produto', 'Quantidade', 'Preço', 'Total']) {
    await ana.keyboard.type(v);
    await ana.keyboard.press('Tab');
  }
  await cell(2, 0).click();
  await cell(2, 3).click({ modifiers: ['Shift'] });
  await ana.getByRole('button', { name: 'Cor de preenchimento' }).click();
  await ana.locator('.g-menu').getByRole('button', { name: 'azul centáurea escuro 2', exact: true }).click();
  await ana.getByRole('button', { name: 'Cor do texto' }).click();
  await ana.locator('.g-menu').getByRole('button', { name: 'branco', exact: true }).click();
  await wait(3300);
  await cell(3, 0).click();
  for (const v of ['Mouse', '10', '25', '250']) {
    await ana.keyboard.type(v);
    await ana.keyboard.press('Tab');
  }
  await cell(8, 5).click();
  await wait(1200);
  await shot(ana, '40-aluno-contra-todos-sheets');
  await tv3.getByRole('button', { name: 'Encerrar e ver resultados' }).click();
  await until(() => room?.phase === 'reveal');
  await botsDeliver();
  await watchReveal(tv3, '41-resultado-sheets', 2);
  await tv3.getByRole('button', { name: 'Ver ranking' }).click();
  await until(() => room?.phase === 'ranking');
  await wait(2500);
  await shot(tv3, '42-tv-ranking-sheets');

  if (errors.length) throw new Error(`Erros no console:\n${errors.join('\n')}`);
  step('tudo certo ✔');
} catch (err) {
  console.error('✘', err);
  for (const [i, p] of pages.entries()) await p.screenshot({ path: `${OUT}/.erro-${i}.png` }).catch(() => {});
  if (errors.length) console.error('Erros no console:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  for (const b of bots) b.s.disconnect();
  process.exit(process.exitCode ?? 0);
}
