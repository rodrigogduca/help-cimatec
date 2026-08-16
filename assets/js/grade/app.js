/* ============================================================
   SIMULADOR DE GRADE — montagem

   Um fluxo só, sempre na mesma direção:

     arquivo -> oferta -> índice -> estado -> tela

   Nenhum pedaço da tela guarda estado próprio. Clicar muda a
   seleção; a seleção redesenha tudo, inclusive a folha do PDF.
   É o que garante que grade, resumo e PDF nunca discordem.
   ============================================================ */

import {
  lerArquivo, montarOferta, sanearOferta, unirOfertas,
  DIAS, AJUDA_PDF, semAcento, paraHora,
} from './oferta.js';
import { indexar, avaliar, montarMapa, resumo, paresEmChoque } from './regras.js';
import { criarEstado, ondeSalva } from './estado.js';
import { acharCurso, cruzarCatalogo, desenharCursos } from './cursos.js';
import {
  desenharCatalogo, desenharGrade, desenharSemHorario, desenharResumo,
  desenharEscolhidas, desenharAviso, nomeCompleto, horariosTexto, esc,
} from './ui.js';
import { prepararFolha, imprimir } from './pdf.js';

const CHAVE_CURSO = 'help-cimatec-grade-curso';
const CHAVE_OFERTA = 'help-cimatec-grade-oferta';

const el = (id) => document.getElementById(id);
const refs = {
  /* passo 1 — escolher o curso */
  selecao: el('selecao'),
  cursoGrid: el('cursoGrid'),
  selecaoEscolhido: el('selecaoEscolhido'),
  selecaoPeriodoCampo: el('selecaoPeriodoCampo'),
  selecaoPeriodo: el('selecaoPeriodo'),
  btnMontar: el('btnMontar'),
  btnImportarSelecao: el('btnImportarSelecao'),

  /* passo 2 — o simulador */
  simulador: el('simulador'),
  cursoSigla: el('cursoSigla'),
  cursoNome: el('cursoNome'),
  btnTrocarCurso: el('btnTrocarCurso'),

  oferta: el('ofertaSelect'),
  fonteNota: el('fonteNota'),
  arquivo: el('arquivoOferta'),

  busca: el('busca'),
  filtroCurso: el('filtroCurso'),
  filtroTurma: el('filtroTurma'),
  filtroDia: el('filtroDia'),
  filtroTurno: el('filtroTurno'),
  soLivres: el('soLivres'),
  lista: el('lista'),
  contador: el('contadorCatalogo'),

  grade: el('gradeSemanal'),
  semHorario: el('semHorario'),
  avisos: el('avisos'),
  resumo: el('resumo'),
  escolhidas: el('escolhidas'),
  btnLimpar: el('btnLimpar'),
  btnPdf: el('btnPdf'),
  impressao: el('impressao'),
};

let oferta = null;
let indice = null;
let estado = null;
let catalogo = [];              /* assets/data/ofertas.json */
let ofertasPorCurso = new Map();
let cursoEscolhido = null;      /* marcado no passo 1, ainda não confirmado */
let cursoAtual = null;          /* o curso cuja grade está na tela */

/* ------------------------------------------------------------
   filtros
   ------------------------------------------------------------ */

const filtros = { texto: '', curso: '', turma: '', dia: '', turno: '', soLivres: false };

const TURNOS = {
  manha: (e) => e.inicio < 750,
  tarde: (e) => e.inicio >= 750 && e.inicio < 1080,
  noite: (e) => e.inicio >= 1080,
};

/**
 * O curso de uma turma como a página o conhece.
 *
 * O arquivo escreve o nome do curso à mão, e a mesma "Engenharia de
 * Computação" aparece nele sem o "de" em duas linhas. Quem sabe que
 * as duas grafias são um curso só é o cursos.js; sem passar por ele,
 * o filtro ganharia duas opções e uma delas esconderia a outra.
 */
