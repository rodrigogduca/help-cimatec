/* ============================================================
   LEITOR DE XLS — sem dependências

   O .xls do Excel 97 não é o .xlsx: não é ZIP nem XML. É um
   sistema de arquivos inteiro (OLE2/CFB — setores, tabela de
   alocação e diretório) com um fluxo binário dentro, o Workbook,
   feito de registros de tamanho fixo (BIFF8).

   Ele está aqui porque é o que o sistema acadêmico exporta: o
   GRD_HORARIOS de um semestre sai em .xls, com todos os cursos.
   Converter à mão no Excel antes de importar é um passo que o
   aluno não tem como dar no celular.

   A saída é a mesma do xlsx.js — { nomes, planilhas } de strings —
   para o resto do simulador não saber de qual dos dois veio a
   planilha. O mesmo módulo roda no Node (tools/gerar-oferta.mjs),
   então nada aqui usa DOM.

   Um .xls não é comprimido, então não há bomba de descompressão
   para conter; o risco daqui é outro e está marcado em cada teto:
   cadeia de setores que se morde e índice que aponta para fora.
   ============================================================ */

/* A assinatura do formato composto da Microsoft. Vale para .doc e
   .ppt antigos também, então casar aqui não garante que é planilha —
   quem responde isso é o fluxo Workbook lá embaixo. */
const ASSINATURA = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const LIVRE = 0xffffffff;      /* setor não usado */
const FIM = 0xfffffffe;        /* fim de cadeia */
const MAX_ESPECIAL = 0xfffffffa; /* acima disso, é marca e não setor */

/* O limite de colunas do próprio Excel; em BIFF8 as linhas param em
   65536. Os dois são teto de arquivo válido, e servem de corte para
   um índice corrompido não virar uma matriz impossível. */
const MAX_COLUNAS = 16384;
const MAX_LINHAS = 65536;

/* Cada célula ocupa pelo menos 10 bytes no arquivo, então um .xls de
   20 MB (o teto que a página aplica antes de ler) não passa de uns
   2 milhões de células. Um milhão já é cinquenta vezes a maior oferta
   que a universidade publica: acima disso o arquivo não é uma grade. */
const TETO_CELULAS = 1000000;

/* ------------------------------------------------------------
   CFB — o sistema de arquivos dentro do arquivo
   ------------------------------------------------------------ */

function invalido(motivo) {
  return new Error('Arquivo .xls inválido: ' + motivo + '.');
}

/**
 * Percorre uma cadeia de setores da FAT.
 *
 * O `visitados` não é zelo: a FAT é um vetor de "próximo setor", e
 * um arquivo truncado no meio da escrita produz cadeia que aponta
 * para trás. Sem o corte, a leitura roda para sempre — e a página
 * não tem worker, então quem trava é a aba inteira.
 */
function cadeia(fat, inicio, teto) {
  const setores = [];
  const visitados = new Set();
  let s = inicio;
  while (s <= MAX_ESPECIAL) {
    if (s >= fat.length || visitados.has(s)) break;
    visitados.add(s);
    setores.push(s);
    if (setores.length > teto) throw invalido('cadeia de setores maior que o próprio arquivo');
    s = fat[s];
  }
  return setores;
}

/**
 * Abre o container e devolve os fluxos que interessam.
 *
 * Fluxo pequeno (abaixo do corte declarado no cabeçalho) não mora nos
 * setores normais: mora dentro de um fluxo só, o mini, com setores
 * próprios de 64 bytes. O Workbook de uma oferta real passa longe
 * desse tamanho, mas uma planilha de teste com três linhas cai lá.
 */
