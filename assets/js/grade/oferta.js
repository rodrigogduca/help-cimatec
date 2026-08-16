/* ============================================================
   OFERTA — do arquivo da coordenação para o modelo

   Uma linha da planilha é UMA AULA (turma + dia + horário).
   O aluno, porém, não matricula aulas: matricula TURMAS. Então a
   normalização agrupa as linhas por turma e guarda os encontros
   dentro dela — é esse agrupamento que faz "remover Machine
   Learning" apagar segunda e quarta de uma vez.

   Nada aqui conhece a planilha do CIMATEC em particular: as colunas
   são reconhecidas por sinônimo, para o mesmo código continuar
   valendo quando a coordenação mudar o cabeçalho ou outro curso
   trouxer o arquivo dele.
   ============================================================ */

import { lerXlsx } from './xlsx.js';
import { lerXls } from './xls.js';
import { adaptarHorarios } from './horarios.js';

export const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const AULA_MIN = 50;   /* 1 aula = 50 min, como no resto do site */

/* A oferta de um curso tem algumas centenas de linhas; a de uma
   universidade inteira, alguns milhares. Acima disso o arquivo não é
   uma oferta — e o catálogo desenha um botão por turma, então deixar
   correr solto trava a página de quem abriu o arquivo errado. */
const TETO_LINHAS = 20000;

/* ------------------------------------------------------------
   texto
   ------------------------------------------------------------ */