function cursoDaTurma(turma) {
  if (turma._cursoId === undefined) {
    const curso = acharCurso(turma.curso);
    turma._cursoId = curso ? curso.id : turma.curso;
  }
  return turma._cursoId;
}

/** Tudo que dá para digitar na busca de uma turma, junto e sem acento. */
function alvoBusca(turma) {
  if (!turma._busca) {
    turma._busca = semAcento([
      turma.disciplina, turma.subturma, turma.codigo, turma.codigoDisciplina,
      turma.turma, turma.cursoNome, turma.docentes.join(' '), turma.locais.join(' '),
    ].join(' '));
  }
  return turma._busca;
}

function passaNosFiltros(turma, parecer) {
  if (filtros.curso && cursoDaTurma(turma) !== filtros.curso) return false;
  if (filtros.turma && turma.turma !== filtros.turma) return false;
  if (filtros.dia && !turma.encontros.some((e) => e.dia === filtros.dia)) return false;
  if (filtros.turno) {
    const teste = TURNOS[filtros.turno];
    if (!turma.encontros.some((e) => e.dia && teste(e))) return false;
  }
  if (filtros.soLivres && parecer.conflitos.length && !estado.tem(turma.id)) return false;

  if (filtros.texto) {
    const alvo = alvoBusca(turma);
    /* todos os termos precisam aparecer: "iot 2024" acha a turma certa */
    return filtros.texto.split(/\s+/).every((termo) => alvo.includes(termo));
  }
  return true;
}

/* ------------------------------------------------------------
   avisos
   ------------------------------------------------------------ */

let avisoAberto = null;

/**
 * A área de aviso tem dois moradores: o parecer da última tentativa
 * (temporário, com botões) e o estado da grade (permanente, enquanto
 * houver choque). O temporário tem prioridade; ao ser dispensado, o
 * permanente reaparece sozinho — um choque forçado nunca fica mudo.
 */
function avisar(aviso) {
  avisoAberto = aviso || null;
  desenharAviso(refs.avisos, avisoAberto || avisoDaGrade());
}

function avisoDaGrade() {
  if (!estado) return null;
  const pares = paresEmChoque(estado.turmas());
  if (!pares.length) return null;

  return {
    tipo: 'choque',
    titulo: pares.length === 1 ? 'A sua grade tem 1 choque.' : 'A sua grade tem ' + pares.length + ' choques.',
    texto: pares.map((p) => nomeCompleto(p.a) + ' × ' + nomeCompleto(p.b) +
      ' (' + p.dia + ' ' + paraHora(p.inicio) + '–' + paraHora(p.fim) + ')').join('; ') +
      '. A matrícula não fecha assim — troque uma delas por outra turma da mesma disciplina.',
  };
}

function textoDoChoque(conflitos) {
  return conflitos.map((c) => nomeCompleto(c.turma) + ' (' + c.dia + ' ' +
    paraHora(c.inicio) + '–' + paraHora(c.fim) + ')').join('; ');
}

/* ------------------------------------------------------------
   ações sobre a seleção
   ------------------------------------------------------------ */