function abrirCfb(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 512) throw invalido('menor que o cabeçalho do formato');
  for (let i = 0; i < ASSINATURA.length; i++) {
    if (bytes[i] !== ASSINATURA[i]) {
      throw new Error('Este arquivo não é um .xls do Excel. Se ele foi renomeado, ' +
        'abra no Excel e salve como .xlsx ou .csv.');
    }
  }

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const expoente = dv.getUint16(0x1e, true);
  const expoenteMini = dv.getUint16(0x20, true);
  if (expoente < 7 || expoente > 12 || expoenteMini < 4 || expoenteMini > 12) {
    throw invalido('tamanho de setor fora do que o formato admite');
  }

  const tamSetor = 1 << expoente;
  const tamMini = 1 << expoenteMini;
  const totalSetores = Math.max(0, Math.floor((bytes.length - 512) / tamSetor));
  const inicioDe = (i) => 512 + i * tamSetor;

  const nFat = dv.getUint32(0x2c, true);
  const dirInicio = dv.getUint32(0x30, true);
  const corte = dv.getUint32(0x38, true);
  const miniFatInicio = dv.getUint32(0x3c, true);
  const difatInicio = dv.getUint32(0x44, true);
  const nDifat = dv.getUint32(0x48, true);

  /* a lista de setores da FAT começa no próprio cabeçalho (109 entradas)
     e continua em setores encadeados quando o arquivo é grande */
  const difat = [];
  for (let i = 0; i < 109 && difat.length < nFat; i++) {
    const s = dv.getUint32(0x4c + i * 4, true);
    if (s <= MAX_ESPECIAL) difat.push(s);
  }
  let proximo = difatInicio;
  const vistos = new Set();
  for (let n = 0; n < nDifat && proximo <= MAX_ESPECIAL; n++) {
    if (proximo >= totalSetores || vistos.has(proximo)) break;
    vistos.add(proximo);
    const base = inicioDe(proximo);
    for (let i = 0; i < tamSetor / 4 - 1; i++) {
      const s = dv.getUint32(base + i * 4, true);
      if (s <= MAX_ESPECIAL) difat.push(s);
    }
    proximo = dv.getUint32(base + tamSetor - 4, true);
  }

  const fat = [];
  for (const setor of difat) {
    if (setor >= totalSetores) continue;
    const base = inicioDe(setor);
    for (let i = 0; i < tamSetor / 4; i++) fat.push(dv.getUint32(base + i * 4, true));
  }
  if (!fat.length) throw invalido('tabela de alocação vazia');

  const lerCadeia = (inicio, tamanho) => {
    const setores = cadeia(fat, inicio, totalSetores + 1);
    const saida = new Uint8Array(setores.length * tamSetor);
    let i = 0;
    for (const setor of setores) {
      if (setor < totalSetores) saida.set(bytes.subarray(inicioDe(setor), inicioDe(setor) + tamSetor), i);
      i += tamSetor;
    }
    return tamanho === undefined ? saida : saida.subarray(0, Math.min(tamanho, saida.length));
  };

  /* diretório: uma entrada de 128 bytes por fluxo, nome em UTF-16 */
  const diretorio = lerCadeia(dirInicio);
  const entradas = [];
  for (let off = 0; off + 128 <= diretorio.length; off += 128) {
    const tamNome = diretorio[off + 0x40] | (diretorio[off + 0x41] << 8);
    let nome = '';
    for (let i = 0; i + 1 < Math.max(0, tamNome - 2); i += 2) {
      nome += String.fromCharCode(diretorio[off + i] | (diretorio[off + i + 1] << 8));
    }
    const d = new DataView(diretorio.buffer, diretorio.byteOffset + off, 128);
    entradas.push({ nome, tipo: diretorio[off + 0x42], inicio: d.getUint32(0x74, true), tamanho: d.getUint32(0x78, true) });
  }

  const raiz = entradas.find((e) => e.tipo === 5);

  const lerMini = (inicio, tamanho) => {
    if (!raiz) return new Uint8Array(0);
    const dados = lerCadeia(raiz.inicio, raiz.tamanho);
    const tabela = [];
    const bruta = lerCadeia(miniFatInicio);
    const bd = new DataView(bruta.buffer, bruta.byteOffset, bruta.byteLength);
    for (let i = 0; (i + 1) * 4 <= bruta.length; i++) tabela.push(bd.getUint32(i * 4, true));

    const setores = cadeia(tabela, inicio, tabela.length + 1);
    const saida = new Uint8Array(setores.length * tamMini);
    let i = 0;
    for (const setor of setores) {
      saida.set(dados.subarray(setor * tamMini, setor * tamMini + tamMini), i);
      i += tamMini;
    }
    return saida.subarray(0, Math.min(tamanho, saida.length));
  };

  const abrir = (nome) => {
    const entrada = entradas.find((e) => e.tipo === 2 && e.nome === nome);
    if (!entrada) return null;
    return entrada.tamanho < corte ? lerMini(entrada.inicio, entrada.tamanho) : lerCadeia(entrada.inicio, entrada.tamanho);
  };

  /* "Workbook" é o nome desde o Excel 97; "Book" é o do 95 e serve
     para dar o recado certo em vez de "não é um .xls" */
  return abrir('Workbook') || abrir('Book');
}

