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

## Modo contra todos

Na configuração da sala, escolha **Contra todos**, o **tempo da partida** (ex.: 50 min) e o **desafio** (sortear um básico,
sortear um intermediário ou escolher um da lista). Clique em **Começar para todos**:

1. Todos os alunos recebem o mesmo modelo no Docs ou no Sheets. A TV mostra o modelo, o cronômetro e quem já salvou.
   Botões: **+5 min** e **Encerrar e ver resultados**.
2. No fim do tempo, a TV recolhe os trabalhos e mostra **um aluno por vez**: o trabalho dele à esquerda e o modelo à direita,
   com um **replay rápido** (do documento em branco até o final) e a **barra de progresso** subindo junto até a % do modelo.
   Depois os critérios aparecem digitados, com ✓ verde / ✕ vermelho e som (igual à Roda do Alfabeto).
3. **Ranking** com pódio de quem chegou mais perto do modelo. Cada aluno vê a própria % e a posição no Chromebook.

**Como a % é calculada** (`web/src/score.ts`, roda na TV): metade é o texto (Docs) ou os valores (Sheets), comparados letra a
letra (um erro de digitação tira pouco); a outra metade é cada formatação do modelo — estilo de título, negrito, cor,
marca-texto, tamanho, alinhamento, listas, preenchimento, bordas, formato R$ — com desconto para formatação que o modelo não tem.
Na planilha, a tabela pode começar em outra célula.

**Economia do Render neste modo:** o Chromebook guarda o próprio progresso (até 40 quadros) e manda **uma vez só**, no fim.
Durante a prova vai só um salvamento por minuto (para não perder nada se a internet cair). A % é calculada na TV, não no servidor.
Uma turma de 30 alunos em 50 minutos gasta perto de 15 MB de banda no Render.

## Os 46 desafios

**36 básicos** (usados no duelo): 18 de Documentos (títulos, subtítulos, negrito, itálico, sublinhado, cores, marca-texto,
tamanho da fonte, alinhamento, listas) e 18 de Planilhas (cabeçalho com preenchimento, cores do texto, negrito, bordas,
alinhamento, formato R$, tachado). **10 intermediários** (5 + 5, para o contra todos): relatório, currículo, ata, folheto e tutorial;
estoque, boletim, orçamento, escala e placar, com mais seções, listas e tabelas maiores.
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
npm run e2e          # duelo completo com Playwright (TV + 2 Chromebooks + robôs), prints em qa-evidence/
npm run e2e:todos    # contra todos completo: prints do resultado de cada aluno e vídeo da revelação
npm run bots -- ABCD 3   # 3 alunos-robô na sala ABCD (duelo ou contra todos) para testar em casa
```