function alternar(id) {
  if (!estado || !indice) return;
  if (estado.tem(id)) {
    estado.remover(id);
    avisar(null);
    return;
  }

  const turma = indice.turma(id);
  if (!turma) return;

  const parecer = avaliar(turma, estado.turmas());

  if (parecer.gravidade === 'choque') {
    const alternativas = indice.alternativas(turma)
      .filter((t) => avaliar(t, estado.turmas()).livre);

    avisar({
      tipo: 'choque',
      titulo: 'Choque de horário.',
      texto: nomeCompleto(turma) + ' ocupa o mesmo horário de ' + textoDoChoque(parecer.conflitos) +
        '. Duas turmas no mesmo horário não fecham matrícula.',
      acoes: [
        ...alternativas.slice(0, 3).map((t) => ({
          acao: 'adicionar',
          id: t.id,
          /* turmas equivalentes muitas vezes só diferem na subturma:
             sem ela no rótulo, os dois botões ficariam idênticos */
          rotulo: 'Usar ' + t.turma + (t.subturma ? ' · subturma ' + t.subturma : '') +
            ' (' + horariosTexto(t) + ')',
        })),
        { acao: 'forcar', id: turma.id, rotulo: 'Adicionar mesmo assim', perigo: true },
        { acao: 'fechar', rotulo: 'Cancelar' },
      ],
    });
    return;
  }

  if (parecer.gravidade === 'duplicada') {
    const atual = parecer.equivalente;
    avisar({
      tipo: 'duplicada',
      titulo: 'Você já tem essa disciplina.',
      texto: nomeCompleto(atual) + ' (' + atual.turma + ') é a mesma disciplina de ' +
        nomeCompleto(turma) + ' (' + turma.turma + '). Cursar as duas não adianta carga horária.',
      acoes: [
        { acao: 'trocar', id: turma.id, sai: atual.id, rotulo: 'Trocar pela turma nova' },
        { acao: 'forcar', id: turma.id, rotulo: 'Manter as duas' },
        { acao: 'fechar', rotulo: 'Cancelar' },
      ],
    });
    return;
  }

  estado.adicionar(id);
  avisar(null);
}

/* ------------------------------------------------------------
   desenho
   ------------------------------------------------------------ */

function renderizarCatalogo() {
  const escolhidas = estado.turmas();
  const itens = [];

  for (const turma of oferta.turmas) {
    const escolhida = estado.tem(turma.id);
    const parecer = avaliar(turma, escolhidas);
    if (!passaNosFiltros(turma, parecer)) continue;
    itens.push({ turma, parecer, escolhida, alternativas: indice.alternativas(turma).length });
  }

  desenharCatalogo(refs.lista, itens, oferta.ressalva);
  refs.contador.textContent = itens.length === oferta.turmas.length
    ? oferta.turmas.length + ' turmas'
    : itens.length + ' de ' + oferta.turmas.length + ' turmas';
}

function renderizar() {
  const escolhidas = estado.turmas();
  const mapa = montarMapa(oferta, escolhidas);
  const total = resumo(escolhidas);

  desenharGrade(refs.grade, oferta, mapa);
  desenharSemHorario(refs.semHorario, escolhidas);
  desenharResumo(refs.resumo, total);
  desenharEscolhidas(refs.escolhidas, escolhidas);
  renderizarCatalogo();
  desenharAviso(refs.avisos, avisoAberto || avisoDaGrade());
  prepararFolha(refs.impressao, { oferta, escolhidas, mapa, resumo: total });

  refs.btnPdf.disabled = !escolhidas.length;
  refs.btnLimpar.disabled = !escolhidas.length;
}

/* ------------------------------------------------------------
   carregar oferta
   ------------------------------------------------------------ */

function preencherFiltros() {
  const opcao = (valor, rotulo) => '<option value="' + esc(valor) + '">' + esc(rotulo) + '</option>';

  const porCurso = new Map();
  for (const turma of oferta.turmas) {
    const id = cursoDaTurma(turma);
    if (!porCurso.has(id)) porCurso.set(id, (acharCurso(id) || {}).nome || turma.cursoNome);
  }
  const cursos = [...porCurso.entries()];

  refs.filtroCurso.innerHTML = opcao('', 'Todos os cursos') +
    cursos.map(([id, nome]) => opcao(id, nome)).join('');
  refs.filtroCurso.parentElement.hidden = cursos.length < 2;

  /* o arquivo do sistema acadêmico traz a universidade inteira. Quem
     chegou aqui já disse o curso no passo 1, e abrir o catálogo em
     "todos os cursos" seria despejar quatrocentas turmas alheias em
     cima dessa escolha — o filtro continua ali para afrouxá-la */
  if (cursoAtual && porCurso.has(cursoAtual.id) && cursos.length > 1) filtros.curso = cursoAtual.id;
  refs.filtroCurso.value = filtros.curso;

  const turmas = [...new Set(oferta.turmas.map((t) => t.turma))].sort();
  refs.filtroTurma.innerHTML = opcao('', 'Todas as turmas') + turmas.map((t) => opcao(t, t)).join('');

  refs.filtroDia.innerHTML = opcao('', 'Qualquer dia') +
    (oferta.dias || DIAS).map((d) => opcao(d, d)).join('');
}