/* ------------------------------------------------------------
   BIFF — os registros do fluxo Workbook
   ------------------------------------------------------------ */

const BOF = 0x0809, EOF_ = 0x000a, FILEPASS = 0x002f, DATEMODE = 0x0022;
const BOUNDSHEET = 0x0085, SST = 0x00fc, CONTINUE = 0x003c;
const FORMAT = 0x041e, XF = 0x00e0;
const LABELSST = 0x00fd, LABEL = 0x0204, RSTRING = 0x00d6;
const NUMBER = 0x0203, RK = 0x027e, MULRK = 0x00bd;
const FORMULA = 0x0006, STRING = 0x0207, BOOLERR = 0x0205;

/** Os registros do fluxo, em ordem, cada um com onde o corpo começa. */
function lerRegistros(fluxo) {
  const dv = new DataView(fluxo.buffer, fluxo.byteOffset, fluxo.byteLength);
  const registros = [];
  let p = 0;
  while (p + 4 <= fluxo.length) {
    const tipo = dv.getUint16(p, true);
    const tamanho = dv.getUint16(p + 2, true);
    /* registro que declara mais do que sobra é arquivo truncado: parar
       aqui devolve o que já foi lido em vez de ler lixo do fim */
    if (p + 4 + tamanho > fluxo.length) break;
    registros.push({ tipo, inicio: p + 4, tamanho });
    p += 4 + tamanho;
  }
  return { registros, dv };
}

/**
 * Texto de uma célula ou de um item da tabela de strings.
 *
 * O BIFF8 guarda o comprimento em caracteres e um byte de bandeiras
 * que diz se cada caractere ocupa um byte (latin-1) ou dois (UTF-16),
 * e se depois do texto ainda vêm listas de formatação que não
 * interessam aqui — mas cujo tamanho precisa ser pulado.
 */
function lerTexto(dv, off, fim, bytesDoTamanho) {
  if (off + bytesDoTamanho + 1 > fim) return { texto: '', off: fim };
  const cch = bytesDoTamanho === 1 ? dv.getUint8(off) : dv.getUint16(off, true);
  let p = off + bytesDoTamanho;
  const bandeiras = dv.getUint8(p); p += 1;

  const largo = bandeiras & 0x01;
  const trechos = (bandeiras & 0x08) ? dv.getUint16(p, true) : 0;
  if (bandeiras & 0x08) p += 2;
  const extra = (bandeiras & 0x04) ? dv.getUint32(p, true) : 0;
  if (bandeiras & 0x04) p += 4;

  let texto = '';
  for (let i = 0; i < cch; i++) {
    const pos = p + (largo ? i * 2 : i);
    if (pos + (largo ? 1 : 0) >= fim) break;
    texto += String.fromCharCode(largo ? dv.getUint16(pos, true) : dv.getUint8(pos));
  }
  p += largo ? cch * 2 : cch;
  return { texto, off: Math.min(fim, p + trechos * 4 + extra) };
}

