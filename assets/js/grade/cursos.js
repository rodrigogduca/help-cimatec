/* ============================================================
   CURSOS — a etapa que vem antes da grade

   Uma oferta é sempre de um curso só. Enquanto o aluno não
   disser qual é o dele, não existe grade para montar: esta lista
   é a porta de entrada e o simulador só aparece depois dela.

   A lista é fixa no código porque é institucional — muda quando
   a universidade abre ou fecha um curso, não quando a coordenação
   publica uma planilha. O que é variável (qual oferta existe para
   cada curso) vem de assets/data/ofertas.json e é cruzado aqui
   pelos slugs.
   ============================================================ */

import { esc } from './ui.js';

/**
 * `slugs` cobre as variações que o nome do arquivo da coordenação
 * produz: "Engenharia de Computação" e "Engenharia da Computação"
 * viram slugs diferentes e são o mesmo curso. `h` é o matiz do selo,
 * espalhado no círculo para 11 cursos não virarem 11 tons de azul.
 *
 * `emBreve` é o curso que a universidade ainda não abriu — coisa
 * diferente de curso aberto esperando a coordenação publicar a
 * planilha. O cartão fica na lista, para quem procura saber que o
 * site não esqueceu dele, mas não abre o simulador.
 */
export const CURSOS = [
  /* ---- engenharias: o grosso do campus, em ordem alfabética ---- */
  { id: 'engenharia-civil', nome: 'Engenharia Civil', sigla: 'CIV', h: 202, area: 'engenharia',
    slugs: ['engenharia-civil'] },

  { id: 'engenharia-da-computacao', nome: 'Engenharia da Computação', sigla: 'ECP', h: 226, area: 'engenharia',
    slugs: ['engenharia-da-computacao', 'engenharia-de-computacao', 'engenharia-computacao'] },

  { id: 'engenharia-de-controle-e-automacao', nome: 'Engenharia de Controle e Automação', sigla: 'ECA', h: 174, area: 'engenharia',
    slugs: ['engenharia-de-controle-e-automacao', 'engenharia-controle-e-automacao'] },

  { id: 'engenharia-de-producao', nome: 'Engenharia de Produção', sigla: 'EPR', h: 44, area: 'engenharia',
    slugs: ['engenharia-de-producao', 'engenharia-producao'] },

  { id: 'engenharia-eletrica', nome: 'Engenharia Elétrica', sigla: 'ELE', h: 322, area: 'engenharia',
    slugs: ['engenharia-eletrica'] },

  { id: 'engenharia-mecanica', nome: 'Engenharia Mecânica', sigla: 'MEC', h: 14, area: 'engenharia',
    slugs: ['engenharia-mecanica'] },

  { id: 'engenharia-quimica', nome: 'Engenharia Química', sigla: 'EQA', h: 146, area: 'engenharia',
    slugs: ['engenharia-quimica'] },

  /* ---- as demais graduações ---- */
  { id: 'arquitetura-e-urbanismo', nome: 'Arquitetura e Urbanismo', sigla: 'ARQ', h: 350, area: 'outras',
    slugs: ['arquitetura-e-urbanismo', 'arquitetura-urbanismo'] },

  { id: 'ciencia-de-dados-e-inteligencia-artificial', nome: 'Ciência de Dados e Inteligência Artificial', sigla: 'CDIA', h: 268, area: 'outras', ead: true,
    slugs: ['ciencia-de-dados-e-inteligencia-artificial', 'ciencia-de-dados-e-inteligencia-artificial-ead', 'cdia'] },

  /* ---- ainda não abertos: sempre no fim, para não competirem com
         os cursos em que o aluno de fato consegue montar grade ---- */
  { id: 'administracao', nome: 'Administração', sigla: 'ADM', h: 28, area: 'outras', emBreve: true,
    slugs: ['administracao'] },

  { id: 'economia', nome: 'Economia', sigla: 'ECO', h: 96, area: 'outras', emBreve: true,
    slugs: ['economia'] },
];

/**
 * Os três blocos da tela, na ordem em que aparecem. `de` é o teste
 * que decide de quem é cada cartão; o primeiro grupo que aceitar o
 * curso fica com ele, então `emBreve` precisa ser testado antes da
 * área — senão Administração cairia em "outras graduações".
 */
const GRUPOS = [
  { rotulo: 'Engenharias', de: (c) => !c.emBreve && c.area === 'engenharia' },
  { rotulo: 'Outras graduações', de: (c) => !c.emBreve },
  { rotulo: 'Em breve', de: (c) => c.emBreve },
];