function usar(novaOferta, nota, somando) {
  oferta = novaOferta;
  indice = indexar(oferta);

  /* filtro de turma e de curso são feitos dos valores da oferta antiga;
     mantê-los aqui esconderia o catálogo inteiro do arquivo novo */
  Object.assign(filtros, { texto: '', curso: '', turma: '', dia: '', turno: '' });
  refs.busca.value = '';
  refs.filtroTurno.value = '';

  /* o estado avisa uma vez por mudança e a tela inteira se refaz a partir
     dele — nenhum handler redesenha nada por conta própria. Trocar de
     oferta zera a seleção de propósito: id de turma de um arquivo não
     quer dizer nada no outro. Somar um arquivo ao que já está na tela
     é a exceção: ali a oferta nova contém a antiga, e a grade fica. */
  let restauro = null;

  if (!estado) {
    estado = criarEstado(indice);
    estado.ao(renderizar);
    restauro = estado.restaurar(indice);
  } else if (somando) {
    restauro = estado.manterSelecao(indice);
  } else {
    estado.trocarOferta(indice);
    restauro = estado.restaurar(indice);
  }

  preencherFiltros();
  refs.fonteNota.innerHTML = nota;

  renderizar();

  if (restauro && restauro.perdidos.length) {
    avisar({
      tipo: 'duplicada',
      titulo: 'A oferta mudou.',
      texto: restauro.perdidos.length + ' turma(s) que você tinha escolhido não existem mais neste arquivo ' +
        'e foram descartadas. Confira a grade antes de imprimir.',
      acoes: [{ acao: 'fechar', rotulo: 'Entendi' }],
    });
  }
}

/**
 * A linha de procedência da oferta.
 *
 * O que responde "de onde saiu esta grade" — nome do arquivo, aba,
 * onde a seleção fica salva — vai em .nota-extra, que o celular
 * esconde: em mono, o nome do arquivo da coordenação sozinho ocupava
 * quatro linhas em cima da grade. O período, o total de turmas e o
 * recado sobre anexar continuam visíveis em qualquer tela.
 */
function notaDaOferta(o, extra) {
  const secundario = (texto) => '<span class="nota-extra"> · ' + texto + '</span>';

  /* a ressalva ganha linha própria e fica visível em qualquer tela: é
     ela que explica uma disciplina que o aluno procura e não encontra */
  const ressalva = o.ressalva
    ? '<span class="nota-ressalva">O arquivo avisa: ' + esc(o.ressalva) + '</span>'
    : '';

  return 'Oferta <strong>' + esc(o.periodo || '—') + '</strong> · ' + o.turmas.length + ' turmas' +
    secundario('arquivo <strong>' + esc(o.origem || '—') + '</strong>' +
      (o.aba ? ' (aba "' + esc(o.aba) + '")' : '')) +
    secundario('seleção salva em ' + ondeSalva) +
    (extra ? ' · ' + extra : '') +
    ressalva;
}

async function carregarOferta(entrada) {
  const resposta = await fetch(entrada.arquivo, { cache: 'no-cache' });
  if (!resposta.ok) throw new Error('Não consegui carregar ' + entrada.arquivo);

  /* a oferta publicada é do próprio site, mas passa pelo mesmo saneamento
     do arquivo importado: assim existe um caminho só até a tela, e um erro
     no gerador não vira campo estranho desenhado na página */
  const dados = sanearOferta(await resposta.json());
  if (!dados.turmas.length) throw new Error('O arquivo de oferta não tem turmas.');
  usar(dados, notaDaOferta(dados));
  refs.oferta.value = entrada.id;
  lembrar(CHAVE_OFERTA, entrada.id);
}

