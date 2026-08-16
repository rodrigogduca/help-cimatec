/* ============================================================
   GERAR OFERTA — planilha da coordenação -> JSON do site

   Uso (a planilha de entrada mora em tools/ofertas/, fora do git —
   veja o README de lá):
     node tools/gerar-oferta.mjs tools/ofertas/GRD_HORARIOS_20262_FINAL.xls --somente engenharia-de-computacao
     node tools/gerar-oferta.mjs tools/ofertas/Grade_Engenharia_de_Computacao_2026_2.xlsx
     node tools/gerar-oferta.mjs arquivo.xlsx --curso "Engenharia de Computação" --periodo 2026.2

   A página sabe ler .xls e .xlsx sozinha, mas o arquivo publicado é
   JSON: normalizar uma vez aqui deixa o primeiro carregamento sem
   descompressão, e o JSON é o formato que o simulador documenta.

   Um arquivo pode conter vários cursos — o GRD_HORARIOS do sistema
   acadêmico traz todos. Nesse caso sai um JSON por curso, porque a
   oferta que a página abre é sempre a de um curso só, e `--somente`
   escolhe quais desses cursos vão para o ar. Hoje o site publica só
   Engenharia da Computação: para os outros cursos, quem manda é a
   planilha que o próprio aluno anexa na página.

   O catálogo assets/data/ofertas.json é atualizado a cada geração —
   é ele que enche o seletor de curso da página.
   ============================================================ */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lerXlsx } from '../assets/js/grade/xlsx.js';
import { lerXls } from '../assets/js/grade/xls.js';
import { acharCurso } from '../assets/js/grade/cursos.js';
import {
  lerCsv, normalizarLinhas, montarOferta, escolherPlanilha,
  metaDeTitulos, titulosDasPlanilhas, slug,
} from '../assets/js/grade/oferta.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pastaDados = path.join(raiz, 'assets', 'data');

