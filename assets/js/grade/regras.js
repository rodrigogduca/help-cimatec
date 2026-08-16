/* ============================================================
   REGRAS — equivalência, choque de horário e carga

   Duas perguntas sustentam o simulador:

   1. "isto é a mesma disciplina que aquilo?"  -> equivalência
   2. "isto cabe junto com aquilo?"            -> choque

   As duas são independentes: turmas equivalentes quase sempre
   chocam entre si e turmas que chocam quase nunca são a mesma
   disciplina. Por isso cada uma tem o seu próprio aviso.
   ============================================================ */

import { DIAS, AULA_MIN, slug } from './oferta.js';

/* ------------------------------------------------------------
   equivalência
   ------------------------------------------------------------ */

/**
 * Índice da oferta com as equivalências já resolvidas.
 *
 * A chave de equivalência é, em ordem de confiança:
 *   1. o código da disciplina, quando a planilha traz um;
 *   2. o grupo declarado em `equivalencias` (ementas iguais com
 *      nomes diferentes entre cursos);
 *   3. o nome normalizado.
 *
 * O nome sozinho é frágil, mas é o que existe na maioria dos
 * arquivos — e é ele que faz "Cálculo A do meu curso" encontrar
 * "Cálculo A" oferecido para outro curso no mesmo semestre.
 */
export function indexar(oferta) {
  const grupos = new Map();
  for (const grupo of oferta.equivalencias || []) {
    const representante = slug(grupo[0]);
    for (const membro of grupo) grupos.set(slug(membro), representante);
  }

  const chave = (turma) => {
    const porCodigo = turma.codigoDisciplina ? 'cod:' + slug(turma.codigoDisciplina) : null;
    const nome = turma.disciplinaId;
    return porCodigo || grupos.get(nome) || nome;
  };

  const porId = new Map();
  const porEquivalencia = new Map();

  for (const turma of oferta.turmas) {
    turma.equivalencia = chave(turma);
    porId.set(turma.id, turma);

    if (!porEquivalencia.has(turma.equivalencia)) porEquivalencia.set(turma.equivalencia, []);
    porEquivalencia.get(turma.equivalencia).push(turma);
  }

  /* Cor por disciplina, distribuída pelo ângulo áureo sobre a lista
     ordenada: duas disciplinas vizinhas na lista caem em lados opostos
     do círculo de matiz, e a cor de uma matéria não muda enquanto a
     oferta for a mesma. Sortear por hash agrupava verdes demais. */
  const ordenadas = [...porEquivalencia.keys()].sort();
  ordenadas.forEach((chaveDisciplina, i) => {
    const matiz = Math.round((i * 137.508) % 360);
    for (const turma of porEquivalencia.get(chaveDisciplina)) turma.matiz = matiz;
  });

  return {
    oferta,
    porId,
    porEquivalencia,
    turma: (id) => porId.get(id) || null,
    /** As outras ofertas da mesma disciplina — o coração do cross-curso. */
    alternativas: (turma) => (porEquivalencia.get(turma.equivalencia) || []).filter((t) => t.id !== turma.id),
  };
}

/* ------------------------------------------------------------
   choque de horário
   ------------------------------------------------------------ */

/** Dois intervalos se sobrepõem quando um começa antes do outro acabar. */
function sobrepoe(a, b) {
  return a.dia && b.dia && a.dia === b.dia && a.inicio < b.fim && b.inicio < a.fim;
}

/**
 * Todos os choques entre uma turma e as turmas já escolhidas.
 * Compara minuto a minuto, não bloco a bloco: aula de 3 horas que
 * cobre dois blocos choca com qualquer coisa dentro dela.
 */
export function choques(turma, escolhidas) {
  const achados = [];
  for (const outra of escolhidas) {
    if (outra.id === turma.id) continue;
    for (const a of turma.encontros) {
      for (const b of outra.encontros) {
        if (sobrepoe(a, b)) achados.push({ turma: outra, dia: a.dia, inicio: Math.max(a.inicio, b.inicio), fim: Math.min(a.fim, b.fim) });
      }
    }
  }
  return achados;
}

