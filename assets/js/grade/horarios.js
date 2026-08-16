/* ============================================================
   GRD_HORARIOS — o arquivo do sistema acadêmico

   A coordenação de curso publica uma planilha por curso, já com
   colunas em português ("Turma", "Componente curricular"). O
   sistema acadêmico exporta outra coisa: um arquivo só, com todos
   os cursos, e com as colunas que o próprio sistema usa:

     Allocated Student Set Description | Descrição | Nome do pessoal
     atribuído | Dias agendados | Hora de início agendada |
     Fim Agendado | Nome da localização atribuída

   Duas diferenças mudam a leitura, e não só o nome das colunas:

   1. A primeira coluna não é "a turma": é a lista de turmas que
      assistem àquela aula, separadas por ponto e vírgula. Economia
      dada para Computação, Química e o gerencial de Computação é
      UMA linha com três turmas. Ler só a primeira faria a
      disciplina sumir da grade dos outros dois cursos.

   2. Disciplina, código e turma dona vêm grudados na "Descrição":
      "20231GRDARQGERENCIAL|GRD-CIV-2220 - Estruturas Metálicas - 4",
      onde o "- 4" é a quarta aula da semana daquela turma, e não
      parte do nome da disciplina.

   Em vez de ensinar essas duas regras ao normalizador — que é
   genérico de propósito, para a planilha do ano que vem continuar
   valendo —, este módulo reescreve as linhas no formato que ele já
   lê. Quem chama não precisa saber qual dos dois formatos chegou.
   ============================================================ */

import { semAcento } from './oferta.js';

/* O cabeçalho sai como o da planilha de coordenação: é ele que o
   normalizador reconhece por sinônimo, sem nada aqui saber de
   índice de coluna. */
const CABECALHO = [
  'Curso', 'Código da turma', 'Turma', 'Código da disciplina', 'Disciplina',
  'Docente', 'Dia', 'Início', 'Fim', 'Sala', 'Compartilhada',
];

/* Os títulos do arquivo do sistema. O inglês está aqui porque a
   exportação sai meio traduzida — a primeira coluna nunca foi. */
const TITULOS = {
  conjunto: ['allocated student set', 'conjunto de alunos', 'turmas alocadas'],
  descricao: ['descricao', 'description'],
  docente: ['nome do pessoal atribuido', 'pessoal atribuido', 'staff'],
  dia: ['dias agendados', 'dia agendado', 'scheduled days'],
  inicio: ['hora de inicio agendada', 'hora de inicio', 'scheduled start'],
  fim: ['fim agendado', 'hora de fim agendada', 'scheduled end'],
  local: ['nome da localizacao atribuida', 'localizacao atribuida', 'allocated location'],
};

/* O que o sufixo do código de turma quer dizer. Vem do que a própria
   coordenação escreve na planilha dela: 20242GRDECPDIU é a turma
   "2024.2 — Integral". Manter o mesmo rótulo é o que faz os dois
   arquivos falarem da mesma turma quando o aluno soma os dois. */
const MODALIDADES = { DIU: 'Integral', NOT: 'Noturno', GERENCIAL: 'Gerencial' };

const limpar = (valor) => String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();

function acharColuna(cabecalho, titulos) {
  return cabecalho.findIndex((titulo) => titulos.some((t) => titulo.startsWith(t)));
}

/**
 * O cabeçalho do arquivo do sistema, se for ele que chegou.
 *
 * Exige as três colunas que definem o formato — o conjunto de
 * alunos, a descrição grudada e o dia. Sem qualquer uma delas a
 * tradução abaixo não teria de onde tirar turma ou disciplina, e
 * o melhor a fazer é devolver as linhas como vieram.
 */
function acharCabecalho(linhas) {
  const teto = Math.min(linhas.length, 20);
  for (let i = 0; i < teto; i++) {
    const cabecalho = (linhas[i] || []).map(semAcento);
    if (!cabecalho.length) continue;

    const mapa = {};
    for (const [campo, titulos] of Object.entries(TITULOS)) {
      const j = acharColuna(cabecalho, titulos);
      if (j >= 0) mapa[campo] = j;
    }
    if (mapa.conjunto !== undefined && mapa.descricao !== undefined && mapa.dia !== undefined) {
      return { indice: i, mapa };
    }
  }
  return null;
}

/**
 * "20242GRDECPDIU" -> { ingresso: "2024.2", rotulo: "2024.2 — Integral" }.
 *
 * Código que não segue o padrão vira rótulo de si mesmo: é feio na
 * tela, mas continua sendo o identificador certo da turma — e some
 * sozinho quando o sistema padronizar.
 */