function argumento(nome, padrao) {
  const i = process.argv.indexOf('--' + nome);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

/** "Grade_Engenharia_de_Computacao_2026_2.xlsx" -> curso e período. */
function adivinhar(arquivo) {
  const base = path.basename(arquivo).replace(/\.[^.]+$/, '');

  /* "2026_2" é como a coordenação nomeia; "20262", grudado, é como o
     sistema acadêmico exporta (GRD_HORARIOS_20262_FINAL). O separado
     é tentado primeiro: em "2026_2" o compacto não teria o que casar */
  const periodo = (
    base.match(/(20\d{2})[._-]([12])(?:\D|$)/) ||
    base.match(/(?:^|\D)(20\d{2})([12])(?!\d)/) ||
    []
  ).slice(1).join('.');

  const curso = base
    .replace(/^grade[._-]*/i, '')
    .replace(/(20\d{2})[._-]?([12])$/, '')
    .replace(/[._-]+/g, ' ')
    .trim();
  return { curso, periodo };
}

async function linhasDoArquivo(caminho) {
  if (/\.csv$|\.tsv$|\.txt$/i.test(caminho)) {
    const linhas = lerCsv(await readFile(caminho, 'utf8'));
    return { linhas, titulos: linhas.slice(0, 3).flat() };
  }

  const bytes = await readFile(caminho);
  /* .xls (Excel 97) é OLE2 com registros binários, e não um .xlsx
     antigo: são dois formatos e dois leitores */
  const { nomes, planilhas } = /\.xls$/i.test(caminho) ? lerXls(bytes) : await lerXlsx(bytes);
  const melhor = escolherPlanilha(planilhas, nomes);
  if (!melhor) throw new Error('Nenhuma aba com colunas de disciplina, dia e horário.');
  console.log('  aba escolhida: ' + melhor.nome);

  return { linhas: melhor.linhas, titulos: titulosDasPlanilhas(planilhas, nomes) };
}

/**
 * Um grupo por curso, na ordem em que os cursos aparecem no arquivo.
 *
 * A planilha de coordenação é de um curso só e cai num grupo só —
 * o caminho antigo continua sendo este, sem desvio.
 *
 * Quem decide se dois nomes são o mesmo curso é cursos.js, que já
 * guarda as variações que a instituição escreve. O GRD_HORARIOS tem
 * duas linhas em que "Engenharia de Computação" saiu como
 * "Engenharia Computação": sem juntar aqui, o mesmo curso ganharia
 * dois arquivos e o cartão dele ofereceria duas ofertas do mesmo
 * semestre, uma delas com uma turma só.
 */
function agruparPorCurso(turmas, padrao) {
  const grupos = new Map();

  for (const turma of turmas) {
    const escrito = turma.curso || slug(padrao.cursoNome) || 'curso';
    const curso = acharCurso(escrito);
    const chave = curso ? curso.id : escrito;

    let grupo = grupos.get(chave);
    if (!grupo) { grupo = { variantes: new Map(), turmas: [] }; grupos.set(chave, grupo); }

    /* o slug e o nome do grupo saem da grafia majoritária, e não da
       primeira: a variante certa é a que a instituição repete */
    const contagem = grupo.variantes.get(escrito) ||
      { curso: escrito, cursoNome: turma.cursoNome || padrao.cursoNome || 'Curso', vezes: 0 };
    contagem.vezes++;
    grupo.variantes.set(escrito, contagem);
    grupo.turmas.push(turma);
  }

  return [...grupos.values()].map((grupo) => {
    const escolhida = [...grupo.variantes.values()].sort((a, b) => b.vezes - a.vezes)[0];
    for (const turma of grupo.turmas) {
      if (turma.curso === escolhida.curso) continue;
      /* o id da turma abre com o slug do curso; trocar só esse pedaço
         mantém a regra de formação onde ela é escrita, no oferta.js */
      turma.id = escolhida.curso + turma.id.slice(turma.curso.length);
      turma.curso = escolhida.curso;
      turma.cursoNome = escolhida.cursoNome;
    }
    return { curso: escolhida.curso, cursoNome: escolhida.cursoNome, turmas: grupo.turmas };
  });
}

async function main() {
  const entrada = process.argv[2];
  if (!entrada) {
    console.error('uso: node tools/gerar-oferta.mjs <planilha> [--curso NOME] [--periodo 2026.2]');
    process.exit(1);
  }

  const caminho = path.resolve(entrada);
  console.log('lendo ' + path.relative(raiz, caminho));
  const { linhas, titulos } = await linhasDoArquivo(caminho);

  const doNome = adivinhar(caminho);
  const doTopo = metaDeTitulos(titulos);
  const cursoNome = argumento('curso', doTopo.cursoNome || doNome.curso || 'Curso');
  const periodo = argumento('periodo', doTopo.periodo || doNome.periodo || '');

  const { turmas, avisos, ressalva } = normalizarLinhas(linhas, { cursoNome });
  for (const aviso of avisos) console.warn('  ! ' + aviso);
  /* a planilha da coordenação costuma dizer no subtítulo o que ficou de
     fora; vai junto para a página poder explicar a disciplina ausente */
  if (ressalva) console.log('  ressalva do arquivo: ' + ressalva);

  const todos = agruparPorCurso(turmas, { cursoNome });
  if (todos.length > 1) console.log('  ' + todos.length + ' cursos neste arquivo');

  /* --somente engenharia-de-computacao,engenharia-civil: o arquivo pode
     trazer a universidade inteira sem que se queira publicar tudo */
  const escolhidos = argumento('somente', '').split(',').map((s) => s.trim()).filter(Boolean);
  const grupos = escolhidos.length
    ? todos.filter((g) => escolhidos.some((e) => {
      const curso = acharCurso(e);
      return curso ? curso.slugs.includes(g.curso) : e === g.curso;
    }))
    : todos;

  if (escolhidos.length && !grupos.length) {
    throw new Error('nenhum curso do arquivo casa com --somente ' + escolhidos.join(','));
  }
  if (grupos.length < todos.length) {
    console.log('  publicando ' + grupos.length + ': ' + grupos.map((g) => g.cursoNome).join(', '));
  }

  const catalogoPath = path.join(pastaDados, 'ofertas.json');
  let catalogo = [];
  if (existsSync(catalogoPath)) catalogo = JSON.parse(await readFile(catalogoPath, 'utf8'));
  if (!existsSync(pastaDados)) await mkdir(pastaDados, { recursive: true });

  for (const grupo of grupos) {
    const oferta = montarOferta(grupo.turmas, {
      curso: grupo.curso,
      cursoNome: grupo.cursoNome,
      periodo,
      origem: path.basename(caminho),
      ressalva,
    });

    const nomeArquivo = grupo.curso + '-' + (periodo.replace('.', '-') || 'atual') + '.json';
    await writeFile(path.join(pastaDados, nomeArquivo), JSON.stringify(oferta) + '\n', 'utf8');

    /* catálogo: entrada nova entra, entrada do mesmo curso+período é substituída */
    const entradaCatalogo = {
      id: grupo.curso + '-' + periodo,
      curso: oferta.curso,
      cursoNome: oferta.cursoNome,
      periodo,
      arquivo: 'assets/data/' + nomeArquivo,
      turmas: oferta.turmas.length,
      origem: oferta.origem,
      gerado: oferta.gerado,
    };
    catalogo = catalogo.filter((o) => o.id !== entradaCatalogo.id).concat([entradaCatalogo]);

    const aulas = oferta.turmas.reduce((s, t) => s + t.aulas, 0);
    console.log(`  ${oferta.cursoNome} ${periodo}: ${oferta.turmas.length} turmas, ${aulas} aulas -> ${nomeArquivo}`);
    /* curso que não está em cursos.js não tem cartão no passo 1: o JSON
       sai, mas ninguém o alcança pela página */
    if (!acharCurso(grupo.curso)) {
      console.warn('  ! "' + oferta.cursoNome + '" não está em cursos.js — ficará sem cartão na página');
    }
  }

  catalogo.sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)) ||
    a.cursoNome.localeCompare(b.cursoNome, 'pt-BR'));
  await writeFile(catalogoPath, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');
  console.log('  catálogo: ' + catalogo.length + ' ofertas em assets/data/ofertas.json');
}

main().catch((erro) => {
  console.error('erro: ' + erro.message);
  process.exit(1);
});
