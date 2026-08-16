/* ============================================================
   EXPORTAR EM PDF

   Sem biblioteca: o PDF é esta página impressa pelo navegador.
   Isso é de propósito —

   - o texto sai selecionável e pesquisável, não rasterizado;
   - a paginação, as quebras e o A4 são problema do navegador;
   - a folha usa as mesmas fontes e cores do site;
   - não entram 300 kB de dependência numa página que hoje não
     tem nenhuma.

   O que este módulo faz é montar, fora da tela, a folha limpa
   que o @media print de grade.css manda imprimir.
   ============================================================ */

import { DIAS, paraHora } from './oferta.js';
import { horaTexto } from './regras.js';
import { esc, horariosTexto, nomeCompleto } from './ui.js';

function celulaImpressa(itens) {
  return itens.map(({ turma, encontro, conflito }) => '' +
    '<div class="imp-chip' + (conflito ? ' is-choque' : '') + '">' +
      '<b>' + esc(turma.disciplina) + (turma.subturma ? ' (' + esc(turma.subturma) + ')' : '') + '</b>' +
      '<span>' + esc([
        paraHora(encontro.inicio) + '–' + paraHora(encontro.fim),
        turma.turma,
        encontro.local,
      ].filter(Boolean).join(' · ')) + '</span>' +
    '</div>').join('');
}

/**
 * Monta a folha. É chamada a cada mudança do estado, então
 * Ctrl+P direto no teclado imprime a grade atual — sem depender
 * de o aluno ter clicado no botão de exportar antes.
 */
export function prepararFolha(alvo, { oferta, escolhidas, mapa, resumo }) {
  const dias = oferta.dias && oferta.dias.length ? oferta.dias : DIAS;
  const hoje = new Date().toLocaleDateString('pt-BR');

  const cabecalho = '<tr><th></th>' + dias.map((d) => '<th>' + esc(d) + '</th>').join('') + '</tr>';

  const corpo = oferta.blocos.map((bloco) => {
    const celulas = dias.map((dia) => {
      const itens = mapa.celulas.get(dia + '|' + bloco.id) || [];
      return '<td>' + celulaImpressa(itens) + '</td>';
    }).join('');
    return '<tr><th>' + esc(paraHora(bloco.inicio)) + '<br>' + esc(paraHora(bloco.fim)) + '</th>' + celulas + '</tr>';
  }).join('');

  const linhas = escolhidas.map((turma, i) => '' +
    '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + esc(nomeCompleto(turma)) + '</td>' +
      '<td>' + esc(turma.codigo) + '</td>' +
      '<td>' + esc(turma.turma) + '</td>' +
      '<td>' + esc(horariosTexto(turma)) + '</td>' +
      '<td>' + esc(turma.docentes.join(', ') || '—') + '</td>' +
      '<td>' + esc(turma.locais.join(' / ') || '—') + '</td>' +
      '<td>' + esc(turma.aulas) + '</td>' +
    '</tr>').join('');

  alvo.innerHTML = '' +
    '<div class="imp-head">' +
      '<div>' +
        '<h1>Grade ' + esc(oferta.periodo || '') + '</h1>' +
        '<p>' + esc(oferta.cursoNome || '') + ' — Universidade SENAI CIMATEC</p>' +
      '</div>' +
      '<div class="imp-meta">' +
        'Simulação de pré-matrícula<br>' +
        'Gerada em ' + esc(hoje) + '<br>' +
        'Fonte: ' + esc(oferta.origem || 'arquivo da coordenação') +
      '</div>' +
    '</div>' +

    '<div class="imp-resumo">' +
      '<span><b>' + resumo.disciplinas + '</b> disciplinas</span>' +
      '<span><b>' + resumo.turmas + '</b> turmas</span>' +
      '<span><b>' + resumo.aulas + '</b> aulas de 50 min por semana</span>' +
      '<span><b>' + horaTexto(resumo.horas) + '</b> de carga semanal</span>' +
      '<span><b>' + resumo.diasOcupados + '</b> dias com aula</span>' +
    '</div>' +

    '<table class="imp-grade"><thead>' + cabecalho + '</thead><tbody>' + corpo + '</tbody></table>' +

    '<table class="imp-lista">' +
      '<caption>Disciplinas selecionadas</caption>' +
      '<thead><tr><th></th><th>Disciplina</th><th>Código da turma</th><th>Turma</th>' +
      '<th>Horários</th><th>Docente</th><th>Local</th><th>Aulas</th></tr></thead>' +
      '<tbody>' + (linhas || '<tr><td colspan="8">Nenhuma disciplina selecionada.</td></tr>') + '</tbody>' +
      '<tfoot><tr><td></td><td colspan="6">Total — ' + resumo.turmas + ' turmas, ' +
        horaTexto(resumo.horas) + ' por semana</td><td>' + resumo.aulas + '</td></tr></tfoot>' +
    '</table>' +

    '<p class="imp-rodape">' +
      (oferta.ressalva ? 'O arquivo de oferta avisa: ' + esc(oferta.ressalva) + ' ' : '') +
      'Simulação feita no Help CIMATEC (help-cimatec.netlify.app/grade.html) a partir do arquivo de oferta ' +
      'divulgado pela coordenação. Não é comprovante de matrícula nem documento oficial: confirme vagas, ' +
      'pré-requisitos e horários no Portal do Aluno antes de efetivar.' +
    '</p>';
}

/** O diálogo de impressão do navegador; "Salvar como PDF" faz o arquivo. */
export function imprimir() {
  window.print();
}