/* ------------------------------------------------------------
   passo 1 — escolher o curso

   A oferta é de um curso só, então o simulador não tem o que
   desenhar antes desta escolha. O curso do último acesso volta
   pré-marcado, mas quem confirma continua sendo o aluno: a etapa
   nunca é pulada sozinha.
   ------------------------------------------------------------ */

function lembrar(chave, valor) {
  try { localStorage.setItem(chave, valor); } catch (e) { /* segue sem lembrar */ }
}

function lembrado(chave) {
  try { return localStorage.getItem(chave); } catch (e) { return null; }
}

function renderizarSelecao() {
  desenharCursos(refs.cursoGrid, {
    ofertasPorCurso,
    selecionado: cursoEscolhido ? cursoEscolhido.id : '',
    ultimo: lembrado(CHAVE_CURSO),
  });
}

/** A barra de ação é o espelho da escolha: só ela diz o que vai acontecer. */
function atualizarAcaoSelecao() {
  const curso = cursoEscolhido;

  if (!curso) {
    refs.selecaoEscolhido.textContent = 'Escolha um curso acima para continuar.';
    refs.selecaoPeriodoCampo.hidden = true;
    refs.btnImportarSelecao.hidden = true;
    refs.btnMontar.disabled = true;
    return;
  }

  const ofertas = ofertasPorCurso.get(curso.id) || [];
  refs.btnImportarSelecao.hidden = false;

  if (!ofertas.length) {
    refs.selecaoEscolhido.innerHTML = '<strong>' + esc(curso.nome) + '</strong> — a oferta deste curso ' +
      'não vem pronta aqui. Anexe a planilha da coordenação para montar a grade.';
    refs.selecaoPeriodoCampo.hidden = true;
    refs.btnMontar.disabled = true;
    return;
  }

  refs.selecaoEscolhido.innerHTML = '<strong>' + esc(curso.nome) + '</strong> · ' +
    (ofertas.length === 1
      ? 'oferta ' + esc(ofertas[0].periodo) + ' com ' + ofertas[0].turmas + ' turmas'
      : ofertas.length + ' ofertas publicadas');

  refs.selecaoPeriodo.innerHTML = ofertas
    .map((o) => '<option value="' + esc(o.id) + '">' + esc(o.periodo) + ' · ' + o.turmas + ' turmas</option>')
    .join('');
  refs.selecaoPeriodoCampo.hidden = ofertas.length < 2;

  const salva = lembrado(CHAVE_OFERTA);
  if (salva && ofertas.some((o) => o.id === salva)) refs.selecaoPeriodo.value = salva;

  refs.btnMontar.disabled = false;
}

function escolherCurso(id) {
  const curso = acharCurso(id);
  if (!curso || curso.emBreve) return;
  cursoEscolhido = curso;
  renderizarSelecao();
  atualizarAcaoSelecao();
}

/* ------------------------------------------------------------
   passo 2 — entrar e sair do simulador
   ------------------------------------------------------------ */

/**
 * Trocar de passo troca a altura da página inteira. Rolar no mesmo
 * quadro em que o outro passo aparece pega a altura antiga e o
 * navegador devolve a rolagem: o quadro seguinte é que vale.
 */
function subirAoTopo() {
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
}

/** Deixa a URL contando onde o aluno está, para recarregar e compartilhar. */
function marcarUrl(curso) {
  const params = new URLSearchParams(location.search);
  if (curso) params.set('curso', curso.id);
  else params.delete('curso');
  params.delete('oferta');
  const busca = params.toString();
  history.replaceState(null, '', location.pathname + (busca ? '?' + busca : ''));
}

