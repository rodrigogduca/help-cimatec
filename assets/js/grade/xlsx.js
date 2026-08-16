/* ============================================================
   LEITOR DE XLSX — sem dependências

   Um .xlsx é um ZIP de XMLs. O navegador já sabe descomprimir
   (DecompressionStream) e o XML de planilha é gerado por máquina,
   com forma previsível — então dá para ler o arquivo da coordenação
   sem carregar uma biblioteca de 900 kB só para isso.

   O mesmo módulo roda no Node (tools/gerar-oferta.mjs), por isso
   nada aqui usa DOM: a leitura do XML é feita com varredura de
   texto, que existe nos dois lados.
   ============================================================ */

const EOCD = 0x06054b50;   /* fim do diretório central */
const CENTRAL = 0x02014b50; /* entrada do diretório central */

/* Deflate comprime até cerca de 1000:1, então um .xlsx de 20 kB pode
   declarar 20 GB de conteúdo e derrubar a aba na descompressão. O teto
   é o total já descomprimido do arquivo inteiro: uma oferta de curso
   ocupa alguns MB de XML, então 64 MB deixa folga larga para a planilha
   de uma universidade inteira e ainda cabe na memória de um celular. */
const TETO_DESCOMPRIMIDO = 64 * 1024 * 1024;

/* Só o que o leitor abre depois entra na conta: um .xlsx costuma
   carregar imagens e temas que não interessam a ninguém aqui. */
const UTEIS = /\.(?:xml|rels)$/i;

/* O limite de colunas do próprio Excel (XFD). */
const MAX_COLUNAS = 16384;

/* ------------------------------------------------------------
   ZIP
   ------------------------------------------------------------ */

/**
 * Descomprime um bloco deflate cru usando a API do próprio ambiente,
 * desistindo assim que passar de `teto` bytes.
 *
 * A leitura é feita pedaço a pedaço de propósito: `new Response(...)
 * .arrayBuffer()` só devolve o controle no fim, e no fim já é tarde —
 * a memória do arquivo inteiro já foi pedida ao sistema.
 */
async function inflar(bytes, teto) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Este navegador não sabe descomprimir arquivos .xlsx. Exporte a planilha como CSV.');
  }

  const leitor = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader();

  const partes = [];
  let tamanho = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    tamanho += value.length;
    if (tamanho > teto) {
      leitor.cancel().catch(() => { /* já estamos saindo */ });
      throw estourou();
    }
    partes.push(value);
  }

  const saida = new Uint8Array(tamanho);
  let i = 0;
  for (const parte of partes) { saida.set(parte, i); i += parte.length; }
  return saida;
}

function estourou() {
  return new Error(
    'Esta planilha declara mais de ' + Math.round(TETO_DESCOMPRIMIDO / 1024 / 1024) +
    ' MB de conteúdo descomprimido — muito acima de qualquer oferta real. ' +
    'O arquivo não foi aberto. Confira se é mesmo a planilha da coordenação.',
  );
}

/**
 * Abre o ZIP e devolve Map<caminho, Uint8Array>.
 *
 * O diretório central fica no fim do arquivo e é a única lista
 * confiável do que existe dentro — os cabeçalhos locais podem ter
 * tamanho zerado quando o arquivo foi escrito em streaming.
 */