/**
 * A tabela de strings, que é onde mora quase todo o texto da planilha.
 *
 * Ela é maior que o teto de um registro (8 kB), então continua em
 * registros CONTINUE — e uma string pode ser cortada no meio da
 * emenda. Quando isso acontece, o pedaço seguinte recomeça com um
 * novo byte de bandeiras, que pode inclusive trocar a largura do
 * caractere. Por isso os pedaços são costurados num buffer só, com
 * as emendas anotadas: é nelas, e só nelas, que a bandeira volta.
 */
function lerSst(fluxo, registros, indice) {
  const pedacos = [registros[indice]];
  for (let i = indice + 1; i < registros.length && registros[i].tipo === CONTINUE; i++) pedacos.push(registros[i]);

  let total = 0;
  for (const p of pedacos) total += p.tamanho;
  const buf = new Uint8Array(total);
  const emendas = [];
  let n = 0;
  for (const p of pedacos) {
    emendas.push(n);
    buf.set(fluxo.subarray(p.inicio, p.inicio + p.tamanho), n);
    n += p.tamanho;
  }

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const quantas = buf.length >= 8 ? dv.getUint32(4, true) : 0;
  const strings = [];

  let p = 8;
  let proximaEmenda = 1;   /* a primeira emenda é o início do buffer */
  const emendaApos = (pos) => {
    while (proximaEmenda < emendas.length && emendas[proximaEmenda] <= pos) proximaEmenda++;
    return proximaEmenda < emendas.length ? emendas[proximaEmenda] : buf.length;
  };

  for (let i = 0; i < quantas && p + 3 <= buf.length; i++) {
    const cch = dv.getUint16(p, true); p += 2;
    let bandeiras = dv.getUint8(p); p += 1;
    const trechos = (bandeiras & 0x08) ? dv.getUint16(p, true) : 0;
    if (bandeiras & 0x08) p += 2;
    const extra = (bandeiras & 0x04) ? dv.getUint32(p, true) : 0;
    if (bandeiras & 0x04) p += 4;

    let texto = '';
    let faltam = cch;
    while (faltam > 0 && p < buf.length) {
      const largo = bandeiras & 0x01;
      const ate = Math.min(emendaApos(p), buf.length);
      const cabem = largo ? Math.floor((ate - p) / 2) : (ate - p);
      const usa = Math.max(0, Math.min(faltam, cabem));
      for (let k = 0; k < usa; k++) {
        texto += String.fromCharCode(largo ? dv.getUint16(p + k * 2, true) : dv.getUint8(p + k));
      }
      p += largo ? usa * 2 : usa;
      faltam -= usa;
      /* a bandeira nova só existe quando o corte caiu no meio da string */
      if (faltam > 0) { if (p >= buf.length) break; bandeiras = dv.getUint8(p); p += 1; }
    }
    p += trechos * 4 + extra;
    strings.push(texto);
  }

  return strings;
}

/* ------------------------------------------------------------
   números com cara de hora

   A planilha do sistema acadêmico guarda "16:40" como 0,694444 —
   fração do dia — e deixa a hora por conta do formato da célula.
   Sem desfazer isso aqui, o horário chegaria como dízima ao
   normalizador e a aula sairia sem hora nenhuma.
   ------------------------------------------------------------ */

/* Os formatos que o Excel não escreve no arquivo por já serem dele.
   Só os de data e hora precisam estar aqui: é o que muda a leitura. */
const FORMATOS_INTERNOS = {
  14: 'dd/mm/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy',
  18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss',
  22: 'm/d/yy h:mm', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0',
};

/**
 * O que o formato pede: data, hora, as duas ou nenhuma.
 *
 * O texto entre aspas é literal ("mês" não é um mês), e a barra
 * invertida escapa o caractere seguinte — sem pular os dois, um
 * formato de moeda em português viraria data por causa do "d".
 */
