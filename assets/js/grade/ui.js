/* ============================================================
   UI — desenhar a oferta, a grade e o resumo

   Só desenho. Nenhuma função daqui muda a seleção: elas recebem o
   estado já calculado e devolvem HTML. Quem decide é o app.js.
   ============================================================ */

import { DIAS, paraHora } from './oferta.js';
import { horaTexto } from './regras.js';

const ABREVIA = { Segunda: 'Seg', 'Terça': 'Ter', Quarta: 'Qua', Quinta: 'Qui', Sexta: 'Sex', 'Sábado': 'Sáb' };


export function esc(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A cor da disciplina, calculada uma vez por oferta em regras.indexar(). */
export function matiz(turma) {
  return turma && turma.matiz !== undefined ? turma.matiz : 212;
}

/** "Seg 18:30 · Qua 18:30" */
export function horariosTexto(turma) {
  const partes = turma.encontros.map((e) => (e.dia ? ABREVIA[e.dia] + ' ' + paraHora(e.inicio) : 'EAD'));
  return partes.join(' · ') || 'Sem horário';
}

export function nomeCompleto(turma) {
  return turma.disciplina + (turma.subturma ? ' — Subturma ' + turma.subturma : '');
}

/* ------------------------------------------------------------
   catálogo
   ------------------------------------------------------------ */

/**
 * @param {HTMLElement} alvo
 * @param {Array} itens      [{ turma, parecer, escolhida }]
 * @param {string} ressalva  o que a planilha avisa ter deixado de fora
 */
export function desenharCatalogo(alvo, itens, ressalva) {
  if (!itens.length) {
    /* é aqui que para quem procurou uma disciplina e não achou — então
       é aqui que a ressalva do arquivo precisa aparecer, e não só na
       linha de procedência lá em cima */
    alvo.innerHTML = '<p class="vazio">Nenhuma turma com esses filtros.<br>Tente outro termo ou limpe a busca.' +
      (ressalva ? '<br><br><b>O arquivo avisa:</b> ' + esc(ressalva) : '') + '</p>';
    return;
  }

  alvo.innerHTML = itens.map(({ turma, parecer, escolhida, alternativas }) => {
    const tags = [];
    if (turma.subturma) tags.push('<span class="selo">Subturma ' + esc(turma.subturma) + '</span>');
    if (turma.ead) tags.push('<span class="selo selo-ead">EAD</span>');
    if (turma.compartilhada) tags.push('<span class="selo">Compartilhada</span>');
    if (alternativas) tags.push('<span class="selo">+' + alternativas + ' oferta' + (alternativas > 1 ? 's' : '') + '</span>');
    if (!escolhida && parecer.conflitos.length) {
      tags.push('<span class="selo selo-choque">Choca com ' + parecer.conflitos.length + '</span>');
    }
    if (!escolhida && !parecer.conflitos.length && parecer.equivalente) {
      tags.push('<span class="selo selo-alerta">Equivalente na grade</span>');
    }

    const meta = [turma.turma, turma.codigo, turma.docentes[0] || 'Docente a definir'];

    return '' +
      '<button type="button" class="turma' + (parecer.conflitos.length && !escolhida ? ' is-choque' : '') + '"' +
        ' data-id="' + esc(turma.id) + '" aria-pressed="' + (escolhida ? 'true' : 'false') + '"' +
        ' style="--h:' + matiz(turma) + '">' +
        '<span class="turma-nome">' + esc(nomeCompleto(turma)) + '</span>' +
        '<span class="turma-meta">' + esc(meta.join(' · ')) + '</span>' +
        '<span class="turma-horarios">' + esc(horariosTexto(turma)) + '</span>' +
        (tags.length ? '<span class="turma-tags">' + tags.join('') + '</span>' : '') +
      '</button>';
  }).join('');
}

/* ------------------------------------------------------------
   grade semanal
   ------------------------------------------------------------ */

function chip(item, legenda) {
  const { turma, encontro, conflito } = item;
  const local = encontro.local ? encontro.local.split(' - ')[0] : '';
  const linha = legenda || [
    paraHora(encontro.inicio) + '–' + paraHora(encontro.fim),
    turma.ingresso || turma.codigo,
    local,
  ].filter(Boolean).join(' · ');

  return '' +
    '<button type="button" class="chip' + (conflito ? ' is-choque' : '') + '"' +
      ' data-id="' + esc(turma.id) + '" style="--h:' + matiz(turma) + '"' +
      ' aria-label="Remover ' + esc(nomeCompleto(turma)) + ' da grade"' +
      ' title="' + esc(nomeCompleto(turma) + ' · ' + turma.turma + ' · ' + (turma.docentes[0] || '') + ' · clique para remover') + '">' +
      '<b>' + esc(turma.disciplina + (turma.subturma ? ' · ' + turma.subturma : '')) + '</b>' +
      '<span>' + esc(linha) + '</span>' +
    '</button>';
}

/**
 * A mesma grade em lista, um bloco por dia.
 *
 * Existe porque a tabela não cabe num celular: seis dias na largura de
 * um aparelho estreito dariam menos de 40px por coluna, medida em que
 * nome nenhum de disciplina se lê. Só uma das duas formas aparece por
 * vez, e quem escolhe é o `@media` — o HTML traz sempre as duas.
 *
 * A tabela repete a mesma aula em todo bloco que ela cruza, que é como
 * uma aula longa ocupa duas células. Aqui isso viraria o mesmo chip
 * duas vezes seguidas, então cada encontro entra uma vez só.
 */
function listaPorDia(oferta, mapa, dias) {
  const comAula = [];
  const livres = [];

  for (const dia of dias) {
    const vistos = new Set();
    const itens = [];

    for (const bloco of oferta.blocos) {
      for (const item of mapa.celulas.get(dia + '|' + bloco.id) || []) {
        const chave = item.turma.id + '|' + item.encontro.inicio + '|' + item.encontro.fim;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        itens.push(item);
      }
    }

    if (!itens.length) { livres.push(dia); continue; }
    itens.sort((a, b) => a.encontro.inicio - b.encontro.inicio);
    comAula.push({ dia, itens });
  }

  if (!comAula.length) {
    return '<p class="grade-dias grade-dias-vazia">A semana ainda está vazia. ' +
      'Escolha disciplinas na lista para elas aparecerem aqui.</p>';
  }

  /* o dia livre é informação — some da lista como linha própria, mas
     volta no rodapé, senão "sexta está livre" viraria uma ausência */
  const rodape = livres.length
    ? '<li class="grade-dia grade-dia-livre"><h3>Sem aula</h3><p>' + esc(livres.join(' · ')) + '</p></li>'
    : '';

  return '<ol class="grade-dias">' +
    comAula.map(({ dia, itens }) =>
      '<li class="grade-dia">' +
        '<h3>' + esc(dia) + '</h3>' +
        '<div class="celula">' + itens.map((item) => chip(item)).join('') + '</div>' +
      '</li>').join('') +
    rodape +
  '</ol>';
}

export function desenharGrade(alvo, oferta, mapa) {
  const dias = oferta.dias && oferta.dias.length ? oferta.dias : DIAS;

  const cabecalho = '<thead><tr><th scope="col"><span class="sr-only">Horário</span></th>' +
    dias.map((d) => '<th scope="col">' + esc(d) + '</th>').join('') + '</tr></thead>';

  const corpo = oferta.blocos.map((bloco) => {
    const celulas = dias.map((dia) => {
      const itens = mapa.celulas.get(dia + '|' + bloco.id) || [];
      const classes = ['', itens.length ? 'tem-aula' : '', itens.some((i) => i.conflito) ? 'tem-choque' : '']
        .filter(Boolean).join(' ');
      return '<td' + (classes ? ' class="' + classes.trim() + '"' : '') + '>' +
        (itens.length ? '<div class="celula">' + itens.map((item) => chip(item)).join('') + '</div>' : '') +
        '</td>';
    }).join('');

    return '<tr><th scope="row"><b>' + esc(paraHora(bloco.inicio)) + '</b>' + esc(paraHora(bloco.fim)) + '</th>' + celulas + '</tr>';
  }).join('');

  alvo.innerHTML = '<table class="grade">' + cabecalho + '<tbody>' + corpo + '</tbody></table>' +
    listaPorDia(oferta, mapa, dias);
}

/** Turmas sem dia e hora (EAD) não cabem na grade, mas contam na matrícula. */
export function desenharSemHorario(alvo, escolhidas) {
  const soltas = escolhidas.filter((t) => t.encontros.some((e) => !e.dia));
  if (!soltas.length) { alvo.innerHTML = ''; alvo.hidden = true; return; }

  alvo.hidden = false;
  alvo.innerHTML = '<h3>Sem horário fixo</h3><div class="celula">' +
    soltas.map((turma) => chip(
      { turma, encontro: { inicio: 0, fim: 0, local: turma.locais[0] || '' }, conflito: false },
      [turma.ead ? 'EAD' : 'Sem horário', turma.turma].join(' · '),
    )).join('') +
    '</div>';
}

/* ------------------------------------------------------------
   resumo, lista e avisos
   ------------------------------------------------------------ */

export function desenharResumo(alvo, r) {
  alvo.innerHTML = '' +
    item('Disciplinas', r.disciplinas) +
    item('Turmas', r.turmas) +
    item('Aulas/semana', r.aulas, '50 min cada') +
    item('Carga semanal', horaTexto(r.horas)) +
    item('Dias com aula', r.diasOcupados + '<small>/6</small>') +
    (r.ead ? item('EAD', r.ead) : '');

  function item(rotulo, valor, nota) {
    return '<div><dt>' + rotulo + '</dt><dd>' + valor +
      (nota ? ' <small>' + nota + '</small>' : '') + '</dd></div>';
  }
}

export function desenharEscolhidas(alvo, escolhidas) {
  if (!escolhidas.length) {
    alvo.innerHTML = '<p class="vazio">Sua grade está vazia. Escolha disciplinas na lista ao lado.</p>';
    return;
  }

  const linhas = escolhidas.map((turma, i) => '' +
    '<tr>' +
      '<td class="c-num">' + (i + 1) + '</td>' +
      '<td><strong>' + esc(nomeCompleto(turma)) + '</strong><br><span class="c-hora">' + esc(turma.codigo) + '</span></td>' +
      '<td>' + esc(turma.turma) + '</td>' +
      '<td class="c-hora">' + esc(horariosTexto(turma)) + '</td>' +
      '<td>' + esc(turma.docentes.join(', ') || '—') + '</td>' +
      '<td class="c-hora">' + esc(turma.aulas) + '</td>' +
      '<td class="c-acao">' +
        '<button type="button" class="remover" data-id="' + esc(turma.id) + '" aria-label="Remover ' + esc(nomeCompleto(turma)) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</td>' +
    '</tr>').join('');

  alvo.innerHTML = '' +
    '<table>' +
      '<thead><tr><th></th><th>Disciplina e código</th><th>Turma</th><th>Horários</th><th>Docente</th><th>Aulas</th><th></th></tr></thead>' +
      '<tbody>' + linhas + '</tbody>' +
    '</table>';
}

/**
 * Um aviso por vez: o último parecer que travou uma inclusão.
 * Sem histórico — aviso antigo empilhado vira ruído.
 */
export function desenharAviso(alvo, aviso) {
  if (!aviso) { alvo.innerHTML = ''; return; }

  const acoes = (aviso.acoes || []).map((a) =>
    '<button type="button" data-acao="' + esc(a.acao) + '"' +
      (a.id ? ' data-id="' + esc(a.id) + '"' : '') +
      (a.sai ? ' data-sai="' + esc(a.sai) + '"' : '') +
      (a.perigo ? ' class="perigo"' : '') + '>' + esc(a.rotulo) + '</button>').join('');

  alvo.innerHTML =
    '<div class="aviso aviso-' + esc(aviso.tipo) + '">' +
      '<div><strong>' + esc(aviso.titulo) + '</strong> ' + esc(aviso.texto) +
        (acoes ? '<div class="aviso-acoes">' + acoes + '</div>' : '') +
      '</div>' +
    '</div>';
}