function abrirSimulador(curso) {
  cursoAtual = curso;
  cursoEscolhido = curso;
  lembrar(CHAVE_CURSO, curso.id);

  refs.cursoSigla.textContent = curso.sigla;
  refs.cursoSigla.style.setProperty('--h', curso.h);
  refs.cursoNome.textContent = curso.nome;

  const ofertas = ofertasPorCurso.get(curso.id) || [];
  refs.oferta.innerHTML = ofertas
    .map((o) => '<option value="' + esc(o.id) + '">' + esc(o.periodo) + ' · ' + o.turmas + ' turmas</option>')
    .join('');
  /* sem oferta publicada o seletor não tem o que oferecer; quem manda
     na tela é o arquivo importado, e a linha de origem já o nomeia */
  refs.oferta.parentElement.hidden = !ofertas.length;

  refs.selecao.hidden = true;
  refs.simulador.hidden = false;
  document.body.classList.add('is-montando');
  marcarUrl(curso);
  subirAoTopo();
}

function voltarParaSelecao() {
  refs.simulador.hidden = true;
  refs.selecao.hidden = false;
  document.body.classList.remove('is-montando');

  renderizarSelecao();
  atualizarAcaoSelecao();
  marcarUrl(null);

  subirAoTopo();
  const marcado = refs.cursoGrid.querySelector('.curso.is-ativo') || refs.cursoGrid.querySelector('.curso');
  if (marcado) marcado.focus({ preventScroll: true });
}

async function montarGrade() {
  if (!cursoEscolhido) return;

  const ofertas = ofertasPorCurso.get(cursoEscolhido.id) || [];
  const entrada = ofertas.find((o) => o.id === refs.selecaoPeriodo.value) || ofertas[0];
  if (!entrada) return;

  abrirSimulador(cursoEscolhido);

  try {
    await carregarOferta(entrada);
  } catch (erro) {
    refs.fonteNota.innerHTML = '<strong>Não consegui abrir a oferta publicada.</strong> ' +
      esc(erro.message) + ' Use "Anexar planilha" para abrir o arquivo da coordenação.';
    /* uma oferta vazia mantém a tela desenhada e o anexar funcionando */
    usar(montarOferta([], { cursoNome: cursoEscolhido.nome, periodo: '' }), refs.fonteNota.innerHTML);
  }
}

async function iniciar() {
  try {
    const resposta = await fetch('assets/data/ofertas.json', { cache: 'no-cache' });
    catalogo = resposta.ok ? await resposta.json() : [];
  } catch (e) {
    catalogo = [];
  }

  ofertasPorCurso = cruzarCatalogo(catalogo);

  /* o curso da URL vence o do último acesso; nenhum dos dois entra
     sozinho no simulador, os dois só deixam o botão pronto. Um link
     antigo para curso que saiu do ar cai no passo 1 em branco. */
  const params = new URLSearchParams(location.search);
  const preferido = acharCurso(params.get('curso')) || acharCurso(lembrado(CHAVE_CURSO));
  cursoEscolhido = preferido && !preferido.emBreve ? preferido : null;

  renderizarSelecao();
  atualizarAcaoSelecao();
}

/* ------------------------------------------------------------
   anexar arquivo
   ------------------------------------------------------------ */

/* Uma oferta de curso inteiro dá algumas centenas de kB. O teto existe
   para um .xlsx inflado não travar a aba na descompressão — o arquivo
   nunca sai daqui, então o prejuízo seria do próprio aluno. */
const TETO_ARQUIVO = 20 * 1024 * 1024;

/* a oferta lida esperando o aluno dizer se soma ou substitui */
let importada = null;

/** "Grade_Engenharia_Civil_2026_2.xlsx" -> "Grade_Engenharia_Civil…" */
function nomeCurto(nome) {
  const texto = String(nome || 'o arquivo novo');
  return texto.length > 34 ? texto.slice(0, 32) + '…' : texto;
}

/**
 * Põe na tela a oferta que veio de arquivo.
 *
 * @param {object} nova      a oferta a desenhar
 * @param {boolean} somando  true quando ela já é a soma com a anterior,
 *                           e portanto a seleção do aluno continua valendo
 */