async function abrirZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  /* o EOCD tem tamanho variável (comentário no fim), então é procurado
     de trás para frente dentro do máximo que o comentário pode ocupar */
  let fim = -1;
  const limite = Math.max(0, bytes.length - 0xffff - 22);
  for (let i = bytes.length - 22; i >= limite; i--) {
    if (dv.getUint32(i, true) === EOCD) { fim = i; break; }
  }
  if (fim < 0) throw new Error('Arquivo .xlsx inválido: fim do ZIP não encontrado.');

  const total = dv.getUint16(fim + 10, true);
  let ponteiro = dv.getUint32(fim + 16, true);

  const arquivos = new Map();
  let orcamento = TETO_DESCOMPRIMIDO;

  for (let n = 0; n < total; n++) {
    if (dv.getUint32(ponteiro, true) !== CENTRAL) break;

    const metodo = dv.getUint16(ponteiro + 10, true);
    const comprimido = dv.getUint32(ponteiro + 20, true);
    const declarado = dv.getUint32(ponteiro + 24, true);
    const tamNome = dv.getUint16(ponteiro + 28, true);
    const tamExtra = dv.getUint16(ponteiro + 30, true);
    const tamComentario = dv.getUint16(ponteiro + 32, true);
    const offsetLocal = dv.getUint32(ponteiro + 42, true);
    const nome = new TextDecoder().decode(bytes.subarray(ponteiro + 46, ponteiro + 46 + tamNome));
    ponteiro += 46 + tamNome + tamExtra + tamComentario;

    if (!UTEIS.test(nome)) continue;

    /* o tamanho declarado barra a bomba honesta sem gastar nada; a que
       mente para menos é barrada pelo teto passado a inflar() */
    if (declarado > orcamento) throw estourou();

    /* o cabeçalho local repete nome e extra com tamanhos próprios;
       só depois deles começa o conteúdo */
    const nomeLocal = dv.getUint16(offsetLocal + 26, true);
    const extraLocal = dv.getUint16(offsetLocal + 28, true);
    const inicio = offsetLocal + 30 + nomeLocal + extraLocal;
    const bruto = bytes.subarray(inicio, inicio + comprimido);

    const conteudo = metodo === 0 ? bruto : await inflar(bruto, orcamento);
    orcamento -= conteudo.length;
    if (orcamento < 0) throw estourou();

    arquivos.set(nome, conteudo);
  }
  return arquivos;
}

/* ------------------------------------------------------------
   XML
   ------------------------------------------------------------ */

/**
 * Percorre os `<tag>…</tag>` de um trecho, em ordem, devolvendo os
 * atributos da abertura e o corpo de cada um. Trata prefixo de
 * namespace (`<x:row>`) e forma vazia (`<row/>`).
 *
 * A abertura é achada por regex, mas o corpo é recortado por índice —
 * e é essa a diferença que importa. Escrito como uma regex só, com
 * corpo preguiçoso (`<row>[\s\S]*?</row>`), o custo vira quadrático
 * quando o fechamento não existe: cada abertura varre o resto do
 * arquivo antes de desistir. Um .xlsx de 20 kB com um XML só de
 * "<row>" repetido prendia a aba por horas — a página não tem worker,
 * então quem trava é a interface inteira, sem botão de cancelar.
 * Aqui cada caractere é visitado uma vez.
 *
 * Sem fechamento a varredura para: o resto de um XML truncado não é
 * confiável, e insistir nele é justamente o caminho quadrático.
 */
function* elementos(xml, tag) {
  const reAbre = new RegExp('<(?:\\w+:)?' + tag + '(?=[\\s/>])', 'g');
  const reFecha = new RegExp('</(?:\\w+:)?' + tag + '\\s*>', 'g');

  let abre;
  while ((abre = reAbre.exec(xml))) {
    const fimDaTag = xml.indexOf('>', abre.index + abre[0].length);
    if (fimDaTag < 0) return;

    const attrs = xml.slice(abre.index + abre[0].length, fimDaTag);
    if (attrs.endsWith('/')) {
      yield { attrs: attrs.slice(0, -1), corpo: '' };
      reAbre.lastIndex = fimDaTag + 1;
      continue;
    }

    reFecha.lastIndex = fimDaTag + 1;
    const fecha = reFecha.exec(xml);
    if (!fecha) return;

    yield { attrs, corpo: xml.slice(fimDaTag + 1, fecha.index) };
    reAbre.lastIndex = fecha.index + fecha[0].length;
  }
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function desescapar(texto) {
  return texto.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (todo, corpo) => {
    if (corpo[0] === '#') {
      const codigo = corpo[1] === 'x' || corpo[1] === 'X'
        ? parseInt(corpo.slice(2), 16)
        : parseInt(corpo.slice(1), 10);
      /* fora da faixa Unicode, fromCodePoint lança — "&#99999999;" num
         arquivo qualquer não pode derrubar a leitura da planilha */
      const valido = Number.isFinite(codigo) && codigo >= 0 && codigo <= 0x10ffff;
      return valido ? String.fromCodePoint(codigo) : todo;
    }
    return corpo in ENTIDADES ? ENTIDADES[corpo] : todo;
  });
}

/** Junta o texto de todas as tags <t> de um trecho — cobre texto rico. */
function textoDeT(trecho) {
  let saida = '';
  for (const { corpo } of elementos(trecho, 't')) saida += desescapar(corpo);
  return saida;
}

