// Partida de ponta a ponta com prints: TV (1366×768), dois alunos de verdade (Chromebook 1366×768) e alunos-robô.
// Uso local (servidor e Vite rodando): node scripts/e2e.ts
// Teste leve em produção:
//   E2E_URL=https://fernandobalbino.github.io/duelo-docs-sheets/ SERVER_URL=https://duelo-docs-sheets.onrender.com OUT=qa-evidence/producao node scripts/e2e.ts
import { chromium, type Page } from 'playwright';
import { io, type Socket } from 'socket.io-client';
import { mkdirSync } from 'node:fs';
import { CHALLENGE_BY_ID } from '../shared/challenges.ts';
import type { ClientEvents, PublicRoom, ServerEvents } from '../shared/protocol.ts';
import { DRAW_MS } from '../shared/rules.ts';

const URL = process.env.E2E_URL ?? 'http://localhost:5173/duelo-docs-sheets/';
const SERVER = process.env.SERVER_URL ?? 'http://localhost:3000';
const OUT = process.env.OUT ?? 'qa-evidence';
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
const open = async (w: number, h: number) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  return page;
};
const shot = (p: Page, name: string) => p.screenshot({ path: `${OUT}/${name}.png` });

// Professor-robô: segue a sala e faz ações de controle (sortear de novo) pela mesma sessão da TV.
let room: PublicRoom | null = null;
const teacher = async (code: string, token: string) => {
  const s = await connect();
  s.on('state', (r) => (room = r));
  await emit(s, 'teacher:resume', { code, token });
  return s;
};
const until = async (fn: () => boolean, ms = 20_000) => {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('tempo esgotado esperando condição');
    await wait(100);
  }
};