function aplicarImportada(nova, somando) {
  usar(nova, notaDaOferta(nova, 'lido neste navegador, nada foi enviado para servidor algum'), somando);

  /* o seletor precisa mostrar o que está no ar; sem uma opção para o
     arquivo do aluno ele ficaria em branco ou apontando para a errada */
  if (!refs.oferta.querySelector('option[value="importado"]')) {
    refs.oferta.insertAdjacentHTML('beforeend', '<option value="importado">Arquivo anexado</option>');
  }
  refs.oferta.querySelector('option[value="importado"]').textContent =
    (somando ? 'Arquivos somados — ' : 'Arquivo anexado — ') + (nova.origem || '');
  refs.oferta.value = 'importado';
  refs.oferta.parentElement.hidden = false;

  if (nova.avisos && nova.avisos.length) {
    avisar({
      tipo: 'duplicada',
      titulo: 'Arquivo lido com ressalvas.',
      texto: nova.avisos.slice(0, 3).join(' '),
      acoes: [{ acao: 'fechar', rotulo: 'Entendi' }],
    });
  }
}

async function importar(arquivo) {
  /* anexar é o caminho de quem veio do passo 1: a resposta — leitura,
     ressalva ou erro — mora dentro do simulador, então ele abre antes */
  if (refs.simulador.hidden && cursoEscolhido) abrirSimulador(cursoEscolhido);

  if (arquivo.size > TETO_ARQUIVO) {
    avisar({
      tipo: 'duplicada',
      titulo: 'Arquivo grande demais.',
      texto: 'A planilha da coordenação tem alguns kB; esta tem ' +
        Math.round(arquivo.size / 1024 / 1024) + ' MB. Confira se é o arquivo certo.',
      acoes: [{ acao: 'fechar', rotulo: 'Entendi' }],
    });
    return;
  }

  if (/\.pdf$/i.test(arquivo.name)) {
    avisar({ tipo: 'duplicada', titulo: 'PDF não dá.', texto: AJUDA_PDF, acoes: [{ acao: 'fechar', rotulo: 'Entendi' }] });
    return;
  }

  refs.fonteNota.textContent = 'Lendo ' + arquivo.name + '…';
  try {
    const nova = await lerArquivo(arquivo);
    if (!nova.turmas.length) throw new Error('Não encontrei nenhuma aula neste arquivo.');

    /* com uma oferta já na tela, o arquivo novo pode ser as duas coisas:
       a oferta certa no lugar da errada, ou a planilha do curso vizinho
       trazendo a disciplina que a do aluno não tem. Só ele sabe qual. */
    if (oferta && oferta.turmas.length) {
      importada = nova;
      avisar({
        tipo: 'duplicada',
        titulo: 'Somar ou substituir?',
        texto: 'A tela já tem ' + oferta.turmas.length + ' turmas e ' + nomeCurto(nova.origem) +
          ' traz ' + nova.turmas.length + '. Somar deixa as duas ofertas no catálogo — é o caminho ' +
          'para uma disciplina compartilhada, como Cálculo, que só aparece na planilha de outro curso.',
        acoes: [
          { acao: 'somar', rotulo: 'Somar as duas' },
          { acao: 'substituir', rotulo: 'Usar só o arquivo novo' },
          { acao: 'fechar', rotulo: 'Cancelar' },
        ],
      });
      return;
    }

    aplicarImportada(nova);
  } catch (erro) {
    refs.fonteNota.innerHTML = '<strong>Não consegui ler ' + esc(arquivo.name) + '.</strong> ' + esc(erro.message);
    /* falhar na primeira tentativa deixaria a grade sem nada desenhado */
    if (!estado) usar(montarOferta([], { cursoNome: cursoAtual ? cursoAtual.nome : '—', periodo: '' }), refs.fonteNota.innerHTML);
  }
}

/* ------------------------------------------------------------
   eventos
   ------------------------------------------------------------ */