/** O corpo da primeira <tag> do trecho, ou null se não houver nenhuma. */
function primeiro(trecho, tag) {
  for (const { corpo } of elementos(trecho, tag)) return corpo;
  return null;
}

function atributo(tag, nome) {
  const m = tag.match(new RegExp(nome + '="([^"]*)"'));
  return m ? m[1] : null;
}

/** "BC12" -> 54 (índice da coluna, base 0). */
function indiceColuna(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Tabela de strings compartilhadas — o Excel guarda o texto fora da planilha. */
function lerSharedStrings(xml) {
  if (!xml) return [];
  const itens = [];
  for (const { corpo } of elementos(xml, 'si')) itens.push(textoDeT(corpo));
  return itens;
}

/**
 * Uma planilha vira matriz de strings, respeitando colunas vazias:
 * a posição de cada célula vem do atributo r ("D4"), não da ordem.
 */
function lerPlanilha(xml, compartilhadas) {
  const linhas = [];

  for (const linhaXml of elementos(xml, 'row')) {
    const celulas = [];
    let largura = 0;
    let proxima = 0;

    for (const { attrs, corpo: conteudo } of elementos(linhaXml.corpo, 'c')) {
      const ref = atributo(attrs, 'r');
      const tipo = atributo(attrs, 't');
      const coluna = ref ? indiceColuna(ref) : proxima;
      proxima = coluna + 1;

      /* r="AAAAAAAA1" é uma coluna que o Excel não sabe escrever, mas
         que cabe num arquivo: sem este corte, `largura` viraria 10^11 e
         a linha seria montada célula por célula até a aba morrer */
      if (coluna < 0 || coluna >= MAX_COLUNAS) continue;

      const v = primeiro(conteudo, 'v');

      let valor = '';
      if (tipo === 'inlineStr') valor = textoDeT(conteudo);
      else if (tipo === 's') valor = v === null ? '' : (compartilhadas[Number(v)] || '');
      else valor = v === null ? '' : desescapar(v);

      celulas[coluna] = valor;
      if (valor !== '') largura = coluna + 1;
    }

    const linha = [];
    for (let i = 0; i < largura; i++) linha.push(celulas[i] === undefined ? '' : celulas[i]);
    linhas.push(linha);
  }

  return linhas;
}

/* ------------------------------------------------------------
   API
   ------------------------------------------------------------ */

/**
 * Lê um .xlsx inteiro.
 *
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {Promise<{nomes: string[], planilhas: Object<string, string[][]>}>}
 */
export async function lerXlsx(buffer) {
  const arquivos = await abrirZip(buffer);
  const texto = (caminho) => {
    const bytes = arquivos.get(caminho);
    return bytes ? new TextDecoder('utf-8').decode(bytes) : null;
  };

  const workbook = texto('xl/workbook.xml');
  if (!workbook) throw new Error('Arquivo .xlsx inválido: xl/workbook.xml não encontrado.');

  /* o nome da aba mora no workbook e o caminho do XML mora no .rels;
     o r:id é o que liga os dois */
  const alvos = new Map();
  const rels = texto('xl/_rels/workbook.xml.rels') || '';
  let mRel;
  const reRel = /<(?:\w+:)?Relationship\b([^>]*?)\/?>/g;
  while ((mRel = reRel.exec(rels))) {
    const id = atributo(mRel[1], 'Id');
    let alvo = atributo(mRel[1], 'Target') || '';
    if (alvo.startsWith('/')) alvo = alvo.slice(1);
    else if (!alvo.startsWith('xl/')) alvo = 'xl/' + alvo;
    if (id) alvos.set(id, alvo);
  }

  const compartilhadas = lerSharedStrings(texto('xl/sharedStrings.xml'));

  const nomes = [];
  const planilhas = {};
  const reAba = /<(?:\w+:)?sheet\b([^>]*?)\/?>/g;
  let mAba;
  let ordem = 0;
  while ((mAba = reAba.exec(workbook))) {
    ordem++;
    const nome = desescapar(atributo(mAba[1], 'name') || ('Planilha' + ordem));
    const rid = atributo(mAba[1], 'r:id') || atributo(mAba[1], 'id');
    const caminho = (rid && alvos.get(rid)) || ('xl/worksheets/sheet' + ordem + '.xml');
    const xml = texto(caminho);
    if (xml === null) continue;
    nomes.push(nome);
    planilhas[nome] = lerPlanilha(xml, compartilhadas);
  }

  return { nomes, planilhas };
}
