# Duelo Docs × Sheets

Atividade ao vivo para a turma: a máquina caça-níquel da TV sorteia **dois rivais**, a dupla recria um **modelo** numa réplica do
**Google Documentos** ou do **Google Planilhas** no Chromebook, e o resto da turma **vota** em quem ficou mais parecido.
Quem vence avança uma casa na **corrida até a linha de chegada**; quem chega primeiro (3 vitórias, configurável) é o campeão.

- Telas (GitHub Pages): https://fernandobalbino.github.io/duelo-docs-sheets/
- Servidor de tempo real (Render free): https://duelo-docs-sheets.onrender.com/health

## Como usar na aula

1. **Professor (TV):** abra o site e clique em **Abrir a TV**. Aparece o código da sala. Ajuste o tempo do desafio, o tempo de
   votação, as vitórias para ser campeão e o tipo de desafio (alternar, só Docs, só Sheets ou aleatório).
2. **Alunos (Chromebook):** abram o mesmo site, digitem o código e o nome.
3. **Sortear duelo:** a máquina gira, o "VS" explode, aparece o desafio e a contagem 3-2-1.
4. **Duelo:** os dois sorteados ganham o editor em tela cheia, com o modelo no painel da direita (clique em *Ampliar* para ver
   grande). A TV mostra os dois trabalhos lado a lado com o modelo no meio — só o resultado, sem mouse.
   Botões da TV: **+30 s**, **Sortear de novo** (alguém faltou) e **Encerrar desafio**.
5. **Votação:** os outros alunos tocam em quem ficou mais parecido. As barras sobem ao vivo na TV.
6. **Resultado:** vencedor com confete, depois a corrida com todos na raia; o vencedor avança. Empate com votos: os dois avançam.

O servidor gratuito dorme quando ninguém usa: abra a TV um minuto antes da aula para ele acordar.

## Os 36 desafios

18 de Documentos (títulos, subtítulos, negrito, itálico, sublinhado, cores, marca-texto, tamanho da fonte, alinhamento, listas)
e 18 de Planilhas (cabeçalho com preenchimento, cores do texto, negrito, bordas, alinhamento, formato R$, tachado).
A mesma dupla **nunca repete** um desafio; o sorteio também evita repetir um desafio que um dos dois já fez.
Estão em `shared/challenges.ts`.

**Matriz curricular — Informática Aplicada:** criar, formatar e editar documentos com editores de texto; estruturar e organizar
dados com planilhas eletrônicas (conhecimentos: edição e formatação de documentos, criação de planilhas eletrônicas).

## Economia do Render

- As telas e os 36 desafios ficam no GitHub Pages; pela rede só passa o id do desafio.
- O documento do duelista vai **só para a TV**, no máximo 1 vez por segundo e só quando mudou.
- Cronômetros usam o relógio do servidor (`endsAt`), sem "tique" pela rede. Cada voto é um evento pequeno.
- A página inicial não conecta. Sala parada por 25 min desconecta todo mundo para o serviço dormir (aparece "Continuar").

## Desenvolvimento

```bash
npm install
npm run dev:server   # porta 3000
npm run dev:web      # http://localhost:5173/duelo-docs-sheets/
npm run check && npm test && npm run build
npm run e2e          # partida completa com Playwright (TV + 2 Chromebooks + robôs), prints em qa-evidence/
```