export function turmaDoCodigo(codigo) {
  const ano = codigo.match(/^(\d{4})([12])/);
  if (!ano) return codigo;

  const ingresso = ano[1] + '.' + ano[2];
  const sufixo = (codigo.match(/(DIU|NOT|GERENCIAL)$/) || [])[1];
  return sufixo ? ingresso + ' — ' + MODALIDADES[sufixo] : ingresso;
}

/**
 * "20221GRDECPDIU - Engenharia de Computação" -> código e curso.
 *
 * O separador é " - " com espaços, e não o primeiro hífen: há curso
 * com hífen no nome, e o código nunca tem espaço.
 */
function lerConjunto(texto) {
  const corte = texto.indexOf(' - ');
  if (corte < 0) return { codigo: limpar(texto), cursoNome: '' };
  return { codigo: limpar(texto.slice(0, corte)), cursoNome: limpar(texto.slice(corte + 3)) };
}

/**
 * "20231GRDARQGERENCIAL|GRD-CIV-2220 - Estruturas Metálicas - 4"
 * -> código da disciplina e nome, sem o número da aula.
 *
 * O "- 4" no fim é a quarta aula da semana daquela turma, não parte
 * do nome: sem tirá-lo, "Estruturas Metálicas" viraria quatro
 * disciplinas diferentes no catálogo, cada uma com um encontro.
 * Só o último número sai — "Física A - Prática" tem hífen no nome.
 */
export function lerDescricao(texto) {
  const barra = texto.indexOf('|');
  const resto = limpar(barra < 0 ? texto : texto.slice(barra + 1));

  const comCodigo = resto.match(/^([A-Za-zÀ-ÿ]{2,}(?:-[A-Za-z0-9]+){1,3})\s+-\s+(.+)$/);
  const codigo = comCodigo ? comCodigo[1] : '';
  let nome = comCodigo ? comCodigo[2] : resto;

  const semNumero = nome.replace(/\s*-\s*\d+$/, '');
  if (semNumero) nome = semNumero;

  return { codigo, disciplina: limpar(nome) };
}

/**
 * Reescreve o arquivo do sistema acadêmico no formato da planilha
 * de coordenação — ou devolve null quando não é esse arquivo.
 *
 * Uma linha com três turmas vira três linhas, uma por turma: é o
 * mesmo horário, mas cada turma é uma matrícula diferente, e é a
 * turma que o aluno escolhe. O agrupamento por turma que vem
 * depois é o do normalizador, que já sabe fazê-lo.
 *
 * @param {string[][]} linhas
 * @returns {string[][]|null}
 */
export function adaptarHorarios(linhas) {
  if (!Array.isArray(linhas) || !linhas.length) return null;
  const achado = acharCabecalho(linhas);
  if (!achado) return null;

  const { indice, mapa } = achado;
  const celula = (linha, campo) => (mapa[campo] === undefined ? '' : limpar(linha[mapa[campo]]));
  const saida = [CABECALHO.slice()];

  for (let i = indice + 1; i < linhas.length; i++) {
    const linha = linhas[i] || [];
    const descricao = celula(linha, 'descricao');
    if (!descricao) continue;

    const { codigo: codigoDisciplina, disciplina } = lerDescricao(descricao);
    if (!disciplina) continue;

    const conjuntos = celula(linha, 'conjunto').split(';').map(lerConjunto).filter((c) => c.codigo);
    /* linha sem conjunto de alunos ainda é uma aula: entra com a turma
       dona da descrição, que é quem a oferece */
    if (!conjuntos.length) {
      const dono = descricao.indexOf('|') > 0 ? descricao.slice(0, descricao.indexOf('|')) : '';
      if (dono) conjuntos.push({ codigo: limpar(dono), cursoNome: '' });
    }

    const compartilhada = conjuntos.length > 1 ? 'Sim' : '';

    for (const conjunto of conjuntos) {
      saida.push([
        conjunto.cursoNome,
        conjunto.codigo,
        turmaDoCodigo(conjunto.codigo),
        codigoDisciplina,
        disciplina,
        celula(linha, 'docente'),
        celula(linha, 'dia'),
        celula(linha, 'inicio'),
        celula(linha, 'fim'),
        celula(linha, 'local'),
        compartilhada,
      ]);
    }
  }

  /* cabeçalho reconhecido mas nenhuma aula legível: devolver a matriz
     só com o cabeçalho esconderia o arquivo original de quem chamou */
  return saida.length > 1 ? saida : null;
}
