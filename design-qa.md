# Design QA — Duelo Docs × Sheets

Verificado com `npm run e2e` (Chrome, TV 1366×768, dois alunos em Chromebook 1366×768, celular 412×860, 4 robôs). Prints em `qa-evidence/`.

| Tela | Print | Conferido |
| --- | --- | --- |
| Início | `00`, `25` | Código + nome; aviso de servidor acordando; cabe no celular |
| Sala de espera (TV / aluno) | `01`, `02` | Código gigante, configurações, alunos entrando com avatar |
| Sorteio | `03`–`07` | Rolos girando e parando um de cada vez, VS com anel/flash/raios, cartão do desafio, 3-2-1 |
| Aluno sorteado | `05` | "Você foi sorteado(a)", rival, tipo e título do desafio |
| Editor Docs | `08` | Igual ao Google Documentos: cabeçalho, menus, barra (Estilos, fonte, tamanho, B/I/U, cores, alinhamento, listas), régua, guias, página; modelo no painel estilo Gemini |
| Editor Sheets | `15` | Igual ao Google Planilhas: barra (R$, %, casas, fonte, tamanho, B/I/S, cores, bordas, alinhamento), caixa de nome, fx, grade, Página1 |
| Duelo na TV | `09`, `16`, `19` | Trabalhos ao vivo lado a lado, modelo no meio, legível de longe |
| Tempo esgotado | `10` | Editor travado, votos ao vivo |
| Votação | `11`, `21`–`23` | Barras subindo ao vivo; aluno vota na esquerda/direita da TV |
| Resultado e corrida | `12`–`14`, `24` | Vencedor com confete; raias com largada/chegada; vencedor avança com "+1" |
| Campeão | `17`, `18` | Troféu, raios, confete e top 5 |
| Contra todos: sala | `30` | Modo, tempo de cada desafio, quantidade e lista dos desafios na ordem |
| Contra todos: prova | `31`–`35` | Contagem 3-2-1, "Prepare-se", editor com "Desafio 1 de 2" e botão Entregar, TV com quem entregou, aluno "Entregue!" |
| Contra todos: revelação | `36`, `37-*` | Recolhendo trabalhos; para cada aluno: replay (`-replay`) e nota final com critérios ✓/✕ |
| Contra todos: resultado | `38`, `39`, `42` | Pódio e lista do desafio; botão "Próximo desafio"; aluno vê a % e a posição |
| Contra todos: Sheets | `40`, `41-*` | Desafio 2 (planilha), termina sozinho quando todos entregam |
| Contra todos: pódio final | `43`, `44` | Top 5 pela média, nota de cada desafio; aluno vê média e posição |

Vídeo da revelação: `npm run e2e:todos` grava `qa-evidence/revelacao-contra-todos.webm` (fora do git).

Checklist: sem erros no console; HTML malicioso de um aluno não chega à TV (script, imagem, `position:fixed`, letra gigante);
estilos do jogo não vazam para o modelo do Docs; animações só com `transform`/`opacity`; `prefers-reduced-motion` desliga animações.
