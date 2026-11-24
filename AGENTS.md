# AGENTS.md — Duelo Docs × Sheets

Professor na TV (notebook espelhado, 1366×768), alunos em Chromebook (1366×768). Textos em português com acentos.

## Arquitetura
- `shared/rules.ts`: constantes, linha do tempo do sorteio (`REEL_A_STOP`…`DRAW_MS`), limites das configurações, avatares.
- `shared/challenges.ts`: os 46 desafios (`level`: 36 `basico`, usados no duelo; 10 `intermediario`, para o contra todos).
  Docs = HTML com as tags do editor (p, h1 Título, h6 Subtítulo, h2–h4 Título 1–3); Sheets = `sheet(linhas, estilos por intervalo)`.
  Ficam nas telas e no servidor; pela rede só passa o id. Todo modelo copiado igual tem que dar 100% (`tests/score.test.ts`).
- `shared/sheet.ts`: modelo da planilha (`Cells`, só células preenchidas), número pt-BR, R$, `parseCells` (filtra o que vem da rede).
- `server/game.ts`: regras sem rede, relógio e sorteio injetáveis. Toda regra nova ganha teste em `tests/game.test.ts` (`fakeClock`).
  Sorteio: quem duelou menos primeiro, evita a dupla anterior. Desafio: nunca repete para a dupla (`usedByPair`), evita o que um
  dos dois já fez (`usedByPlayer`). "Sortear de novo" não gasta desafio nem conta duelo. Empate com votos: os dois pontuam.
- Contra todos (`game.ts`: `startAll`, `checkpoint`, `saveFrames`, `finishAll`): fases `work` → `reveal` → `ranking`.
  O aluno salva 1×/min (`player:content`, só a TV fica sabendo por `saved`) e manda os quadros do replay uma vez só
  (`player:frames`, até `MAX_FRAMES`/`MAX_FRAMES_CHARS`, `thinFrames`). Quem só tem o salvamento entra com um quadro.
  A TV calcula a % (`web/src/score.ts`) e devolve por `teacher:scores`.
- `server/index.ts`: Socket.IO. `state` só em mudança de fase/entrada; `votes` (pequeno) a cada voto; `player:content` vai só para
  a sala `CODE:tv`. Sala parada por `IDLE_MS` desconecta todos (o Render free dorme).

## Telas (`web/src`)
- `google/`: réplicas do Google Documentos (`Docs.tsx`, contenteditable + execCommand) e Planilhas (`Sheets.tsx`, grade A–Z × 1–100,
  linhas memorizadas por assinatura). Ícones Material Symbols em `icons.ts` (gerado a partir dos SVGs). `google.css` usa as cores
  originais do Google — as capturas de referência estavam escurecidas pela ferramenta de captura.
- `google/sanitize.ts`: o HTML do duelista é reconstruído antes de aparecer na TV (sem script, imagem, `position`, url(), letra > 120 pt).
- `SlotMachine.tsx`: sorteio na TV (rolos com WAAPI, `currentTime` pelo relógio do servidor: recarregar volta no ponto certo).
- `Host.tsx` (TV), `Player.tsx` (aluno), `Race.tsx` (corrida), `ui.tsx` (prévias: Docs em "cartão de leitura" de 440 px para ler de longe;
  `contain` faz o documento caber inteiro também na altura).
- `AllMode.tsx`: contra todos na TV (prova, revelação com replay + barra + critérios digitados ✓/✕, ranking com pódio).
- `score.ts`: % do modelo. Metade texto/valores (distância de edição com alinhamento), metade formatações do modelo
  (cada estilo vira um critério; precisão desconta formatação a mais). Planilha começada em outra célula é deslocada.
- Estilos do jogo em `styles.css`: nunca use seletor solto (`h1`, `p`, `strong`) — o conteúdo do Docs aparece dentro das telas.

## Desempenho (Chromebook) e banda (Render free)
- Anime só `transform`/`opacity` (exceções: anel do cronômetro e barras de cor). Respeite `prefers-reduced-motion`.
- Duelista envia o documento no máximo 1×/s e só se mudou; rascunho fica no `localStorage` (recarregar não perde).

## Verificação
`npm run check && npm test && npm run build`, depois `npm run e2e` e `npm run e2e:todos` com servidor e Vite locais
(geram `qa-evidence/`; o vídeo da revelação fica fora do git).
Em produção: `E2E_URL=https://fernandobalbino.github.io/duelo-docs-sheets/ SERVER_URL=https://duelo-docs-sheets.onrender.com OUT=qa-evidence/producao node scripts/e2e.ts`.
