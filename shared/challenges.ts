// Os 36 desafios (18 Docs + 18 Sheets). Ficam no código das telas: pela rede só passa o id.
// Estilos do Docs viram tags: Texto normal = p, Título = h1, Subtítulo = h6, Título 1 = h2, Título 2 = h3, Título 3 = h4.
import type { Kind } from './protocol.ts';
import { sheet, type Cells } from './sheet.ts';

interface Base {
  id: string;
  title: string;
  tips: string[];
}
export interface DocsChallenge extends Base {
  kind: 'docs';
  html: string;
}
export interface SheetsChallenge extends Base {
  kind: 'sheets';
  cells: Cells;
}
export type Challenge = DocsChallenge | SheetsChallenge;

const C = 'style="text-align:center"';
const R = 'style="text-align:right"';
const red = (t: string) => `<span style="color:#ff0000">${t}</span>`;
const mark = (t: string) => `<span style="background-color:#ffff00">${t}</span>`;
const size = (pt: number, t: string, extra = '') => `<span style="font-size:${pt}pt${extra}">${t}</span>`;
const ul = (...items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const ol = (...items: string[]) => `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;

const DOCS: Omit<DocsChallenge, 'kind'>[] = [
  {
    id: 'd01', title: 'Convite da Feira de Ciências',
    tips: ['Título centralizado (estilo Título)', '"Data:" e "Local:" em negrito', '"família" em vermelho'],
    html: `<h1 ${C}>Feira de Ciências</h1><p ${C}>Você está convidado!</p><p><b>Data:</b> 15 de outubro</p><p><b>Local:</b> quadra da escola</p><p>Traga sua ${red('família')}!</p>`,
  },
  {
    id: 'd02', title: 'Aviso do laboratório',
    tips: ['"Aviso" no estilo Título 1', '"proibido" em negrito e vermelho', 'Lista com marcadores'],
    html: `<h2>Aviso</h2><p>É <b>${red('proibido')}</b> comer no laboratório.</p>${ul('Desligue o monitor', 'Empurre a cadeira', 'Feche a porta')}`,
  },
  {
    id: 'd03', title: 'Receita de bolo',
    tips: ['Estilos Título, Subtítulo e Título 2', 'Lista com marcadores'],
    html: `<h1>Bolo de Cenoura</h1><h6>Receita fácil da vovó</h6><h3>Ingredientes</h3>${ul('3 cenouras', '4 ovos', '2 xícaras de açúcar')}`,
  },
  {
    id: 'd04', title: 'Cartaz do futsal',
    tips: ['"FUTSAL" em negrito, tamanho 36', 'Tudo centralizado', 'Marca-texto amarelo na última frase'],
    html: `<p ${C}><b>${size(36, 'FUTSAL')}</b></p><p ${C}>Campeonato da escola</p><p ${C}>${mark('Inscrições até sexta')}</p>`,
  },
  {
    id: 'd05', title: 'Ficha do computador',
    tips: ['"Ficha técnica" no estilo Título 1', 'Rótulos em negrito'],
    html: `<h2>Ficha técnica</h2><p><b>Processador:</b> Intel Core i5</p><p><b>Memória:</b> 8 GB</p><p><b>Armazenamento:</b> SSD 256 GB</p>`,
  },
  {
    id: 'd06', title: 'Bilhete para a família',
    tips: ['"muito" em negrito', 'Assinatura em itálico, alinhada à direita'],
    html: `<p>Querida família,</p><p>Hoje aprendi a formatar textos no computador. Foi <b>muito</b> legal!</p><p ${R}><i>Com carinho, seu filho</i></p>`,
  },
  {
    id: 'd07', title: 'Como ligar o computador',
    tips: ['Estilo Título 2', 'Lista numerada com 4 passos'],
    html: `<h3>Como ligar o computador</h3>${ol('Ligue o estabilizador', 'Aperte o botão do gabinete', 'Ligue o monitor', 'Digite sua senha')}`,
  },
  {
    id: 'd08', title: 'Regras da sala',
    tips: ['Título centralizado', 'Lista numerada', '"equipamentos" sublinhado'],
    html: `<h1 ${C}>Regras da Sala</h1>${ol('Chegue no horário', 'Cuide dos <u>equipamentos</u>', 'Respeite os colegas')}`,
  },
  {
    id: 'd09', title: 'Cardápio da cantina',
    tips: ['Título centralizado', 'Preços em negrito e verde escuro'],
    html: `<h1 ${C}>Cantina</h1>${['Pão de queijo - R$ 3,00', 'Suco natural - R$ 5,00', 'Bolo de pote - R$ 7,00']
      .map((t) => { const [item, price] = t.split(' - '); return `<p>${item} - <b><span style="color:#38761d">${price}</span></b></p>`; })
      .join('')}`,
  },
  {
    id: 'd10', title: 'Notícia da escola',
    tips: ['Estilos Título e Subtítulo', 'Subtítulo em itálico', '"dez robôs" em negrito'],
    html: `<h1>Escola ganha robôs</h1><h6><i>Alunos vão aprender programação</i></h6><p>A escola recebeu <b>dez robôs</b> novos para as aulas de tecnologia.</p>`,
  },
  {
    id: 'd11', title: 'Agenda da semana',
    tips: ['Estilo Título 1', 'Lista com marcadores', 'Dias da semana em negrito'],
    html: `<h2>Agenda da Semana</h2>${ul('<b>Segunda:</b> prova de Redes', '<b>Quarta:</b> trabalho em grupo', '<b>Sexta:</b> apresentação')}`,
  },
  {
    id: 'd12', title: 'Poema da tecnologia',
    tips: ['Título centralizado e roxo', 'Versos centralizados em itálico'],
    html: `<h1 ${C}><span style="color:#9900ff">Meu Computador</span></h1><p ${C}><i>Liga, carrega, acende a tela,</i></p><p ${C}><i>cada clique abre uma janela.</i></p>`,
  },
  {
    id: 'd13', title: 'Anúncio de venda',
    tips: ['"VENDE-SE" vermelho, negrito, tamanho 30', 'Frase centralizada', 'Lista com marcadores'],
    html: `<p ${C}><b>${size(30, 'VENDE-SE', ';color:#ff0000')}</b></p><p ${C}>Notebook usado, em ótimo estado</p>${ul('Tela de 15 polegadas', 'Bateria nova')}`,
  },
  {
    id: 'd14', title: 'Certificado',
    tips: ['Tudo centralizado', 'Nome em negrito, sublinhado, tamanho 18'],
    html: `<h1 ${C}>Certificado</h1><p ${C}>Certificamos que</p><p ${C}><b><u>${size(18, 'Ana Souza')}</u></b></p><p ${C}>concluiu o curso de Informática.</p>`,
  },
  {
    id: 'd15', title: 'Tarefas do técnico',
    tips: ['Estilo Título 2', 'Lista com marcadores', 'Item do meio com marca-texto amarelo'],
    html: `<h3>Tarefas de hoje</h3>${ul('Trocar o mouse da sala 2', mark('Formatar o PC 5'), 'Testar a impressora')}`,
  },
  {
    id: 'd16', title: 'Ingresso do cinema',
    tips: ['Título azul e centralizado', 'Rótulos em negrito', '"Pipoca grátis!" tamanho 18'],
    html: `<h1 ${C}><span style="color:#0000ff">CineEscola</span></h1><p ${C}><b>Sessão:</b> 19h</p><p ${C}><b>Sala:</b> 3</p><p ${C}>${size(18, 'Pipoca grátis!')}</p>`,
  },
  {
    id: 'd17', title: 'Glossário de informática',
    tips: ['Estilo Título 1', 'Termos em negrito'],
    html: `<h2>Glossário</h2><p><b>Hardware:</b> parte física do computador.</p><p><b>Software:</b> programas do computador.</p><p><b>Periférico:</b> aparelho ligado ao computador.</p>`,
  },
  {
    id: 'd18', title: 'Lembrete de prova',
    tips: ['"Lembrete" em negrito, tamanho 24', 'Matéria em vermelho e sublinhada', 'Última frase em itálico'],
    html: `<p><b>${size(24, 'Lembrete')}</b></p><p>A prova de <u>${red('Sistemas Operacionais')}</u> será na <b>terça-feira</b>.</p><p><i>Estude os comandos do terminal.</i></p>`,
  },
];

const SHEETS: Omit<SheetsChallenge, 'kind'>[] = [
  {
    id: 's01', title: 'Lista de compras', tips: ['Cabeçalho em negrito, fundo azul e letra branca'],
    cells: sheet([['Produto', 'Qtd'], ['Arroz', '2'], ['Feijão', '1'], ['Leite', '6'], ['Pão', '10']],
      { 'A1:B1': { b: 1, bg: '#4a86e8', fc: '#ffffff' } }),
  },
  {
    id: 's02', title: 'Notas do bimestre', tips: ['Cabeçalho em negrito com fundo amarelo', 'Aprovado em verde, Recuperação em vermelho'],
    cells: sheet([['Aluno', 'Nota', 'Situação'], ['Ana', '9', 'Aprovado'], ['Bruno', '5', 'Recuperação'], ['Carla', '8', 'Aprovado']],
      { 'A1:C1': { b: 1, bg: '#ffff00' }, 'C2,C4': { fc: '#38761d', b: 1 }, C3: { fc: '#ff0000', b: 1 } }),
  },
  {
    id: 's03', title: 'Horário de aulas', tips: ['Cabeçalho verde com letra branca', 'Dias em negrito'],
    cells: sheet([['Dia', 'Aula'], ['Segunda', 'Redes'], ['Terça', 'Hardware'], ['Quarta', 'Sistemas'], ['Quinta', 'Suporte']],
      { 'A1:B1': { b: 1, bg: '#6aa84f', fc: '#ffffff' }, 'A2:A5': { b: 1 } }),
  },
  {
    id: 's04', title: 'Estoque de peças', tips: ['Cabeçalho em negrito com fundo cinza', 'Todas as bordas na tabela'],
    cells: sheet([['Peça', 'Quantidade'], ['Mouse', '12'], ['Teclado', '8'], ['Monitor', '3'], ['Cabo HDMI', '20']],
      { 'A1:B5': { bd: 1 }, 'A1:B1': { b: 1, bg: '#d9d9d9' } }),
  },
  {
    id: 's05', title: 'Preços da loja', tips: ['Cabeçalho laranja em negrito', 'Preços em R$ (botão R$)'],
    cells: sheet([['Item', 'Preço'], ['Pen drive', '35'], ['Fone', '49,9'], ['Carregador', '60']],
      { 'A1:B1': { b: 1, bg: '#ff9900' }, 'B2:B4': { fmt: 'brl' } }),
  },
  {
    id: 's06', title: 'Placar do campeonato', tips: ['1º colocado com fundo amarelo e negrito', 'Pontos centralizados'],
    cells: sheet([['Time', 'Pontos'], ['Leões', '12'], ['Águias', '9'], ['Tubarões', '7']],
      { 'A1:B1': { b: 1 }, 'A2:B2': { bg: '#ffff00', b: 1 }, 'B1:B4': { al: 'c' } }),
  },
  {
    id: 's07', title: 'Ramais da escola', tips: ['Cabeçalho roxo, negrito, letra branca', 'Todas as bordas'],
    cells: sheet([['Setor', 'Ramal'], ['Secretaria', '201'], ['Direção', '202'], ['Biblioteca', '205'], ['Laboratório', '210']],
      { 'A1:B5': { bd: 1 }, 'A1:B1': { b: 1, bg: '#674ea7', fc: '#ffffff' } }),
  },
  {
    id: 's08', title: 'Gastos do mês', tips: ['Cabeçalho com fundo azul claro', 'Valores em R$', 'Linha Total em negrito e verde claro'],
    cells: sheet([['Conta', 'Valor'], ['Luz', '120'], ['Água', '80'], ['Internet', '100'], ['Total', '300']],
      { 'A1:B1': { b: 1, bg: '#c9daf8' }, 'B2:B5': { fmt: 'brl' }, 'A5:B5': { b: 1, bg: '#d9ead3' } }),
  },
  {
    id: 's09', title: 'Treino da semana', tips: ['Cabeçalho ciano em negrito', 'Números centralizados'],
    cells: sheet([['Exercício', 'Séries', 'Repetições'], ['Flexão', '3', '12'], ['Agachamento', '4', '15'], ['Abdominal', '3', '20']],
      { 'A1:C1': { b: 1, bg: '#00ffff' }, 'B1:C4': { al: 'c' } }),
  },
  {
    id: 's10', title: 'Cardápio da semana', tips: ['Cabeçalho vermelho com letra branca', 'Pratos em itálico'],
    cells: sheet([['Dia', 'Prato'], ['Segunda', 'Macarrão'], ['Terça', 'Feijoada'], ['Quarta', 'Frango'], ['Quinta', 'Peixe']],
      { 'A1:B1': { b: 1, bg: '#ff0000', fc: '#ffffff' }, 'B2:B5': { i: 1 } }),
  },
  {
    id: 's11', title: 'Inventário do laboratório', tips: ['OK em verde e negrito', 'Defeito em vermelho e negrito'],
    cells: sheet([['Equipamento', 'Status'], ['PC 01', 'OK'], ['PC 02', 'Defeito'], ['Impressora', 'OK'], ['Roteador', 'Defeito']],
      { 'A1:B1': { b: 1 }, 'B2,B4': { fc: '#38761d', b: 1 }, 'B3,B5': { fc: '#ff0000', b: 1 } }),
  },
  {
    id: 's12', title: 'Livros lidos', tips: ['Cabeçalho com fundo laranja claro', 'Nomes dos livros em itálico'],
    cells: sheet([['Livro', 'Páginas'], ['Dom Casmurro', '256'], ['O Alienista', '96'], ['Iracema', '180']],
      { 'A1:B1': { b: 1, bg: '#fce5cd' }, 'A2:A4': { i: 1 } }),
  },
  {
    id: 's13', title: 'Agenda de provas', tips: ['Título em negrito, tamanho 14', 'Tabela com bordas e cabeçalho azul claro'],
    cells: sheet([['Provas de Março'], [], ['Data', 'Matéria'], ['10/03', 'Redes'], ['17/03', 'Hardware'], ['24/03', 'Sistemas']],
      { A1: { b: 1, fs: 14 }, 'A3:B6': { bd: 1 }, 'A3:B3': { b: 1, bg: '#cfe2f3' } }),
  },
  {
    id: 's14', title: 'Temperatura das cidades', tips: ['Cidades quentes com fundo vermelho claro', 'Cidades frias com fundo azul claro'],
    cells: sheet([['Cidade', 'Temperatura'], ['Cuiabá', '38'], ['Curitiba', '15'], ['Manaus', '33'], ['Gramado', '9']],
      { 'A1:B1': { b: 1 }, 'B2,B4': { bg: '#f4cccc' }, 'B3,B5': { bg: '#cfe2f3' } }),
  },
  {
    id: 's15', title: 'Ranking de jogos', tips: ['Cabeçalho cinza escuro com letra branca', '1º lugar com fundo dourado e negrito', 'Posições centralizadas'],
    cells: sheet([['Posição', 'Jogo'], ['1', 'Minecraft'], ['2', 'Roblox'], ['3', 'Free Fire']],
      { 'A1:B1': { b: 1, bg: '#434343', fc: '#ffffff' }, 'A2:B2': { bg: '#f1c232', b: 1 }, 'A1:A4': { al: 'c' } }),
  },
  {
    id: 's16', title: 'Checklist de manutenção', tips: ['"Sim" com fundo verde claro', '"Não" com fundo vermelho claro', 'Coluna Feito centralizada'],
    cells: sheet([['Tarefa', 'Feito'], ['Limpar teclado', 'Sim'], ['Trocar a fonte', 'Não'], ['Atualizar', 'Sim']],
      { 'A1:B1': { b: 1 }, 'B2,B4': { bg: '#b6d7a8' }, B3: { bg: '#ea9999' }, 'B1:B4': { al: 'c' } }),
  },
  {
    id: 's17', title: 'Orçamento do PC', tips: ['Cabeçalho azul escuro com letra branca', 'Preços em R$', 'Total em negrito'],
    cells: sheet([['Peça', 'Preço'], ['Processador', '900'], ['Placa-mãe', '600'], ['Memória', '250'], ['Total', '1750']],
      { 'A1:B1': { b: 1, bg: '#1155cc', fc: '#ffffff' }, 'B2:B5': { fmt: 'brl' }, 'A5:B5': { b: 1 } }),
  },
  {
    id: 's18', title: 'Lista de chamada', tips: ['Cabeçalho com fundo rosa claro', 'Fábio tachado e em cinza'],
    cells: sheet([['Aluno', 'Faltas'], ['Davi', '2'], ['Elisa', '0'], ['Fábio', '12'], ['Gabi', '1']],
      { 'A1:B1': { b: 1, bg: '#ead1dc' }, 'A4:B4': { s: 1, fc: '#999999' } }),
  },
];

export const CHALLENGES: Challenge[] = [
  ...DOCS.map((c) => ({ ...c, kind: 'docs' as const })),
  ...SHEETS.map((c) => ({ ...c, kind: 'sheets' as const })),
];
export const CHALLENGE_BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));
export const challengesOf = (kind: Kind) => CHALLENGES.filter((c) => c.kind === kind);