function ligarEventos() {
  /* ---- passo 1 ---- */
  refs.cursoGrid.addEventListener('click', (e) => {
    const cartao = e.target.closest('.curso');
    if (cartao) escolherCurso(cartao.dataset.curso);
  });

  /* clicar duas vezes num curso é o atalho de quem já sabe onde vai */
  refs.cursoGrid.addEventListener('dblclick', (e) => {
    if (e.target.closest('.curso') && !refs.btnMontar.disabled) montarGrade();
  });

  refs.btnMontar.addEventListener('click', montarGrade);
  refs.btnTrocarCurso.addEventListener('click', voltarParaSelecao);

  /* ---- passo 2 ---- */
  refs.lista.addEventListener('click', (e) => {
    const botao = e.target.closest('.turma');
    if (botao) alternar(botao.dataset.id);
  });

  const removerNoClique = (e, seletor) => {
    const alvo = e.target.closest(seletor);
    if (!alvo || !estado) return;
    estado.remover(alvo.dataset.id);
    avisar(null);
  };
  refs.grade.addEventListener('click', (e) => removerNoClique(e, '.chip'));
  refs.semHorario.addEventListener('click', (e) => removerNoClique(e, '.chip'));
  refs.escolhidas.addEventListener('click', (e) => removerNoClique(e, '.remover'));

  refs.avisos.addEventListener('click', (e) => {
    const botao = e.target.closest('button[data-acao]');
    if (!botao || !estado) return;
    const { acao, id, sai } = botao.dataset;

    if (acao === 'somar' && importada) {
      const somada = unirOfertas([oferta, importada]);
      importada = null;
      avisar(null);
      aplicarImportada(somada, true);
      return;
    }

    if (acao === 'substituir' && importada) {
      const nova = importada;
      importada = null;
      avisar(null);
      aplicarImportada(nova);
      return;
    }

    if (acao === 'forcar' || acao === 'adicionar') estado.adicionar(id);
    else if (acao === 'trocar') estado.trocar(sai, id);
    importada = null;
    avisar(null);
  });

  refs.btnLimpar.addEventListener('click', () => {
    if (!estado) return;
    estado.limpar();
    avisar(null);
  });

  refs.btnPdf.addEventListener('click', imprimir);

  /* os dois botões de anexar (passo 1 e passo 2) dividem um input só */
  document.querySelectorAll('[data-importar]').forEach((botao) => {
    botao.addEventListener('click', () => refs.arquivo.click());
  });
  refs.arquivo.addEventListener('change', () => {
    if (refs.arquivo.files[0]) importar(refs.arquivo.files[0]);
    refs.arquivo.value = '';
  });

  refs.oferta.addEventListener('change', () => {
    if (refs.oferta.value === 'importado') return;  /* já está na tela */
    const ofertas = cursoAtual ? (ofertasPorCurso.get(cursoAtual.id) || []) : [];
    const entrada = ofertas.find((o) => o.id === refs.oferta.value);
    if (!entrada) return;

    carregarOferta(entrada).catch((erro) => {
      refs.fonteNota.textContent = erro.message;
    });
  });

  /* busca com respiro: 52 turmas redesenham rápido, mas o filtro
     roda avaliar() para cada uma e não precisa correr a cada tecla */
  let atraso;
  refs.busca.addEventListener('input', () => {
    clearTimeout(atraso);
    atraso = setTimeout(() => {
      if (!estado) return;
      filtros.texto = semAcento(refs.busca.value);
      renderizarCatalogo();
    }, 140);
  });

  const ligarFiltro = (campo, chave) => {
    campo.addEventListener('change', () => {
      filtros[chave] = campo.type === 'checkbox' ? campo.checked : campo.value;
      if (estado) renderizarCatalogo();
    });
  };
  ligarFiltro(refs.filtroCurso, 'curso');
  ligarFiltro(refs.filtroTurma, 'turma');
  ligarFiltro(refs.filtroDia, 'dia');
  ligarFiltro(refs.filtroTurno, 'turno');
  ligarFiltro(refs.soLivres, 'soLivres');
}

/* ------------------------------------------------------------
   partida
   ------------------------------------------------------------ */

ligarEventos();
iniciar();
