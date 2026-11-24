// Os 46 desafios: 36 básicos (18 Docs + 18 Sheets, usados no duelo) e 10 intermediários (5 + 5, para o contra todos).
// Ficam no código das telas: pela rede só passa o id.
// Estilos do Docs viram tags: Texto normal = p, Título = h1, Subtítulo = h6, Título 1 = h2, Título 2 = h3, Título 3 = h4.
import type { Kind } from './protocol.ts';
import { sheet, type Cells } from './sheet.ts';

export type Level = 'basico' | 'intermediario';
interface Base {
  id: string;
  level: Level;
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

const DOCS: Omit<DocsChallenge, 'kind' | 'level'>[] = [
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

const SHEETS: Omit<SheetsChallenge, 'kind' | 'level'>[] = [
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

// Intermediários: mais texto, mais estilos e tabelas maiores (pensados para partidas longas no contra todos).
const H = (pt: number, color: string, t: string) => `<span style="font-size:${pt}pt;color:${color}">${t}</span>`;
const DOCS_MID: Omit<DocsChallenge, 'kind' | 'level'>[] = [
  {
    id: 'd19', title: 'Relatório de manutenção',
    tips: ['Título e Subtítulo centralizados', 'Seções no estilo Título 1', 'Lista com rótulos em negrito', '"trocada" em negrito e vermelho', 'Assinatura em itálico à direita'],
    html: `<h1 ${C}>Relatório de Manutenção</h1><h6 ${C}>Laboratório de Informática - Sala 3</h6><h2>Problemas encontrados</h2>`
      + ul('<b>PC 04:</b> não liga', '<b>PC 09:</b> teclado com teclas soltas', '<b>Impressora:</b> papel atolado')
      + `<h2>Solução</h2><p>A fonte do PC 04 foi <b>${red('trocada')}</b> e o teclado foi <i>substituído</i>.</p><p ${R}><i>Técnico responsável: Lucas</i></p>`,
  },
  {
    id: 'd20', title: 'Currículo simples',
    tips: ['Nome no estilo Título', 'Contato no estilo Subtítulo', 'Seções no estilo Título 1', 'Listas com marcadores', 'Palavras-chave em negrito'],
    html: `<h1>Mariana Souza</h1><h6>mariana@email.com | (11) 99999-0000</h6><h2>Objetivo</h2><p>Trabalhar como <b>técnica de suporte</b> em informática.</p>`
      + `<h2>Formação</h2>${ul('Ensino Médio Técnico em Informática', 'Curso de Redes de Computadores')}`
      + `<h2>Habilidades</h2>${ul('<b>Hardware:</b> montagem e manutenção', '<b>Software:</b> Windows e Linux')}`,
  },
  {
    id: 'd21', title: 'Ata da reunião',
    tips: ['Título e Subtítulo centralizados', 'Seções no estilo Título 2', 'Lista numerada e lista com marcadores', 'Marca-texto amarelo e "dois" em negrito', 'Última frase sublinhada'],
    html: `<h1 ${C}>Ata da Reunião</h1><h6 ${C}>Grêmio Estudantil - 10 de abril</h6><h3>Participantes</h3>`
      + ol('Ana (presidente)', 'Bruno (tesoureiro)', 'Carla (secretária)')
      + `<h3>Decisões</h3>${ul(`Fazer uma ${mark('feira de tecnologia')} em maio`, 'Comprar <b>dois</b> notebooks para o grêmio')}`
      + `<p><u>Próxima reunião: 24 de abril.</u></p>`,
  },
  {
    id: 'd22', title: 'Folheto da Semana da Tecnologia',
    tips: ['Título azul, negrito, tamanho 30, centralizado', 'Data em itálico e centralizada', 'Dias da semana em negrito na lista', '"Inscrições abertas!" tamanho 18 com marca-texto amarelo', 'Assinatura cinza à direita'],
    html: `<p ${C}><b>${H(30, '#0000ff', 'SEMANA DA TECNOLOGIA')}</b></p><p ${C}><i>De 12 a 16 de maio, no pátio da escola</i></p>`
      + ul('<b>Segunda:</b> oficina de robótica', '<b>Quarta:</b> campeonato de jogos', '<b>Sexta:</b> palestra sobre segurança digital')
      + `<p ${C}><span style="font-size:18pt;background-color:#ffff00">Inscrições abertas!</span></p>`
      + `<p ${R}><span style="color:#666666">Organização: Grêmio</span></p>`,
  },
  {
    id: 'd23', title: 'Tutorial: senha forte',
    tips: ['Estilo Título 1', '"invasores" e "12 caracteres" em negrito', 'Lista numerada com 4 passos', 'Aviso em vermelho, negrito e centralizado', 'Dica final em itálico'],
    html: `<h2>Como criar uma senha forte</h2><p>Uma senha forte protege suas contas contra <b>invasores</b>.</p>`
      + ol('Use <b>12 caracteres</b> ou mais', 'Misture letras, números e símbolos', 'Não use datas de aniversário', 'Use uma senha diferente em cada site')
      + `<p ${C}><b>${red('Nunca compartilhe sua senha!')}</b></p><p><i>Dica: um gerenciador de senhas ajuda a lembrar de todas.</i></p>`,
  },
];

const SHEETS_MID: Omit<SheetsChallenge, 'kind' | 'level'>[] = [
  {
    id: 's19', title: 'Estoque da loja',
    tips: ['Título negrito, tamanho 14', 'Cabeçalho azul escuro com letra branca', 'Quantidades centralizadas', 'Preço e Total em R$', 'Total geral em negrito com fundo verde claro', 'Todas as bordas'],
    cells: sheet([['Estoque da Loja'], [], ['Produto', 'Quantidade', 'Preço', 'Total'], ['Mouse', '10', '25', '250'], ['Teclado', '5', '60', '300'],
      ['Headset', '4', '90', '360'], ['Webcam', '3', '120', '360'], ['Total geral', null, null, '1270']],
    { A1: { b: 1, fs: 14 }, 'A3:D8': { bd: 1 }, 'A3:D3': { b: 1, bg: '#1155cc', fc: '#ffffff' }, 'B4:B7': { al: 'c' }, 'C4:D7,D8': { fmt: 'brl' },
      'A8:D8': { b: 1, bg: '#d9ead3' } }),
  },
  {
    id: 's20', title: 'Boletim escolar',
    tips: ['Título negrito, tamanho 14', 'Cabeçalho amarelo e negrito', 'Notas centralizadas', 'Coluna Média em negrito', 'Médias abaixo de 6 em vermelho', 'Todas as bordas'],
    cells: sheet([['Boletim Escolar'], [], ['Matéria', 'Bim 1', 'Bim 2', 'Média'], ['Redes', '8', '9', '8,5'], ['Hardware', '6', '5', '5,5'],
      ['Sistemas', '9', '10', '9,5'], ['Suporte', '4', '7', '5,5']],
    { A1: { b: 1, fs: 14 }, 'A3:D7': { bd: 1 }, 'A3:D3': { b: 1, bg: '#ffd966' }, 'B3:D7': { al: 'c' }, 'D4:D7': { b: 1 }, 'D5,D7': { fc: '#ff0000' } }),
  },
  {
    id: 's21', title: 'Orçamento da festa',
    tips: ['Cabeçalho laranja em negrito', 'Linhas 3 e 5 com fundo cinza claro', 'Quantidades centralizadas', 'Valores em R$', 'Total em negrito', 'Todas as bordas'],
    cells: sheet([['Item', 'Qtd', 'Valor unitário', 'Total'], ['Refrigerante', '10', '8', '80'], ['Salgados', '100', '0,5', '50'],
      ['Bolo', '1', '120', '120'], ['Copos', '50', '0,2', '10'], ['Total', null, null, '260']],
    { 'A1:D6': { bd: 1 }, 'A1:D1': { b: 1, bg: '#ff9900' }, 'A3:D3,A5:D5': { bg: '#efefef' }, 'B2:B5': { al: 'c' }, 'C2:D5,D6': { fmt: 'brl' },
      'A6:D6': { b: 1 } }),
  },
  {
    id: 's22', title: 'Escala de limpeza',
    tips: ['Título verde escuro, negrito, tamanho 12', 'Cabeçalho verde com letra branca', 'Dias em negrito e tarefas em itálico', 'Quarta-feira com fundo amarelo', 'Todas as bordas'],
    cells: sheet([['Escala de Limpeza do Laboratório'], [], ['Dia', 'Responsável', 'Tarefa'], ['Segunda', 'Ana', 'Limpar teclados'],
      ['Terça', 'Bruno', 'Organizar cabos'], ['Quarta', 'Carla', 'Tirar o pó'], ['Quinta', 'Davi', 'Limpar telas'], ['Sexta', 'Elisa', 'Revisar mouses']],
    { A1: { b: 1, fs: 12, fc: '#38761d' }, 'A3:C8': { bd: 1 }, 'A3:C3': { b: 1, bg: '#6aa84f', fc: '#ffffff' }, 'A4:A8': { b: 1 }, 'C4:C8': { i: 1 },
      'A6:C6': { bg: '#ffff00' } }),
  },
  {
    id: 's23', title: 'Placar da gincana',
    tips: ['Cabeçalho roxo com letra branca', 'Pontos centralizados', 'Coluna Total em negrito', 'Equipe campeã com fundo dourado', 'Todas as bordas'],
    cells: sheet([['Equipe', 'Prova 1', 'Prova 2', 'Prova 3', 'Total'], ['Vermelha', '9', '9', '10', '28'], ['Azul', '10', '8', '9', '27'],
      ['Verde', '8', '6', '9', '23'], ['Amarela', '6', '7', '8', '21']],
    { 'A1:E5': { bd: 1 }, 'A1:E1': { b: 1, bg: '#674ea7', fc: '#ffffff' }, 'B1:E5': { al: 'c' }, 'E2:E5': { b: 1 }, 'A2:E2': { bg: '#f1c232' } }),
  },
];

const tag = <T,>(list: T[], level: Level) => list.map((c) => ({ ...c, level }));
export const CHALLENGES: Challenge[] = [
  ...tag(DOCS, 'basico').map((c) => ({ ...c, kind: 'docs' as const })),
  ...tag(SHEETS, 'basico').map((c) => ({ ...c, kind: 'sheets' as const })),
  ...tag(DOCS_MID, 'intermediario').map((c) => ({ ...c, kind: 'docs' as const })),
  ...tag(SHEETS_MID, 'intermediario').map((c) => ({ ...c, kind: 'sheets' as const })),
];
export const CHALLENGE_BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));
// Duelo: só os básicos (desafios rápidos de poucos minutos).
export const challengesOf = (kind: Kind) => CHALLENGES.filter((c) => c.kind === kind && c.level === 'basico');