/* ------------------------------------------------------------
   cruzamento com o catálogo publicado
   ------------------------------------------------------------ */

/** Aceita o id do curso ou qualquer slug que a coordenação já usou. */
export function acharCurso(chave) {
  if (!chave) return null;
  const alvo = String(chave).toLowerCase();
  return CURSOS.find((c) => c.id === alvo || c.slugs.includes(alvo)) || null;
}

/** As ofertas publicadas de um curso, da mais recente para a mais antiga. */
export function ofertasDoCurso(curso, catalogo) {
  return (catalogo || [])
    .filter((o) => curso.slugs.includes(String(o.curso || '').toLowerCase()))
    .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)));
}

/** Mapa id do curso -> ofertas, montado uma vez por carregamento. */
export function cruzarCatalogo(catalogo) {
  const mapa = new Map();
  for (const curso of CURSOS) mapa.set(curso.id, ofertasDoCurso(curso, catalogo));
  return mapa;
}

/* ------------------------------------------------------------
   desenho
   ------------------------------------------------------------ */

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';

function statusDoCurso(curso, ofertas) {
  /* curso que ainda não abriu não tem oferta possível — nem a publicada
     nem a importada —, então o estado dele vem antes de olhar o catálogo */
  if (curso.emBreve) {
    return { classe: 'is-embreve', texto: 'Ainda não disponível' };
  }
  /* "ainda não publicada" prometia uma publicação que não vem: fora de
     Computação, a oferta de cada curso é a planilha que o próprio aluno
     anexa. O cartão diz o que ele tem a fazer, e não o que falta ao site */
  if (!ofertas.length) {
    return { classe: 'is-vazio', texto: 'Anexe a planilha do curso' };
  }
  const o = ofertas[0];
  return {
    classe: 'is-ok',
    texto: 'Oferta ' + o.periodo + ' · ' + o.turmas + ' turmas',
  };
}

/**
 * A grade de cursos, em três blocos rotulados. Um botão por curso,
 * o escolhido marcado com aria-pressed — é a marcação que o leitor
 * de tela usa para dizer qual está ativo sem texto extra na tela.
 *
 * @param {HTMLElement} alvo
 * @param {object} cfg  { ofertasPorCurso, selecionado, ultimo }
 */
export function desenharCursos(alvo, { ofertasPorCurso, selecionado, ultimo }) {
  const sobrando = new Set(CURSOS);

  alvo.innerHTML = GRUPOS.map((grupo) => {
    /* cada curso sai da lista ao entrar num grupo: assim nenhum
       aparece duas vezes e nenhum fica de fora sem ninguém notar */
    const doGrupo = [...sobrando].filter(grupo.de);
    if (!doGrupo.length) return '';
    for (const c of doGrupo) sobrando.delete(c);

    return '<p class="curso-grupo">' + esc(grupo.rotulo) + '</p>' +
      doGrupo.map((curso) => cartao(curso, { ofertasPorCurso, selecionado, ultimo })).join('');
  }).join('');
}

function cartao(curso, { ofertasPorCurso, selecionado, ultimo }) {
  const ofertas = ofertasPorCurso.get(curso.id) || [];
  const status = statusDoCurso(curso, ofertas);
  const ativo = curso.id === selecionado && !curso.emBreve;

  const selos = [
    curso.emBreve ? '<span class="selo selo-embreve">Em breve</span>' : '',
    curso.ead ? '<span class="selo selo-ead">EAD</span>' : '',
    curso.id === ultimo && !curso.emBreve ? '<span class="selo">Último acesso</span>' : '',
  ].join('');

  /* disabled em vez de só "não faz nada": tira do tab, avisa o leitor
     de tela e dispensa qualquer guarda no handler de clique */
  return '<button type="button" class="curso' + (ativo ? ' is-ativo' : '') +
    (curso.emBreve ? ' is-embreve' : '') + '"' + (curso.emBreve ? ' disabled' : '') +
    ' data-curso="' + esc(curso.id) + '" aria-pressed="' + ativo + '" style="--h:' + curso.h + '">' +
    '<span class="curso-sigla" aria-hidden="true">' + esc(curso.sigla) + '</span>' +
    '<span class="curso-corpo">' +
      '<span class="curso-nome">' + esc(curso.nome) + '</span>' +
      '<span class="curso-status ' + status.classe + '">' + esc(status.texto) + '</span>' +
      (selos ? '<span class="curso-selos">' + selos + '</span>' : '') +
    '</span>' +
    '<span class="curso-check" aria-hidden="true">' + CHECK + '</span>' +
    '</button>';
}