/** "Cálculo A — Turma 1" -> "calculo a — turma 1" (sem acento, minúsculo). */
export function semAcento(texto) {
  return String(texto == null ? '' : texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** "Álgebra Linear II" -> "algebra-linear-ii" */
export function slug(texto) {
  return semAcento(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function limpar(valor) {
  return String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------
   colunas
   ------------------------------------------------------------ */

/* O primeiro sinônimo que aparecer no cabeçalho ganha a coluna.
   São comparados sem acento e por prefixo, então "Turma(s) de
   Computação" casa com "turma" e "Hora início" casa com "inicio". */
const COLUNAS = {
  curso: ['curso', 'graduacao'],
  turma: ['turma(s)', 'turmas', 'turma'],
  codigo: ['codigo da turma', 'codigo'],
  codigoDisciplina: ['codigo da disciplina', 'codigo do componente'],
  dia: ['dia'],
  horario: ['horario', 'faixa'],
  inicio: ['inicio', 'hora inicio', 'comeco'],
  fim: ['fim', 'termino', 'hora fim'],
  disciplina: ['disciplina', 'componente curricular', 'componente', 'materia'],
  subturma: ['subturma'],
  docente: ['docente', 'professor', 'professores'],
  local: ['local', 'sala', 'ambiente'],
  compartilhada: ['entre turmas', 'compartilhada', 'aula'],
};

function mapearColunas(cabecalho) {
  const normalizado = cabecalho.map(semAcento);
  const mapa = {};
  for (const [campo, sinonimos] of Object.entries(COLUNAS)) {
    for (const sinonimo of sinonimos) {
      const i = normalizado.findIndex((titulo, idx) => {
        if (Object.values(mapa).includes(idx)) return false;
        return titulo === sinonimo || titulo.startsWith(sinonimo + ' ') || titulo.startsWith(sinonimo + '(');
      });
      if (i >= 0) { mapa[campo] = i; break; }
    }
  }
  return mapa;
}

/** Uma linha só serve de cabeçalho se trouxer disciplina, dia e alguma hora. */
function pontuarCabecalho(mapa) {
  if (mapa.disciplina === undefined || mapa.dia === undefined) return 0;
  if (mapa.horario === undefined && mapa.inicio === undefined) return 0;
  return Object.keys(mapa).length;
}

/**
 * Acha a linha de cabeçalho. As planilhas da coordenação costumam
 * abrir com título e subtítulo mesclados, então o cabeçalho real
 * quase nunca é a primeira linha.
 */
function acharCabecalho(linhas) {
  let melhor = null;
  const teto = Math.min(linhas.length, 20);
  for (let i = 0; i < teto; i++) {
    const mapa = mapearColunas(linhas[i] || []);
    const pontos = pontuarCabecalho(mapa);
    if (pontos && (!melhor || pontos > melhor.pontos)) melhor = { indice: i, mapa, pontos };
  }
  return melhor;
}

/**
 * O funil por onde toda matriz passa antes de ser lida.
 *
 * O arquivo do sistema acadêmico (GRD_HORARIOS) não tem as colunas
 * da planilha de coordenação, e uma linha dele pode valer por três
 * turmas. Traduzir aqui, e não no meio da normalização, é o que
 * deixa o resto deste arquivo continuar genérico: quem lê depois
 * vê sempre a mesma forma de tabela, venha ela de qual origem for.
 *
 * `adaptarHorarios` devolve null para tudo que não seja aquele
 * arquivo — inclusive para a saída dele mesmo, o que torna esta
 * passagem segura de repetir.
 */
function preparar(linhas) {
  return adaptarHorarios(linhas) || linhas;
}

/**
 * Escolhe a aba que é a oferta.
 *
 * O arquivo da coordenação também traz abas de resumo (grade
 * desenhada, contagens), que têm dia e horário mas não têm uma
 * aula por linha. Ganha a aba com mais colunas reconhecidas e,
 * no empate, a mais longa — é a que traz código de turma, docente
 * e local, e é deles que sai a equivalência entre cursos.
 */
export function escolherPlanilha(planilhas, nomes) {
  let melhor = null;
  for (const nome of (nomes || Object.keys(planilhas))) {
    if (!planilhas[nome] || !planilhas[nome].length) continue;
    const linhas = preparar(planilhas[nome]);
    const achado = acharCabecalho(linhas);
    if (!achado) continue;
    const pontos = achado.pontos * 10000 + linhas.length;
    if (!melhor || pontos > melhor.pontos) melhor = { nome, linhas, pontos };
  }
  return melhor;
}

/**
 * Curso e semestre saem do título das planilhas, quando existe:
 * "Grade de aulas — Engenharia de Computação" / "Semestre 2026.2".
 * A aba com os dados costuma ter um título curto, então o texto de
 * todas elas é varrido junto.
 */
export function metaDeTitulos(titulos) {
  /* o corte não é economia: a regex abaixo tem quantificador seguido de
     \s*, e uma única célula com megabytes de espaço faria o casamento
     voltar atrás caractere a caractere. Um título de planilha cabe
     folgado em 4 kB, e é nas primeiras células que ele mora */
  const topo = titulos.join(' | ').slice(0, 4000);
  const curso = (topo.match(/[—–-]\s*([A-ZÁÂÃÉÊÍÓÔÕÚÇ][^|]{3,60}?)\s*(?:\||$)/) || [])[1];
  const periodo = (topo.match(/(20\d{2})\.([12])/) || []).slice(1).join('.');
  return { cursoNome: curso ? curso.trim() : '', periodo };
}

/**
 * O que a planilha diz de si entre o título e o cabeçalho.
 *
 * É ali que a coordenação escreve o que ficou de fora — "Sem
 * participação de outros cursos", "Cálculo, Química e Administração
 * removidos". Sem isso na tela, quem procura Cálculo Vetorial e não
 * acha conclui que o site perdeu a disciplina, quando o arquivo é que
 * nunca a trouxe.
 *
 * Título mesclado repete o mesmo texto na linha inteira, então basta a
 * primeira célula preenchida de cada linha. A linha 0 é o título, que
 * já virou curso e período; da 1 até o cabeçalho é ressalva.
 */
function ressalvaDeLinhas(linhas, ateOCabecalho) {
  const partes = [];
  for (let i = 1; i < ateOCabecalho; i++) {
    const texto = limpar((linhas[i] || []).find(Boolean) || '');
    if (texto.length > 20 && !partes.includes(texto)) partes.push(texto);
  }
  return partes.join(' ');
}

/**
 * O que cada aba escreve acima do cabeçalho, que é onde mora o título.
 *
 * O corte é o cabeçalho, e não um número de linhas: o arquivo do
 * sistema acadêmico abre direto nele, sem título nenhum, e uma
 * fatia fixa pegaria a primeira linha de dados. Dali sairia "2018.1"
 * — o ingresso da primeira turma do arquivo — como se fosse o
 * semestre da oferta inteira.
 */
export function titulosDasPlanilhas(planilhas, nomes) {
  const titulos = [];
  for (const nome of (nomes || Object.keys(planilhas))) {
    if (!planilhas[nome]) continue;
    const linhas = preparar(planilhas[nome]);
    const achado = acharCabecalho(linhas);
    const ate = Math.min(achado ? achado.indice : 3, 3);
    for (const linha of linhas.slice(0, ate)) titulos.push(...new Set(linha));
  }
  return titulos;
}

/* ------------------------------------------------------------
   valores
   ------------------------------------------------------------ */

const APELIDOS_DIA = {
  seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado',
};

/** "segunda-feira", "SEG", "2ª" -> "Segunda". Devolve null para EAD/vazio. */
export function normalizarDia(valor) {
  const bruto = semAcento(valor);
  if (!bruto || bruto === 'ead' || bruto === '-' || bruto === '—') return null;
  const numero = bruto.match(/^([2-7])[ªa]?$/);
  if (numero) return DIAS[Number(numero[1]) - 2] || null;
  const chave = bruto.slice(0, 3);
  return APELIDOS_DIA[chave] || null;
}

/**
 * "16:40" -> 1000 minutos. Aceita "16h40", "1640" e "16:40:00".
 *
 * Aceita também a fração do dia — 0,694444 é como a planilha guarda
 * 16:40 por dentro, e é assim que a hora chega quando o arquivo do
 * sistema acadêmico é exportado em .csv, sem o formato da célula
 * que a transformaria em hora na tela.
 */
export function paraMinutos(valor) {
  const texto = limpar(valor);

  const fracao = texto.match(/^0[.,](\d+)$/);
  if (fracao) return Math.round(Number('0.' + fracao[1]) * 1440);

  const m = texto.match(/^(\d{1,2})\s*[:h.]?\s*(\d{2})(?:\s*[:m]?\s*\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function paraHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/** "16:40–18:20" -> {inicio: 1000, fim: 1100}. Trata en dash, hífen e "às". */
function faixaDeHorario(valor) {
  const partes = String(valor || '').split(/[–—\-]|\bas\b|\bàs\b/i);
  if (partes.length < 2) return null;
  const inicio = paraMinutos(partes[0]);
  const fim = paraMinutos(partes[1]);
  if (inicio === null || fim === null || fim <= inicio) return null;
  return { inicio, fim };
}

/** "Sistemas Digitais - Subturma: SUBTURMA A" -> nome + subturma. */
function separarSubturma(nome) {
  const m = nome.match(/^(.*?)\s*[-–—]?\s*subturma\s*:?\s*(.+)$/i);
  if (!m) return { nome: nome, subturma: '' };
  const rotulo = limpar(m[2]).replace(/^subturma\s*/i, '');
  return { nome: limpar(m[1]), subturma: rotulo.toUpperCase() };
}

/* ------------------------------------------------------------
   normalização
   ------------------------------------------------------------ */

/** Encontros contíguos no mesmo dia e local viram um só bloco. */
function unirEncontros(encontros) {
  const unidos = [];
  const ordenados = encontros.slice().sort((a, b) => {
    if (a.dia !== b.dia) return DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia);
    return (a.inicio || 0) - (b.inicio || 0);
  });

  for (const e of ordenados) {
    const anterior = unidos[unidos.length - 1];
    const mesmoLugar = anterior && anterior.dia === e.dia && anterior.local === e.local;

    if (mesmoLugar && anterior.inicio === e.inicio && anterior.fim === e.fim) continue; /* linha repetida */
    if (mesmoLugar && anterior.fim === e.inicio) { anterior.fim = e.fim; continue; }
    if (!e.dia && anterior && !anterior.dia && anterior.local === e.local) continue;    /* EAD repetido */

    unidos.push(Object.assign({}, e));
  }
  return unidos;
}

/**
 * Linhas cruas -> turmas do modelo.
 *
 * @param {string[][]} linhas   matriz da planilha, cabeçalho incluído
 * @param {object} opcoes       { curso, cursoNome, periodo }
 */
export function normalizarLinhas(linhasBrutas, opcoes = {}) {
  const linhas = preparar(linhasBrutas);
  const achado = acharCabecalho(linhas);
  if (!achado) {
    throw new Error('Não encontrei as colunas de disciplina, dia e horário nesta planilha.');
  }

  const { indice, mapa } = achado;
  const avisos = [];
  const porTurma = new Map();
  const celula = (linha, campo) => (mapa[campo] === undefined ? '' : limpar(linha[mapa[campo]]));

  const ultima = Math.min(linhas.length, indice + 1 + TETO_LINHAS);
  if (linhas.length > ultima) {
    avisos.push('O arquivo tem ' + (linhas.length - indice - 1) + ' linhas de aula; foram lidas as ' +
      TETO_LINHAS + ' primeiras. Confira se é mesmo o arquivo de oferta.');
  }

  for (let i = indice + 1; i < ultima; i++) {
    const linha = linhas[i] || [];
    const nomeBruto = celula(linha, 'disciplina');
    if (!nomeBruto || nomeBruto === '—' || nomeBruto === '-') continue;

    const separado = separarSubturma(nomeBruto);
    const subturma = celula(linha, 'subturma') || separado.subturma;
    const disciplina = separado.nome;

    const cursoNome = celula(linha, 'curso') || opcoes.cursoNome || 'Curso não informado';
    const cursoId = slug(cursoNome);
    const rotuloTurma = celula(linha, 'turma') || '—';
    const codigo = celula(linha, 'codigo') || slug(rotuloTurma).toUpperCase();

    const dia = normalizarDia(celula(linha, 'dia'));
    let faixa = faixaDeHorario(celula(linha, 'horario'));
    if (!faixa && mapa.inicio !== undefined) {
      const inicio = paraMinutos(celula(linha, 'inicio'));
      const fim = paraMinutos(celula(linha, 'fim'));
      if (inicio !== null && fim !== null && fim > inicio) faixa = { inicio, fim };
    }

    if (dia && !faixa) {
      avisos.push('Linha ' + (i + 1) + ': "' + disciplina + '" tem dia mas não tem horário legível — foi para a lista sem horário.');
    }

    const disciplinaId = slug(disciplina);
    const id = [cursoId, codigo, disciplinaId, slug(subturma)].filter(Boolean).join('.');

    let turma = porTurma.get(id);
    if (!turma) {
      turma = {
        id,
        curso: cursoId,
        cursoNome,
        disciplina,
        disciplinaId,
        codigoDisciplina: celula(linha, 'codigoDisciplina') || '',
        subturma,
        turma: rotuloTurma,
        codigo,
        ingresso: (rotuloTurma.match(/\d{4}\.\d/) || [''])[0],
        modalidade: limpar(rotuloTurma.split(/[–—]/)[1] || ''),
        docentes: [],
        locais: [],
        encontros: [],
      };
      porTurma.set(id, turma);
    }

    /* o docente vem separado por ponto e vírgula quando a turma tem banca */
    for (const nome of celula(linha, 'docente').split(';')) {
      const docente = limpar(nome);
      if (docente && !turma.docentes.includes(docente)) turma.docentes.push(docente);
    }

    const local = celula(linha, 'local');
    if (local && !turma.locais.includes(local)) turma.locais.push(local);

    const compartilhada = semAcento(celula(linha, 'compartilhada'));
    if (compartilhada === 'sim' || compartilhada === 'compartilhada') turma.compartilhada = true;

    turma.encontros.push({
      dia,
      inicio: faixa ? faixa.inicio : null,
      fim: faixa ? faixa.fim : null,
      local,
    });
  }

  const turmas = [];
  for (const turma of porTurma.values()) {
    turma.encontros = unirEncontros(turma.encontros);
    turma.compartilhada = !!turma.compartilhada;
    turma.minutos = turma.encontros.reduce((soma, e) => soma + (e.dia && e.fim ? e.fim - e.inicio : 0), 0);
    turma.aulas = Math.round(turma.minutos / AULA_MIN);
    turma.ead = turma.encontros.some((e) => !e.dia);
    turmas.push(turma);
  }

  return { turmas, avisos, ressalva: ressalvaDeLinhas(linhas, indice) };
}

/**
 * Da turma mais nova para a mais velha, comparando dois rótulos —
 * "2026.2 — Integral" vem antes de "2024.1 — Noturno".
 *
 * Quem abre o simulador está montando o próximo semestre, e a turma do
 * próprio ingresso é quase sempre uma das últimas: em ordem crescente,
 * o aluno de 2026.1 rolava oito anos de oferta antes de chegar nela.
 * Rótulo sem ano legível vai para o fim — não dá para dizer onde entra,
 * e chutar o começo seria pior do que assumir que é exceção. Empate no
 * ano cai no alfabeto, que é o que separa Gerencial de Integral.
 *
 * O ano sai do próprio rótulo, e não do campo `ingresso`: o filtro do
 * catálogo ordena uma lista de rótulos, sem turma por trás, e um JSON
 * anexado pode chegar com `ingresso` vazio ou mentindo. Assim a mesma
 * regra vale para os dois, que é o que faz a primeira turma da lista
 * ser também a primeira do seletor.
 */
export function compararTurmas(a, b) {
  const anoA = ingressoDoRotulo(a);
  const anoB = ingressoDoRotulo(b);
  if (Boolean(anoA) !== Boolean(anoB)) return anoA ? -1 : 1;
  if (anoA !== anoB) return anoB.localeCompare(anoA);
  return String(a).localeCompare(String(b), 'pt-BR');
}

/**
 * "2026.2 — Integral" -> "2026.2". Vazio quando o rótulo não traz ano.
 *
 * O ingresso é o que o aluno reconhece como "a minha turma": a
 * modalidade que vem depois dele — Integral, Gerencial, Noturno — é uma
 * divisão interna do mesmo ingresso, e separá-la no filtro dobrava a
 * lista sem responder à pergunta que o aluno faz ali.
 */
export function ingressoDoRotulo(rotulo) {
  return (String(rotulo == null ? '' : rotulo).match(/\d{4}\.\d/) || [''])[0];
}

/**
 * Ordena no lugar e devolve o mesmo array. Vive aqui, e não em quem
 * lê o arquivo, porque montarOferta() é o funil por onde passam todas
 * as origens — planilha, CSV, JSON importado e JSON publicado.
 */
export function ordenarTurmas(turmas) {
  return turmas.sort((a, b) => compararTurmas(a.turma, b.turma) ||
    a.disciplina.localeCompare(b.disciplina, 'pt-BR'));
}

/**
 * Fecha a oferta: turmas + os blocos e dias que a grade precisa desenhar.
 * Os blocos saem dos próprios dados, então uma planilha com outra divisão
 * de horários desenha outra grade sem tocar em uma linha de código.
 */
export function montarOferta(turmas, meta = {}) {
  ordenarTurmas(turmas);

  const chaves = new Map();
  for (const turma of turmas) {
    for (const e of turma.encontros) {
      if (!e.dia) continue;
      chaves.set(e.inicio + '-' + e.fim, { inicio: e.inicio, fim: e.fim });
    }
  }

  const candidatos = [...chaves.values()].sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);

  /* Uma faixa da régua é sempre um número inteiro de aulas de AULA_MIN —
     no arquivo de 2026.2, todas as nove têm 100 minutos, duas aulas. O que
     não fecha nesse múltiplo não é uma faixa: é um evento que atravessa
     várias, como o Desafio Empreendedor de sábado, das 08:00 às 16:30.
     Deixá-lo virar linha própria punha um degrau de oito horas e meia entre
     07:10–08:50 e 09:00–10:40, e a régua da manhã deixava de se ler.

     Ele não some da grade: montarMapa() põe cada encontro em toda faixa que
     ele cruza, então o evento aparece desenhado nas faixas que ocupa de
     verdade. Só quem não cruza faixa nenhuma continua virando linha — sem
     isso, uma aula fora da régua ficaria sem lugar onde ser desenhada. */
  const inteiro = (b) => (b.fim - b.inicio) % AULA_MIN === 0;
  const regua = candidatos.filter(inteiro);

  const blocos = candidatos
    .filter((b) => inteiro(b) || !regua.some((r) => b.inicio < r.fim && r.inicio < b.fim))
    .map((b) => ({
      id: paraHora(b.inicio) + '-' + paraHora(b.fim),
      inicio: b.inicio,
      fim: b.fim,
      rotulo: paraHora(b.inicio) + '–' + paraHora(b.fim),
    }));

  /* quando o arquivo não diz o curso, quem responde é a primeira turma:
     a normalização já resolveu o nome dela, com coluna ou com o padrão */
  const primeira = turmas[0] || {};

  return {
    versao: 1,
    periodo: meta.periodo || '',
    curso: meta.curso || primeira.curso || '',
    cursoNome: meta.cursoNome || primeira.cursoNome || '',
    origem: meta.origem || '',
    /* o que a planilha avisa sobre o próprio conteúdo — ver ressalvaDeLinhas() */
    ressalva: meta.ressalva || '',
    gerado: meta.gerado || new Date().toISOString().slice(0, 10),
    equivalencias: meta.equivalencias || [],
    /* a semana inteira, mesmo sem aula no sábado: coluna vazia é
       informação — diz que o dia está livre, e não que sumiu */
    dias: DIAS.slice(),
    blocos,
    turmas,
  };
}

/**
 * Soma ofertas de arquivos diferentes numa só.
 *
 * A coordenação nem sempre publica a oferta inteira num arquivo. A de
 * Engenharia de Computação 2026.2, por exemplo, avisa no subtítulo que
 * saiu "sem participação de outros cursos", com Cálculo, Química e
 * Administração removidos: quem quiser essas disciplinas precisa da
 * planilha do curso que as oferece. Somar os arquivos é o que devolve
 * a oferta completa — e, junto com ela, a equivalência entre cursos,
 * que é o que deixa cursar Cálculo na turma de Engenharia Civil.
 *
 * Turma repetida entre arquivos entra uma vez só: o id já carrega
 * curso, código, disciplina e subturma, então a mesma turma nos dois
 * arquivos é a mesma linha, e não duas.
 */
export function unirOfertas(ofertas, meta = {}) {
  const porId = new Map();
  const origens = [];
  const ressalvas = [];
  const equivalencias = [];

  for (const oferta of ofertas) {
    if (!oferta) continue;
    for (const turma of oferta.turmas || []) {
      if (!porId.has(turma.id)) porId.set(turma.id, turma);
    }
    for (const grupo of oferta.equivalencias || []) equivalencias.push(grupo);
    if (oferta.origem && !origens.includes(oferta.origem)) origens.push(oferta.origem);
    if (oferta.ressalva && !ressalvas.includes(oferta.ressalva)) ressalvas.push(oferta.ressalva);
  }

  /* o período e o curso continuam sendo os do arquivo que abriu a tela:
     é a grade dele que o aluno está montando, e o segundo arquivo entrou
     para completá-la */
  const primeira = ofertas.find(Boolean) || {};

  return montarOferta([...porId.values()], Object.assign({
    periodo: primeira.periodo || '',
    curso: primeira.curso || '',
    cursoNome: primeira.cursoNome || '',
    origem: origens.join(' + '),
    ressalva: ressalvas.join(' '),
    equivalencias,
  }, meta));
}

/* ------------------------------------------------------------
   saneamento de oferta pronta

   Planilha e CSV passam por normalizarLinhas(), que constrói cada
   campo a partir de célula de texto — o tipo de tudo que sai de lá
   é conhecido. Um .json, não: ele já chega no formato final, e nada
   garante que "aulas" seja um número em vez de um pedaço de HTML.

   Por isso todo JSON importado é reconstruído aqui, campo a campo,
   com o tipo forçado. O que a página desenha depois é este objeto,
   nunca o que veio do arquivo — inclusive blocos e dias, que
   montarOferta() recalcula a partir dos encontros já saneados.
   ------------------------------------------------------------ */

const DIAS_VALIDOS = new Set(DIAS);

const comoTexto = (v) => (v == null ? '' : String(v));
const comoNumero = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const comoListaDeTexto = (v) => (Array.isArray(v) ? v.map(comoTexto) : []);

function sanearEncontro(bruto) {
  const e = bruto && typeof bruto === 'object' ? bruto : {};
  const dia = comoTexto(e.dia);
  const inicio = comoNumero(e.inicio);
  const fim = comoNumero(e.fim);
  return {
    /* dia fora da semana conhecida vira EAD em vez de virar coluna
       nova: o cabeçalho da grade é montado a partir de DIAS */
    dia: DIAS_VALIDOS.has(dia) ? dia : null,
    inicio,
    fim: Math.max(inicio, fim),
    local: comoTexto(e.local),
  };
}

function sanearTurma(bruto, i) {
  const t = bruto && typeof bruto === 'object' ? bruto : {};
  const encontros = (Array.isArray(t.encontros) ? t.encontros : []).map(sanearEncontro);
  /* minutos e aulas são recontados dos encontros: são eles que somam
     a carga do resumo, e um valor plantado desalinharia a conta */
  const minutos = encontros.reduce((soma, e) => soma + (e.fim - e.inicio), 0);
  const disciplina = comoTexto(t.disciplina);

  return {
    id: comoTexto(t.id) || 'turma-' + i,
    curso: comoTexto(t.curso),
    cursoNome: comoTexto(t.cursoNome),
    disciplina,
    disciplinaId: comoTexto(t.disciplinaId) || slug(disciplina),
    codigoDisciplina: comoTexto(t.codigoDisciplina),
    subturma: comoTexto(t.subturma),
    turma: comoTexto(t.turma),
    codigo: comoTexto(t.codigo),
    ingresso: comoTexto(t.ingresso),
    modalidade: comoTexto(t.modalidade),
    docentes: comoListaDeTexto(t.docentes),
    locais: comoListaDeTexto(t.locais),
    encontros,
    compartilhada: Boolean(t.compartilhada),
    minutos,
    aulas: Math.round(minutos / AULA_MIN),
    ead: Boolean(t.ead),
  };
}

/** Reconstrói uma oferta vinda de JSON com todo campo no tipo certo. */
export function sanearOferta(bruto) {
  const o = bruto && typeof bruto === 'object' ? bruto : {};
  const turmas = (Array.isArray(o.turmas) ? o.turmas : []).map(sanearTurma);

  return montarOferta(turmas, {
    periodo: comoTexto(o.periodo),
    curso: comoTexto(o.curso),
    cursoNome: comoTexto(o.cursoNome),
    origem: comoTexto(o.origem),
    ressalva: comoTexto(o.ressalva),
    gerado: comoTexto(o.gerado),
    equivalencias: Array.isArray(o.equivalencias)
      ? o.equivalencias.filter(Array.isArray).map(comoListaDeTexto)
      : [],
  });
}

/* ------------------------------------------------------------
   importação
   ------------------------------------------------------------ */

/**
 * Descobre o separador olhando as primeiras linhas inteiras.
 *
 * Olhar só a primeira linha não serve: a planilha da coordenação abre
 * com um título mesclado ("Grade de aulas — Engenharia Civil"), que
 * não tem separador nenhum. Exportada em CSV com ponto e vírgula, ela
 * era lida como uma coluna só, e o arquivo inteiro virava "não
 * encontrei as colunas de disciplina, dia e horário".
 *
 * A tabulação entra na disputa porque .tsv é aceito na importação.
 */
function separadorDe(texto) {
  const amostra = texto.slice(0, 4000);
  let melhor = ',';
  let mais = 0;
  for (const candidato of [';', ',', '\t']) {
    const quantos = amostra.split(candidato).length - 1;
    if (quantos > mais) { mais = quantos; melhor = candidato; }
  }
  return melhor;
}

/** CSV com aspas, quebras dentro do campo e separador detectado sozinho. */
export function lerCsv(texto) {
  const limpo = texto.replace(/^﻿/, '');
  const sep = separadorDe(limpo);

  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; }
        else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { aspas = true; continue; }
    if (c === sep) { linha.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue; }
    campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

/**
 * Lê o que o aluno soltar na página: .xlsx, .csv ou o próprio JSON
 * já normalizado (que é o formato que o site publica).
 */
export async function lerArquivo(arquivo, opcoes = {}) {
  const nome = arquivo.name || '';
  const extensao = (nome.split('.').pop() || '').toLowerCase();

  /* "Grade_Engenharia_2027_1.xlsx" -> 2027.1. O semestre não pode ser
     herdado da oferta anterior: sairia impresso no PDF do arquivo novo */
  const doNome = (nome.match(/(20\d{2})[._-]?([12])(?:\D|$)/) || []).slice(1).join('.');
  const meta = Object.assign({ origem: nome, periodo: doNome }, opcoes);

  if (extensao === 'json') {
    const dados = JSON.parse(await arquivo.text());
    if (Array.isArray(dados)) {
      const lido = normalizarLinhas(dados, meta);
      return montarOferta(lido.turmas, Object.assign({ ressalva: lido.ressalva }, meta));
    }
    if (!dados.turmas) throw new Error('Este JSON não tem a lista de turmas.');
    /* nunca devolver o objeto do arquivo direto: ele iria para a tela
       com os tipos que o autor do arquivo quisesse (ver sanearOferta) */
    return Object.assign(sanearOferta(dados), { origem: dados.origem ? comoTexto(dados.origem) : nome });
  }

  if (extensao === 'csv' || extensao === 'tsv' || extensao === 'txt') {
    const { turmas, avisos, ressalva } = normalizarLinhas(lerCsv(await arquivo.text()), meta);
    const oferta = montarOferta(turmas, Object.assign({ ressalva }, meta));
    oferta.avisos = avisos;
    return oferta;
  }

  if (extensao === 'xlsx' || extensao === 'xlsm' || extensao === 'xls') {
    const bytes = await arquivo.arrayBuffer();
    /* o .xls do Excel 97 é outro formato, não um .xlsx antigo: OLE2 com
       registros binários em vez de ZIP com XML. É o que o sistema
       acadêmico exporta, então tem leitor próprio */
    const { nomes, planilhas } = extensao === 'xls' ? lerXls(bytes) : await lerXlsx(bytes);
    const melhor = escolherPlanilha(planilhas, nomes);
    if (!melhor) throw new Error('Nenhuma aba desta planilha tem colunas de disciplina, dia e horário.');

    /* o que o arquivo diz de si vale mais que o palpite do nome dele,
       e menos que o que quem chamou informou explicitamente */
    const doTopo = metaDeTitulos(titulosDasPlanilhas(planilhas, nomes));
    const completo = Object.assign({}, meta, {
      cursoNome: opcoes.cursoNome || doTopo.cursoNome || meta.cursoNome,
      periodo: opcoes.periodo || doTopo.periodo || meta.periodo,
    });

    const { turmas, avisos, ressalva } = normalizarLinhas(melhor.linhas, completo);
    const oferta = montarOferta(turmas, Object.assign({ ressalva }, completo));
    oferta.avisos = avisos;
    oferta.aba = melhor.nome;
    return oferta;
  }

  throw new Error('Formato não suportado: .' + extensao + '. Use .xls, .xlsx, .csv ou .json.');
}

/** PDF não é lido aqui: a mensagem explica o caminho em vez de falhar em silêncio. */
export const AJUDA_PDF =
  'PDF não tem estrutura de tabela garantida. Peça o arquivo em Excel/CSV à coordenação, ' +
  'ou copie a tabela do PDF para uma planilha e exporte em .csv.';