// Robôs: entram, saem e voltam (ficam fora do sorteio quando queremos os alunos de verdade duelando).
const BOT_NAMES = ['Caio', 'Duda', 'Enzo', 'Gabi'];
const bots: { name: string; id: string; token: string; s: S | null }[] = [];
const botsOnline = async (code: string) => {
  for (const b of bots) {
    if (b.s) continue;
    b.s = await connect();
    await emit(b.s, 'player:resume', { code, token: b.token });
  }
};
const botsOffline = async () => {
  for (const b of bots) b.s?.disconnect();
  for (const b of bots) b.s = null;
  await wait(400);
};
const voted = new Set<string>();
const botVote = async (side: 'a' | 'b', count: number) => {
  const d = room!.duel!;
  const voters = bots.filter((b) => b.s && b.id !== d.a && b.id !== d.b && !voted.has(`${d.round}:${b.id}`)).slice(0, count);
  for (const b of voters) {
    const res = await emit<{ ok: boolean; error?: string }>(b.s!, 'player:vote', { side });
    if (!res.ok) throw new Error(`voto do robô ${b.name}: ${res.error}`);
    voted.add(`${d.round}:${b.id}`);
    await wait(500);
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

const pickColor = async (p: Page, button: string, color: string) => {
  await p.getByRole('button', { name: button, exact: true }).first().click();
  await p.locator('.g-menu').getByRole('button', { name: color, exact: true }).click();
};

try {
  const tv = await open(1366, 768);
  await tv.goto(URL);
  await shot(tv, '00-inicio');
  await tv.getByRole('button', { name: 'Abrir a TV' }).click();
  await tv.locator('.code-tiles').waitFor();
  const session = JSON.parse((await tv.evaluate(() => localStorage.getItem('duelo-docs-sheets:sessao')))!);
  const code: string = session.code;
  step(`sala ${code}`);
  const ctl = await teacher(code, session.token);

  // Configuração: 2 vitórias para ser campeão, desafio de 1:30.
  for (let i = 0; i < 3; i++) await tv.getByRole('button', { name: 'Diminuir Tempo do desafio' }).click();
  await tv.getByRole('button', { name: 'Diminuir Vitórias para ser campeão' }).click();
  await until(() => room?.settings.target === 2 && room.settings.duelSeconds === 90);

  const ana = await kidJoin(code, 'Ana');
  const beto = await kidJoin(code, 'Beto');
  for (const name of BOT_NAMES) {
    const s = await connect();
    const res = await emit<{ ok: boolean; playerId: string; token: string }>(s, 'player:join', { code, name });
    bots.push({ name, id: res.playerId, token: res.token, s });
  }
  await wait(900);
  await shot(tv, '01-tv-sala-de-espera');
  await shot(ana, '02-aluno-sala-de-espera');
  const kidId = async (p: Page) => JSON.parse((await p.evaluate(() => localStorage.getItem('duelo-docs-sheets:sessao')))!).playerId as string;
  const anaId = await kidId(ana);

  // ---------- Duelo 1: Docs, os dois alunos de verdade ----------
  await botsOffline();
  await tv.getByRole('button', { name: 'Sortear duelo' }).click();
  await until(() => room?.phase === 'draw');
  const t0 = room!.duel!.startsAt - DRAW_MS - room!.serverNow + Date.now();
  const at = (ms: number) => wait(Math.max(0, t0 + ms - Date.now()));
  await at(2300);
  await shot(tv, '03-tv-sorteio-girando');
  await at(5900);
  await shot(tv, '04-tv-vs');
  await shot(ana, '05-aluno-sorteado');
  await at(7300);
  await shot(tv, '06-tv-desafio');
  await at(8000);
  await shot(tv, '07-tv-contagem');
  await botsOnline(code);
  await until(() => room?.phase === 'duel');
  const ch1 = CHALLENGE_BY_ID.get(room!.duel!.challengeId)!;
  step(`duelo 1: ${ch1.kind} "${ch1.title}"`);
  if (ch1.kind !== 'docs') throw new Error('o modo alternar deveria começar no Docs');

  // Ana formata de verdade com a barra do Docs; Beto só digita.
  const ed = ana.getByRole('textbox', { name: 'Documento' });
  await ed.click();
  await ana.getByRole('button', { name: 'Estilos' }).click();
  await ana.locator('.gd-styles').getByRole('button', { name: 'Título', exact: true }).click();
  await ana.keyboard.type('Feira de Ciências');
  await ana.getByRole('button', { name: 'Alinhar e recuar' }).first().click();
  await ana.locator('.g-menu').getByRole('button', { name: 'Centralizar' }).click();
  await ana.keyboard.press('Enter');
  await ana.getByRole('button', { name: 'Estilos' }).click();
  await ana.locator('.gd-styles').getByRole('button', { name: 'Texto normal' }).click();
  await ana.keyboard.type('Traga sua família!');
  for (let i = 0; i < 9; i++) await ana.keyboard.press('Shift+ArrowLeft');
  await ana.getByRole('button', { name: 'Negrito (Ctrl+B)' }).click();
  await pickColor(ana, 'Cor do texto', 'vermelho');
  await ana.getByRole('textbox', { name: 'Tamanho da fonte' }).click();
  await ana.getByRole('textbox', { name: 'Tamanho da fonte' }).fill('18');
  await ana.keyboard.press('Enter');
  await ana.keyboard.press('End');
  await ana.keyboard.press('Enter');
  await ana.keyboard.type('Data: 15 de outubro');
  await wait(300);
  const html = await ed.innerHTML();
  if (!/<h1/.test(html) || !/font-weight: bold|<b>/.test(html) || !/color: rgb\(255, 0, 0\)/.test(html) || !/font-size: 18pt/.test(html))
    throw new Error(`formatação do Docs não aplicada: ${html}`);
  await shot(ana, '08-aluno-docs-editor');
  await beto.getByRole('textbox', { name: 'Documento' }).click();
  await beto.keyboard.type('feira de ciencias traga sua familia');
  await wait(1600);
  await shot(tv, '09-tv-duelo-docs');
  if (!(await tv.locator('.contender .gd-content h1').count())) throw new Error('a TV não recebeu o documento da Ana');

  await tv.getByRole('button', { name: 'Encerrar desafio' }).click();
  await until(() => room?.phase === 'vote');
  await wait(900);
  await shot(beto, '10-aluno-tempo-esgotado');
  const anaSide = room!.duel!.a === anaId ? 'a' : 'b';
  await botVote(anaSide, 3);
  await shot(tv, '11-tv-votacao');
  await botVote(anaSide === 'a' ? 'b' : 'a', 1);
  await until(() => room?.phase === 'result');
  await wait(1200);
  await shot(tv, '12-tv-vencedor');
  await shot(ana, '13-aluno-resultado');
  await wait(4200);
  await shot(tv, '14-tv-corrida');

  // ---------- Duelo 2: Sheets, de novo os alunos de verdade ----------
  await botsOffline();
  await tv.getByRole('button', { name: 'Próximo duelo' }).click();
  await until(() => room?.phase === 'draw');
  await botsOnline(code);
  await until(() => room?.phase === 'duel', 15_000);
  const ch2 = CHALLENGE_BY_ID.get(room!.duel!.challengeId)!;
  step(`duelo 2: ${ch2.kind} "${ch2.title}"`);
  if (ch2.kind !== 'sheets') throw new Error('o segundo duelo deveria ser no Sheets');
  const cell = (p: Page, r: number, c: number) => p.locator(`.gs-c[data-r="${r}"][data-c="${c}"]`).first();
  await cell(ana, 0, 0).click();
  await ana.keyboard.type('Produto');
  await ana.keyboard.press('Tab');
  await ana.keyboard.type('Preço');
  await ana.keyboard.press('Enter');
  await cell(ana, 1, 0).click();
  await ana.keyboard.type('Arroz');
  await ana.keyboard.press('Tab');
  await ana.keyboard.type('12,5');
  await ana.keyboard.press('Enter');
  await cell(ana, 2, 0).click();
  await ana.keyboard.type('Feijão');
  await ana.keyboard.press('Tab');
  await ana.keyboard.type('8');
  await ana.keyboard.press('Enter');
  await cell(ana, 0, 0).click();
  await cell(ana, 0, 1).click({ modifiers: ['Shift'] });
  await ana.getByRole('button', { name: 'Negrito (Ctrl+B)' }).click();
  await pickColor(ana, 'Cor de preenchimento', 'azul centáurea');
  await pickColor(ana, 'Cor do texto', 'branco');
  await cell(ana, 1, 1).click();
  await cell(ana, 2, 1).click({ modifiers: ['Shift'] });
  await ana.getByRole('button', { name: 'Formatar como moeda' }).click();
  await cell(ana, 0, 0).click();
  await cell(ana, 2, 1).click({ modifiers: ['Shift'] });
  await ana.getByRole('button', { name: 'Bordas' }).click();
  await ana.locator('.g-menu').getByRole('button', { name: 'Todas as bordas' }).click();
  await cell(ana, 4, 3).click();
  if ((await cell(ana, 1, 1).innerText()).trim() !== 'R$ 12,50') throw new Error('formato R$ não aplicado');
  await shot(ana, '15-aluno-sheets-editor');
  await cell(beto, 0, 0).click();
  await beto.keyboard.type('produto');
  await beto.keyboard.press('Enter');
  await wait(1600);
  await shot(tv, '16-tv-duelo-sheets');
  if (!(await tv.locator('.contender .gs-c[style*="background"]').count())) throw new Error('a TV não recebeu a planilha da Ana');

  await tv.getByRole('button', { name: 'Encerrar desafio' }).click();
  await until(() => room?.phase === 'vote');
  await botVote(room!.duel!.a === anaId ? 'a' : 'b', 4);
  await until(() => room?.phase === 'result');
  if (!room!.champions.includes(anaId)) throw new Error('Ana deveria ser campeã com 2 vitórias');
  await wait(9200);
  await shot(tv, '17-tv-campeao');
  await shot(ana, '18-aluno-campeao');

  // ---------- Nova partida: robôs duelam, alunos de verdade votam ----------
  await tv.getByRole('button', { name: 'Nova partida' }).click();
  await until(() => room?.phase === 'lobby');
  await tv.getByRole('button', { name: 'Sortear duelo' }).click();
  const isBot = (id: string) => bots.some((b) => b.id === id);
  for (let i = 0; i < 12; i++) {
    await until(() => room?.phase === 'draw' || room?.phase === 'duel');
    if (isBot(room!.duel!.a) && isBot(room!.duel!.b)) break;
    await emit(ctl, 'teacher:action', { action: 'redraw' });
    await wait(200);
  }
  const d3 = room!.duel!;
  if (!isBot(d3.a) || !isBot(d3.b)) throw new Error('não conseguiu sortear dois robôs');
  await until(() => room?.phase === 'duel', 15_000);
  const ch3 = CHALLENGE_BY_ID.get(d3.challengeId)!;
  step(`duelo 3: ${ch3.kind} "${ch3.title}" (robôs)`);
  const botA = bots.find((b) => b.id === d3.a)!;
  const botB = bots.find((b) => b.id === d3.b)!;
  const perfect = ch3.kind === 'docs' ? ch3.html : JSON.stringify(ch3.cells);
  // O robô B tenta atacar a TV: script, imagem com onerror e span fixo cobrindo a tela.
  const evil = ch3.kind === 'docs'
    ? '<p>só o texto</p><script>window.__pwned=1</script><img src=x onerror="window.__pwned=2"><span style="position:fixed;inset:0;font-size:300px;background:red">X</span>'
    : JSON.stringify({ A1: { v: 'só texto', bg: 'url(javascript:alert(1))' }, ZZ9: { v: 'fora' } });
  botA.s!.emit('player:content', { round: d3.round, data: perfect });
  botB.s!.emit('player:content', { round: d3.round, data: evil });
  await wait(1200);
  await shot(tv, '19-tv-duelo-robos');
  await shot(ana, '20-aluno-assistindo');
  const pwned = await tv.evaluate(() => (window as unknown as { __pwned?: number }).__pwned);
  if (pwned || (await tv.locator('.contender img, .contender script').count())) throw new Error('conteúdo malicioso passou para a TV');
  const fixed = await tv.locator('.contender span').evaluateAll((els) => els.filter((e) => getComputedStyle(e).position === 'fixed').length);
  if (fixed) throw new Error('estilo position:fixed passou para a TV');

  await tv.getByRole('button', { name: 'Encerrar desafio' }).click();
  await until(() => room?.phase === 'vote');
  await ana.locator('.vote-btn').first().waitFor();
  await shot(ana, '21-aluno-votacao');
  await ana.locator('.vote-btn.a').click();
  await ana.getByText('Voto registrado!').waitFor();
  await beto.locator('.vote-btn.a').click();
  await wait(700);
  await shot(ana, '22-aluno-votou');
  await shot(tv, '23-tv-votacao-ao-vivo');
  await botVote('b', 2);
  await until(() => room?.phase === 'result');
  await wait(5200);
  await shot(tv, '24-tv-corrida-nova-partida');

  // Celular / tela pequena: o aluno também consegue entrar.
  const phone = await open(412, 860);
  await phone.goto(`${URL}?sala=${code}`);
  await shot(phone, '25-celular-inicio');

  if (errors.length) throw new Error(`Erros no console:\n${errors.join('\n')}`);
  step('tudo certo ✔');
} catch (err) {
  console.error('✘', err);
  if (errors.length) console.error('Erros no console:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  for (const b of bots) b.s?.disconnect();
  process.exit(process.exitCode ?? 0);
}