/** Os choques que já existem dentro da grade montada, um por par. */
export function paresEmChoque(escolhidas) {
  const pares = [];
  for (let i = 0; i < escolhidas.length; i++) {
    for (let j = i + 1; j < escolhidas.length; j++) {
      const achados = choques(escolhidas[i], [escolhidas[j]]);
      if (achados.length) pares.push(Object.assign({ a: escolhidas[i], b: escolhidas[j] }, achados[0]));
    }
  }
  return pares;
}

/**
 * O parecer antes de incluir. Nada é proibido em silêncio: a página
 * mostra o motivo e deixa o aluno insistir, porque plano de matrícula
 * costuma passar por cenários que não fecham.
 */
export function avaliar(turma, escolhidas) {
  const conflitos = choques(turma, escolhidas);
  const equivalente = escolhidas.find((t) => t.id !== turma.id && t.equivalencia === turma.equivalencia) || null;

  let gravidade = 'ok';
  if (conflitos.length) gravidade = 'choque';
  else if (equivalente) gravidade = 'duplicada';

  return { turma, conflitos, equivalente, gravidade, livre: gravidade === 'ok' };
}

/* ------------------------------------------------------------
   grade
   ------------------------------------------------------------ */

/**
 * Monta o mapa "dia|bloco -> aulas ali dentro", que é o que a tela desenha.
 * Um encontro entra em todo bloco que ele cruza, então aula fora da régua
 * de horários padrão continua aparecendo.
 */
export function montarMapa(oferta, escolhidas) {
  const mapa = new Map();
  const conflitantes = new Set();

  for (const turma of escolhidas) {
    for (const outra of escolhidas) {
      if (turma.id >= outra.id) continue;
      for (const a of turma.encontros) {
        for (const b of outra.encontros) {
          if (!sobrepoe(a, b)) continue;
          conflitantes.add(turma.id);
          conflitantes.add(outra.id);
        }
      }
    }
  }

  for (const turma of escolhidas) {
    for (const encontro of turma.encontros) {
      if (!encontro.dia) continue;
      for (const bloco of oferta.blocos) {
        if (encontro.inicio >= bloco.fim || bloco.inicio >= encontro.fim) continue;
        const chave = encontro.dia + '|' + bloco.id;
        if (!mapa.has(chave)) mapa.set(chave, []);
        mapa.get(chave).push({ turma, encontro, conflito: conflitantes.has(turma.id) });
      }
    }
  }

  /* dentro da célula, quem choca aparece primeiro: o aviso não pode
     depender de o aluno rolar a lista da célula */
  for (const itens of mapa.values()) {
    itens.sort((x, y) => (y.conflito ? 1 : 0) - (x.conflito ? 1 : 0));
  }

  return { celulas: mapa, conflitantes };
}

/* ------------------------------------------------------------
   carga
   ------------------------------------------------------------ */

export function resumo(escolhidas) {
  const minutos = escolhidas.reduce((soma, t) => soma + t.minutos, 0);
  const porDia = DIAS.map((dia) => ({
    dia,
    minutos: escolhidas.reduce(
      (soma, t) => soma + t.encontros.reduce((s, e) => s + (e.dia === dia ? e.fim - e.inicio : 0), 0),
      0,
    ),
  }));

  return {
    turmas: escolhidas.length,
    disciplinas: new Set(escolhidas.map((t) => t.equivalencia)).size,
    minutos,
    aulas: Math.round(minutos / AULA_MIN),
    horas: minutos / 60,
    ead: escolhidas.filter((t) => t.ead).length,
    porDia,
    diasOcupados: porDia.filter((d) => d.minutos > 0).length,
  };
}

/** 1,67 -> "1h40" — carga semanal se lê melhor em horas e minutos. */
export function horaTexto(horas) {
  const total = Math.round(horas * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return m + 'min';
  return m ? h + 'h' + String(m).padStart(2, '0') : h + 'h';
}
