/* ============================================================
   ESTADO — a seleção do aluno e onde ela sobrevive

   A seleção é uma lista de ids de turma, e só. Tudo que a tela
   mostra (grade, resumo, avisos, PDF) é derivado dela, então
   fechar e reabrir a página só precisa devolver essa lista.

   Guardar: localStorage primeiro, porque sobrevive ao fechar a
   aba e não vai junto em toda requisição. Se o navegador bloquear
   storage (aba anônima com restrição, iframe de terceiro), a mesma
   lista cai num cookie de sessão. Um dos dois sempre existe.
   ============================================================ */

const CHAVE = 'help-cimatec-grade';
const VERSAO = 1;

/* ------------------------------------------------------------
   depósito
   ------------------------------------------------------------ */

function localOk() {
  try {
    localStorage.setItem(CHAVE + ':teste', '1');
    localStorage.removeItem(CHAVE + ':teste');
    return true;
  } catch (e) {
    return false;
  }
}

const cookie = {
  ler() {
    const achado = document.cookie.split('; ').find((c) => c.startsWith(CHAVE + '='));
    return achado ? decodeURIComponent(achado.slice(CHAVE.length + 1)) : null;
  },
  gravar(texto) {
    /* sem expires: morre com a sessão do navegador, como pede um rascunho */
    document.cookie = CHAVE + '=' + encodeURIComponent(texto) + '; path=/; SameSite=Lax';
  },
  apagar() {
    document.cookie = CHAVE + '=; path=/; Max-Age=0; SameSite=Lax';
  },
};

const deposito = localOk()
  ? {
    nome: 'localStorage',
    ler: () => localStorage.getItem(CHAVE),
    gravar: (texto) => { try { localStorage.setItem(CHAVE, texto); } catch (e) { cookie.gravar(texto); } },
    apagar: () => { try { localStorage.removeItem(CHAVE); } catch (e) { /* nada a fazer */ } },
  }
  : { nome: 'cookie de sessão', ler: cookie.ler, gravar: cookie.gravar, apagar: cookie.apagar };

export const ondeSalva = deposito.nome;

function gravar(dados) {
  try { deposito.gravar(JSON.stringify(dados)); } catch (e) { /* seguir só em memória */ }
}

function lerSalvo() {
  try {
    const bruto = deposito.ler();
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    return dados && dados.v === VERSAO && Array.isArray(dados.ids) ? dados : null;
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------
   estado
   ------------------------------------------------------------ */

/**
 * @param {object} indice   índice devolvido por regras.indexar()
 */
export function criarEstado(indice) {
  const ids = [];
  const ouvintes = [];
  let atual = indice;

  function turmas() {
    return ids.map((id) => atual.turma(id)).filter(Boolean);
  }

  function salvar() {
    gravar({
      v: VERSAO,
      oferta: (atual.oferta.curso || '') + '|' + (atual.oferta.periodo || ''),
      ids,
      em: new Date().toISOString(),
    });
  }

  function avisar(evento) {
    for (const fn of ouvintes) fn(evento || {});
  }

  function mudou(evento) {
    salvar();
    avisar(evento);
  }

  return {
    get indice() { return atual; },
    ids: () => ids.slice(),
    turmas,
    tem: (id) => ids.includes(id),

    adicionar(id) {
      if (!atual.turma(id) || ids.includes(id)) return false;
      ids.push(id);
      mudou({ tipo: 'adicionar', id });
      return true;
    },

    remover(id) {
      const i = ids.indexOf(id);
      if (i < 0) return false;
      ids.splice(i, 1);
      mudou({ tipo: 'remover', id });
      return true;
    },

    /** Troca uma turma pela equivalente sem passar por um estado inválido. */
    trocar(saiId, entraId) {
      const i = ids.indexOf(saiId);
      if (i < 0) return this.adicionar(entraId);
      ids.splice(i, 1, entraId);
      mudou({ tipo: 'trocar', id: entraId, anterior: saiId });
      return true;
    },

    limpar() {
      if (!ids.length) return;
      ids.length = 0;
      deposito.apagar();
      avisar({ tipo: 'limpar' });
    },

    /**
     * Restaura o que estava salvo. Ids que não existem mais na oferta
     * são descartados e devolvidos, para a página poder dizer que a
     * coordenação mudou o arquivo em vez de sumir com a turma calada.
     */
    restaurar(novoIndice) {
      if (novoIndice) atual = novoIndice;
      const salvo = lerSalvo();
      ids.length = 0;
      if (!salvo) return { restaurados: 0, perdidos: [] };

      const perdidos = [];
      for (const id of salvo.ids) {
        if (atual.turma(id)) ids.push(id);
        else perdidos.push(id);
      }
      avisar({ tipo: 'restaurar' });
      return { restaurados: ids.length, perdidos };
    },

    /** Troca a oferta (import de outro arquivo) e zera a seleção. */
    trocarOferta(novoIndice) {
      atual = novoIndice;
      ids.length = 0;
      deposito.apagar();
      avisar({ tipo: 'oferta' });
    },

    /**
     * Troca a oferta mantendo a seleção. Só serve para quando a oferta
     * nova contém a antiga — somar um segundo arquivo, por exemplo:
     * ali os ids continuam apontando para as mesmas turmas, e zerar a
     * grade seria castigar quem só quis completar o catálogo.
     */
    manterSelecao(novoIndice) {
      atual = novoIndice;
      const perdidos = ids.filter((id) => !atual.turma(id));
      for (const id of perdidos) ids.splice(ids.indexOf(id), 1);
      salvar();
      avisar({ tipo: 'oferta' });
      return { restaurados: ids.length, perdidos };
    },

    ao(fn) { ouvintes.push(fn); return () => ouvintes.splice(ouvintes.indexOf(fn), 1); },
  };
}