function tipoDoFormato(formato) {
  let data = false;
  let hora = false;
  let aspas = false;
  let colchetes = false;

  for (let i = 0; i < formato.length; i++) {
    const c = formato[i];
    if (c === '\\') { i++; continue; }
    if (c === '"') { aspas = !aspas; continue; }
    if (aspas) continue;
    if (c === '[') { colchetes = true; continue; }
    if (c === ']') { colchetes = false; continue; }
    if (colchetes) continue;
    if (c === 'y' || c === 'Y' || c === 'd' || c === 'D') data = true;
    else if (c === 'h' || c === 'H' || c === 's' || c === 'S') hora = true;
  }
  return { data, hora };
}

const doisDigitos = (n) => String(n).padStart(2, '0');

/**
 * Serial do Excel -> texto.
 *
 * O dia 0 do Excel é 30/12/1899 porque a planilha original repetia o
 * bug de 1900 ser bissexto, e todo mundo copiou. A conta é feita em
 * UTC de propósito: com fuso local, uma data no horário de verão
 * andaria um dia para trás.
 */
function textoDeSerial(valor, tipo, epoca1904) {
  const dias = Math.floor(valor);
  /* a fração é a hora do dia; o arredondamento para o minuto evita
     0,694444… virar 16:39 por causa do último bit do double */
  const segundosDoDia = Math.round((valor - dias) * 86400);

  const h = Math.floor(segundosDoDia / 3600) % 24;
  const min = Math.floor(segundosDoDia / 60) % 60;
  const seg = segundosDoDia % 60;
  const hora = doisDigitos(h) + ':' + doisDigitos(min) + (seg ? ':' + doisDigitos(seg) : '');

  if (!tipo.data) return hora;

  const base = Date.UTC(epoca1904 ? 1904 : 1899, epoca1904 ? 0 : 11, epoca1904 ? 1 : 30);
  const d = new Date(base + (dias + Math.floor(segundosDoDia / 86400)) * 86400000);
  const dataTexto = doisDigitos(d.getUTCDate()) + '/' + doisDigitos(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
  return tipo.hora ? dataTexto + ' ' + hora : dataTexto;
}

/**
 * Número sem formato de data vira texto sem a sujeira do binário:
 * 0,1 + 0,2 guardado em double volta como 0,30000000000000004, e
 * esse texto iria inteiro para a tela.
 */
function textoDeNumero(valor) {
  if (!Number.isFinite(valor)) return '';
  if (Number.isInteger(valor)) return String(valor);
  return String(Number(valor.toPrecision(15)));
}

/* ------------------------------------------------------------
   API
   ------------------------------------------------------------ */

/**
 * Lê um .xls (Excel 97-2003) inteiro.
 *
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {{nomes: string[], planilhas: Object<string, string[][]>}}
 */
export function lerXls(buffer) {
  const fluxo = abrirCfb(buffer);
  if (!fluxo || !fluxo.length) throw invalido('não encontrei a planilha dentro do arquivo');

  const { registros, dv } = lerRegistros(fluxo);
  if (!registros.length) throw invalido('nenhum registro legível');

  const primeiro = registros.find((r) => r.tipo === BOF);
  if (!primeiro) throw invalido('não encontrei o início da planilha');
  const versao = dv.getUint16(primeiro.inicio, true);
  if (versao < 0x0600) {
    throw new Error('Esta planilha está no formato do Excel 5/95, que este leitor não abre. ' +
      'Abra no Excel e salve de novo como .xls, .xlsx ou .csv.');
  }

  /* ---- globais: strings, formatos, abas ---- */
  let sst = [];
  let epoca1904 = false;
  const formatos = new Map();
  const formatoDoXf = [];
  const abas = [];

  for (let i = 0; i < registros.length; i++) {
    const r = registros[i];

    if (r.tipo === FILEPASS) {
      throw new Error('Esta planilha está protegida por senha. Abra no Excel, remova a proteção ' +
        'e salve de novo, ou exporte em .csv.');
    }

    if (r.tipo === DATEMODE) epoca1904 = dv.getUint16(r.inicio, true) === 1;
    else if (r.tipo === SST) sst = lerSst(fluxo, registros, i);
    else if (r.tipo === XF) formatoDoXf.push(dv.getUint16(r.inicio + 2, true));
    else if (r.tipo === FORMAT) {
      const id = dv.getUint16(r.inicio, true);
      formatos.set(id, lerTexto(dv, r.inicio + 2, r.inicio + r.tamanho, 2).texto);
    } else if (r.tipo === BOUNDSHEET) {
      const tipoAba = dv.getUint8(r.inicio + 5);
      const nome = lerTexto(dv, r.inicio + 6, r.inicio + r.tamanho, 1).texto;
      /* tipo 0 é planilha; 1 e 2 são macro e gráfico, que não têm células */
      if (tipoAba === 0) abas.push({ nome: nome || 'Planilha ' + (abas.length + 1), posicao: dv.getUint32(r.inicio, true) });
    } else if (r.tipo === EOF_ && abas.length) {
      break; /* fim dos globais: o resto do fluxo são as abas */
    }
  }

  /* o tipo do formato é o mesmo para milhares de células; resolver uma
     vez por XF evita reprocessar a máscara em cada hora da planilha */
  const tipoDoXf = formatoDoXf.map((id) => {
    const texto = formatos.get(id) || FORMATOS_INTERNOS[id] || '';
    return texto ? tipoDoFormato(texto) : null;
  });

  /* ---- células ---- */
  const porPosicao = new Map();
  for (const r of registros) porPosicao.set(r.inicio - 4, r);

  const nomes = [];
  const planilhas = {};
  let celulas = 0;

  for (const aba of abas) {
    const grade = new Map();   /* linha -> Map(coluna -> texto) */
    let ultimaLinha = -1;
    let ultimaFormula = null;  /* espera o STRING que traz o resultado */

    const guardar = (linha, coluna, texto) => {
      if (linha < 0 || linha >= MAX_LINHAS || coluna < 0 || coluna >= MAX_COLUNAS) return;
      if (++celulas > TETO_CELULAS) {
        throw new Error('Esta planilha tem mais de ' + (TETO_CELULAS / 1000) + ' mil células — ' +
          'muito acima de qualquer oferta real. O arquivo não foi aberto.');
      }
      if (texto === '') return;
      let daLinha = grade.get(linha);
      if (!daLinha) { daLinha = new Map(); grade.set(linha, daLinha); }
      daLinha.set(coluna, texto);
      if (linha > ultimaLinha) ultimaLinha = linha;
    };

    const numero = (linha, coluna, xf, valor) => {
      const tipo = tipoDoXf[xf];
      guardar(linha, coluna, tipo && (tipo.data || tipo.hora)
        ? textoDeSerial(valor, tipo, epoca1904)
        : textoDeNumero(valor));
    };

    /* o RK é um double espremido em 32 bits: ou um inteiro de 30 bits,
       ou os 30 bits mais altos da mantissa, opcionalmente dividido por
       100 — foi como o Excel 95 economizou espaço, e ficou */
    const auxiliar = new DataView(new ArrayBuffer(8));
    const deRk = (bruto) => {
      const cem = bruto & 1;
      let n;
      if (bruto & 2) n = (bruto | 0) >> 2;
      else {
        auxiliar.setUint32(0, 0, true);
        auxiliar.setUint32(4, bruto & 0xfffffffc, true);
        n = auxiliar.getFloat64(0, true);
      }
      return cem ? n / 100 : n;
    };

    let p = aba.posicao;
    let profundidade = 0;
    while (porPosicao.has(p)) {
      const r = porPosicao.get(p);
      p += 4 + r.tamanho;

      if (r.tipo === BOF) { profundidade++; continue; }
      if (r.tipo === EOF_) { if (--profundidade <= 0) break; continue; }
      /* um gráfico dentro da aba abre um sub-fluxo próprio; as células
         que interessam são as do primeiro nível */
      if (profundidade !== 1) continue;

      const inicio = r.inicio;
      const fim = inicio + r.tamanho;

      if (r.tipo === LABELSST) {
        const indice = dv.getUint32(inicio + 6, true);
        guardar(dv.getUint16(inicio, true), dv.getUint16(inicio + 2, true), sst[indice] || '');
      } else if (r.tipo === LABEL || r.tipo === RSTRING) {
        guardar(dv.getUint16(inicio, true), dv.getUint16(inicio + 2, true),
          lerTexto(dv, inicio + 6, fim, 2).texto);
      } else if (r.tipo === NUMBER) {
        numero(dv.getUint16(inicio, true), dv.getUint16(inicio + 2, true),
          dv.getUint16(inicio + 4, true), dv.getFloat64(inicio + 6, true));
      } else if (r.tipo === RK) {
        numero(dv.getUint16(inicio, true), dv.getUint16(inicio + 2, true),
          dv.getUint16(inicio + 4, true), deRk(dv.getUint32(inicio + 6, true)));
      } else if (r.tipo === MULRK) {
        const linha = dv.getUint16(inicio, true);
        const primeira = dv.getUint16(inicio + 2, true);
        for (let k = 0; inicio + 4 + k * 6 + 6 <= fim - 2; k++) {
          numero(linha, primeira + k, dv.getUint16(inicio + 4 + k * 6, true),
            deRk(dv.getUint32(inicio + 4 + k * 6 + 2, true)));
        }
      } else if (r.tipo === BOOLERR) {
        const erro = dv.getUint8(inicio + 7);
        guardar(dv.getUint16(inicio, true), dv.getUint16(inicio + 2, true),
          erro ? '' : (dv.getUint8(inicio + 6) ? 'VERDADEIRO' : 'FALSO'));
      } else if (r.tipo === FORMULA) {
        const linha = dv.getUint16(inicio, true);
        const coluna = dv.getUint16(inicio + 2, true);
        const xf = dv.getUint16(inicio + 4, true);
        /* fórmula guarda o último resultado calculado; quando ele é
           texto, os dois últimos bytes são 0xFFFF e o texto vem no
           registro STRING logo em seguida */
        if (dv.getUint16(inicio + 12, true) === 0xffff) {
          ultimaFormula = dv.getUint8(inicio + 6) === 0 ? { linha, coluna } : null;
        } else {
          numero(linha, coluna, xf, dv.getFloat64(inicio + 6, true));
        }
      } else if (r.tipo === STRING && ultimaFormula) {
        guardar(ultimaFormula.linha, ultimaFormula.coluna, lerTexto(dv, inicio, fim, 2).texto);
        ultimaFormula = null;
      }
    }

    /* a matriz sai densa, como a do xlsx.js: quem lê a planilha depois
       conta colunas por índice, e buraco no meio da linha desalinharia */
    const linhas = [];
    for (let i = 0; i <= ultimaLinha; i++) {
      const daLinha = grade.get(i);
      if (!daLinha) { linhas.push([]); continue; }
      let largura = 0;
      for (const coluna of daLinha.keys()) if (coluna + 1 > largura) largura = coluna + 1;
      const linha = new Array(largura);
      for (let c = 0; c < largura; c++) linha[c] = daLinha.get(c) || '';
      linhas.push(linha);
    }

    /* aba de nome repetido não pode sumir dentro da outra */
    let nome = aba.nome;
    for (let n = 2; planilhas[nome] !== undefined; n++) nome = aba.nome + ' (' + n + ')';
    nomes.push(nome);
    planilhas[nome] = linhas;
  }

  if (!nomes.length) throw invalido('nenhuma aba com células');
  return { nomes, planilhas };
}
