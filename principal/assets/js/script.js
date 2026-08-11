/* ============================================================
   HELP CIMATEC — calculadoras acadêmicas
   ============================================================ */

/* ---------- helpers ---------- */

/** 8.25 -> "8,3" (pt-BR decimal) */
function fmt(n, casas) {
  return n.toFixed(casas === undefined ? 1 : casas).replace('.', ',');
}

/** 4 -> "4", 4.5 -> "4,5" */
function qtd(n) {
  return n % 1 === 0 ? String(n) : fmt(n, 1);
}

function pct(value, max) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function plural(n, um, muitos) {
  return n === 1 ? um : muitos;
}

/** ["AV2","AV3","EDAG"] -> "AV2, AV3 e EDAG" */
function listar(itens) {
  if (itens.length <= 1) return itens.join('');
  return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
}

/**
 * A régua: the page's instrument. Zones are the regulation's bands,
 * cuts are the thresholds it defines, the marker is where you landed.
 */
function regua(cfg) {
  var zones = (cfg.zones || []).map(function (z) {
    return '<span class="regua-zone ' + z.cls + '" style="--from:' + z.from + '%;--to:' + z.to + '%"></span>';
  }).join('');

  var cuts = (cfg.cuts || []).map(function (c) {
    return '<span class="regua-cut" style="--at:' + c.at + '%"><b>' + c.label + '</b></span>';
  }).join('');

  var axis = (cfg.axis || []).map(function (a) {
    return '<span style="--at:' + a.at + '%">' + a.label + '</span>';
  }).join('');

  var faixa = cfg.faixa
    ? '<span class="regua-faixa" style="--from:' + cfg.faixa.from + '%;--to:' + cfg.faixa.to + '%"></span>'
    : '';

  return '' +
    '<div class="regua">' +
      '<div class="regua-track">' +
        zones +
        '<span class="regua-ticks" style="--minor:' + cfg.minor + '%;--major:' + cfg.major + '%"></span>' +
        faixa +
        cuts +
        '<span class="regua-marker" style="--marker:0%"><b>' + cfg.marker.label + '</b></span>' +
      '</div>' +
      '<div class="regua-axis">' + axis + '</div>' +
    '</div>';
}

/** Waits for typing to settle before recalculating. */
function debounce(fn, ms) {
  var t;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

/**
 * Reveal a readout and let the marker travel to its value.
 * While typing (aoVivo) the entry animations are skipped — replaying them
 * on every keystroke reads as flicker, not as feedback.
 */
function mostrar(el, html, markerAt, aoVivo) {
  el.innerHTML = html;
  el.hidden = false;
  el.classList.toggle('ao-vivo', !!aoVivo);

  if (markerAt === undefined) return;

  var marker = el.querySelector('.regua-marker');
  if (!marker) return;

  if (aoVivo) {
    marker.style.setProperty('--marker', markerAt + '%');
  } else {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        marker.style.setProperty('--marker', markerAt + '%');
      });
    });
  }
}

function erro(el, mensagem) {
  el.innerHTML = '<p class="error">' + mensagem + '</p>';
  el.hidden = false;
}

/* ---------- tema claro / escuro ----------
   O tema já foi resolvido por um script no <head>, antes da primeira
   pintura. Aqui só ficam a troca manual e o acompanhamento do sistema
   enquanto o visitante não escolheu nada. */
(function () {
  var CHAVE = 'help-cimatec-tema';
  var raiz = document.documentElement;
  var botao = document.getElementById('temaToggle');

  function ler() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }

  function aplicar(tema) {
    raiz.setAttribute('data-tema', tema);
    if (botao) {
      botao.setAttribute('aria-label', tema === 'escuro'
        ? 'Mudar para o tema claro'
        : 'Mudar para o tema escuro');
    }
  }

  aplicar(raiz.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro');

  if (botao) {
    botao.addEventListener('click', function () {
      var novo = raiz.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
      aplicar(novo);
      try { localStorage.setItem(CHAVE, novo); } catch (e) { /* segue só nesta sessão */ }
    });
  }

  /* sem escolha salva, o site continua seguindo o tema do sistema */
  if (window.matchMedia) {
    var consulta = window.matchMedia('(prefers-color-scheme: dark)');
    var aoMudarSistema = function (e) {
      if (ler()) return;
      aplicar(e.matches ? 'escuro' : 'claro');
    };
    if (consulta.addEventListener) consulta.addEventListener('change', aoMudarSistema);
    else if (consulta.addListener) consulta.addListener(aoMudarSistema);
  }
})();

/* ---------- navbar ---------- */
(function () {
  var nav = document.querySelector('nav');
  if (!nav) return;

  var onScroll = function () {
    nav.classList.toggle('scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var hamburger = nav.querySelector('.hamburger');
  var menu = nav.querySelector('.mobile-menu');
  if (!hamburger || !menu) return;

  hamburger.addEventListener('click', function () {
    var open = menu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });

  menu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      menu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', 'Abrir menu');
    });
  });
})();

/* ---------- resource modals (wifi / iniciativas / guia do calouro) ---------- */
(function () {
  function fecharComOverflow(modal) {
    modal.close();
  }

  document.querySelectorAll('[data-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var modal = document.getElementById(btn.getAttribute('data-modal'));
      if (!modal) return;
      modal.showModal();
      document.body.style.overflow = 'hidden';
    });
  });

  document.querySelectorAll('.modal').forEach(function (modal) {
    var closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { fecharComOverflow(modal); });

    /* Clicar no backdrop fecha. O alvo é o teste, não a coordenada: os
       filhos cobrem o dialog inteiro, então só um clique no backdrop tem
       o próprio dialog como target. Comparar coordenadas fecharia o modal
       ao acionar qualquer botão de dentro pelo teclado, porque Enter e
       Espaço geram um clique em 0,0. */
    modal.addEventListener('click', function (e) {
      if (e.target === modal) fecharComOverflow(modal);
    });

    modal.addEventListener('close', function () {
      document.body.style.overflow = '';
    });
  });
})();

/* ---------- logos das iniciativas ----------
   O slot nasce mostrando a sigla. A logo só toma o lugar dela depois de
   carregar, então basta soltar o arquivo em assets/img/iniciativas/ para
   a marca aparecer — e uma que ainda não existe não quebra nada. */
(function () {
  document.querySelectorAll('.iniciativa-logo').forEach(function (slot) {
    var img = slot.querySelector('img');
    if (!img) return;

    function mostrar() { slot.classList.add('tem-logo'); }

    /* imagens em cache podem terminar antes deste script rodar */
    if (img.complete) {
      if (img.naturalWidth > 0) mostrar();
      return;
    }
    img.addEventListener('load', mostrar);
  });
})();

/* ---------- wifi: copiar a senha ----------
   O rótulo do botão é a própria confirmação: vira "Copiado" e, por ser
   aria-live, o leitor de tela anuncia a mesma coisa que a tela mostra.
   min-width no CSS segura a largura para o botão não pular na troca. */
(function () {
  document.querySelectorAll('.wifi-key').forEach(function (botao) {
    var senha = botao.getAttribute('data-senha');
    var rotulo = botao.querySelector('.wifi-key-rotulo');
    if (!senha || !rotulo) return;

    var original = rotulo.textContent;
    var volta;

    botao.addEventListener('click', function () {
      copiar(senha, botao, function (ok) {
        /* só confirma o que de fato aconteceu: dizer "Copiado" sem ter
           copiado só seria descoberto na hora de digitar a senha */
        if (!ok) return;
        botao.classList.add('copiado');
        rotulo.textContent = 'Copiado';
        clearTimeout(volta);
        volta = setTimeout(function () {
          botao.classList.remove('copiado');
          rotulo.textContent = original;
        }, 1800);
      });
    });
  });

  /* a Clipboard API exige contexto seguro e a aba em foco — sem foco ela
     rejeita, e é aí que o textarea escondido assume. Ele também cobre
     http:// e file://, onde a API simplesmente não existe. */
  function copiar(texto, botao, aoTerminar) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(function () {
        aoTerminar(true);
      }).catch(function () {
        aoTerminar(legado(texto, botao));
      });
      return;
    }
    aoTerminar(legado(texto, botao));
  }

  /* o textarea entra no <dialog> aberto, não no body: com um modal na tela
     todo o resto da página fica inerte e um campo lá fora não seleciona */
  function legado(texto, botao) {
    var ancora = botao.closest('dialog') || document.body;
    var area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.opacity = '0';
    ancora.appendChild(area);
    area.select();

    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ancora.removeChild(area);
    return ok;
  }
})();

/* ---------- guia do estudante: abas recolhíveis ---------- */
(function () {
  var guia = document.getElementById('modalGuiaEstudante');
  if (!guia) return;

  var itens = guia.querySelectorAll('.guia-item');

  /* abrir um tópico no fim da lista deixaria o texto fora da tela.
     Rolar a aba inteira resolve os dois casos: se o conteúdo couber,
     o navegador rola o mínimo; se for mais alto que o modal, ele
     encosta o título no topo e o texto começa logo abaixo. */
  itens.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) item.scrollIntoView({ block: 'nearest' });
    });
  });

  /* fechar o guia devolve a lista ao estado de índice */
  guia.addEventListener('close', function () {
    itens.forEach(function (item) { item.open = false; });
  });
})();

/* ---------- scroll reveal ---------- */
(function () {
  var targets = document.querySelectorAll('main .reveal, .regras.reveal');
  if (!('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('visible'); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px' });

  targets.forEach(function (el) { observer.observe(el); });
})();

/* ---------- number steppers ---------- */
(function () {
  document.querySelectorAll('.step').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = btn.closest('.stepper').querySelector('input');
      if (!input) return;

      var step = parseFloat(input.step) || 1;
      var min = parseFloat(input.min);
      var max = parseFloat(input.max);
      var val = parseFloat(input.value) || 0;

      val += (btn.getAttribute('data-dir') === 'up' ? step : -step);

      if (!isNaN(min) && val < min) val = min;
      if (!isNaN(max) && val > max) val = max;

      input.value = Math.round(val * 10) / 10;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
})();

/* ---------- Enter submits the panel it belongs to ---------- */
(function () {
  document.querySelectorAll('.panel').forEach(function (panel) {
    var botao = panel.querySelector('.btn-block');
    if (!botao) return;
    panel.querySelectorAll('input, select').forEach(function (campo) {
      campo.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          botao.click();
        }
      });
    });
  });
})();

/* ============================================================
   CALCULADORA 1 — Passei CIMATEC?
   AG = (AV1·25 + AV2·25 + AV3·30 + EDAG·20) / 100
   AG >= 7,0 aprovado · 3,0 a 7,0 vai pra Final · < 3,0 reprovado
   ============================================================ */
(function () {
  var botao = document.getElementById('btnCalcularMedia');
  var saida = document.getElementById('resultadoMedia');
  if (!botao || !saida) return;

  var PESOS = [
    { id: 'notaAV1', nome: 'AV1', peso: 25 },
    { id: 'notaAV2', nome: 'AV2', peso: 25 },
    { id: 'notaAV3', nome: 'AV3', peso: 30 },
    { id: 'notaEDAG', nome: 'EDAG', peso: 20 }
  ];

  /* the weighting bar above each field fills in as its nota gets typed */
  var pesosEls = document.querySelectorAll('.pesos span');
  function atualizarPesosPreenchidos() {
    PESOS.forEach(function (p, i) {
      if (!pesosEls[i]) return;
      var valor = document.getElementById(p.id).value;
      pesosEls[i].classList.toggle('is-filled', valor !== '');
    });
  }
  PESOS.forEach(function (p) {
    document.getElementById(p.id).addEventListener('input', atualizarPesosPreenchidos);
  });

  /* o que está fora de 0–10 não é nota: o valor volta cru daqui para o
     cálculo poder recusá-lo, em vez de encaixá-lo na faixa em silêncio e
     mostrar uma média que discorda do campo preenchido */
  function lerNotas() {
    return PESOS.map(function (p) {
      var bruto = parseFloat(document.getElementById(p.id).value);
      return isNaN(bruto) ? null : bruto;
    });
  }

  function calcular(aoVivo) {
    var notas = lerNotas();
    var faltando = PESOS.filter(function (p, i) { return notas[i] === null; });

    var invalidas = PESOS.filter(function (p, i) {
      return notas[i] !== null && (notas[i] < 0 || notas[i] > 10);
    });
    if (invalidas.length) {
      var nomesInvalidas = listar(invalidas.map(function (p) { return p.nome; }));
      erro(saida, 'A nota de ' + nomesInvalidas + ' ' +
        plural(invalidas.length, 'precisa', 'precisam') + ' estar entre 0 e 10.');
      return;
    }

    var preenchidas = PESOS.filter(function (p, i) { return notas[i] !== null; });

    if (!preenchidas.length) {
      /* while typing, an empty form is just an empty form — not an error */
      if (aoVivo) { saida.hidden = true; return; }
      erro(saida, 'Preencha pelo menos uma nota para calcular.');
      return;
    }

    var pontos = notas.reduce(function (soma, nota, i) {
      return soma + (nota === null ? 0 : nota * PESOS[i].peso);
    }, 0);
    var pesoFeito = preenchidas.reduce(function (s, p) { return s + p.peso; }, 0);
    var pesoRestante = 100 - pesoFeito;

    function tabela(rodape) {
      var linhas = PESOS.map(function (p, i) {
        var vazia = notas[i] === null;
        return '<tr>' +
                 '<td class="c-nome">' + p.nome + '<span class="td-peso">' + p.peso + '%</span></td>' +
                 '<td class="c-nota">' + (vazia ? '—' : fmt(notas[i])) + '</td>' +
                 '<td class="c-peso">' + p.peso + '%</td>' +
                 '<td class="c-pts">' + (vazia ? '—' : fmt(notas[i] * p.peso / 100, 2)) + '</td>' +
               '</tr>';
      }).join('');

      return '<table class="breakdown">' +
               '<thead><tr>' +
                 '<th class="c-nome">Avaliação</th><th class="c-nota">Nota</th>' +
                 '<th class="c-peso">Peso</th><th class="c-pts">Contribuição</th>' +
               '</tr></thead>' +
               '<tbody>' + linhas + '</tbody>' +
               '<tfoot>' + rodape + '</tfoot>' +
             '</table>';
    }

    var reguaBase = {
      minor: 5,
      major: 10,
      zones: [
        { cls: 'zone-fail', from: 0, to: 30 },
        { cls: 'zone-warn', from: 30, to: 70 },
        { cls: 'zone-pass', from: 70, to: 100 }
      ],
      cuts: [{ at: 30, label: '3,0' }, { at: 70, label: '7,0' }],
      axis: [
        { at: 0, label: '0' }, { at: 20, label: '2' }, { at: 40, label: '4' },
        { at: 60, label: '6' }, { at: 80, label: '8' }, { at: 100, label: '10' }
      ]
    };

    /* ---- partial: some avaliações haven't happened yet ---- */
    if (pesoRestante > 0) {
      var parcial = Math.round((pontos / pesoFeito) * 10) / 10;
      var minimo = Math.round((pontos / 100) * 10) / 10;
      var maximo = Math.round(((pontos + 10 * pesoRestante) / 100) * 10) / 10;
      var precisa = (700 - pontos) / pesoRestante;
      var nomesFalta = listar(faltando.map(function (p) { return p.nome; }));

      var cfg = Object.assign({}, reguaBase, {
        faixa: { from: pct(minimo, 10), to: pct(maximo, 10) },
        marker: { label: fmt(parcial) }
      });

      var htmlP =
        '<div class="verdict">' +
          '<span class="verdict-value is-info">' + fmt(parcial) + '</span>' +
          '<span class="verdict-label">Média parcial · ' + pesoFeito + '% do semestre</span>' +
        '</div>' +
        '<span class="tag is-info">Ainda falta ' + nomesFalta + '</span>' +
        regua(cfg) +
        '<p class="readout-note">A faixa hachurada é onde sua média final ainda pode cair: ' +
          '<strong>' + fmt(minimo) + '</strong> se você zerar ' + nomesFalta +
          ', <strong>' + fmt(maximo) + '</strong> se tirar 10.</p>';

      /* one card per pending avaliação, each with its own weight and target —
         rounded up, because 7,4 would land just under the line */
      function alvos(precisaBruto) {
        var nota = Math.min(10, Math.ceil(precisaBruto * 10) / 10);
        return '<div class="alvos">' + faltando.map(function (p) {
          return '<div class="alvo">' +
                   '<p class="alvo-nome">' + p.nome + ' <span>' + p.peso + '%</span></p>' +
                   '<p class="alvo-nota">' + fmt(nota) + '</p>' +
                 '</div>';
        }).join('') + '</div>';
      }

      var trocaJusta = faltando.length > 1
        ? ' Tirando mais em uma, dá para tirar menos na outra — o que conta é o peso somado.'
        : '';

      if (precisa <= 0) {
        htmlP += '<div class="af">' +
                   '<p class="af-label">Situação</p>' +
                   '<p class="af-value">7,0</p>' +
                   '<p class="af-note">já está garantido, mesmo zerando ' + nomesFalta + '</p>' +
                 '</div>';
      } else if (precisa <= 10) {
        htmlP += '<div class="af">' +
                   '<p class="af-label">Nota mínima em cada avaliação para fechar em 7,0</p>' +
                   alvos(precisa) +
                   '<p class="af-note">Esse é o mínimo em ' + nomesFalta + '.' + trocaJusta + '</p>' +
                 '</div>';
      } else {
        var paraFinal = (300 - pontos) / pesoRestante;
        if (paraFinal <= 0) {
          htmlP += '<div class="af">' +
                     '<p class="af-label">Situação</p>' +
                     '<p class="af-value">Final</p>' +
                     '<p class="af-note">a Final já está garantida, o 7,0 não é mais alcançável</p>' +
                   '</div>';
        } else if (paraFinal <= 10) {
          htmlP += '<div class="af">' +
                     '<p class="af-label">O 7,0 não é mais alcançável. Mínimo para chegar na Final</p>' +
                     alvos(paraFinal) +
                     '<p class="af-note">Abaixo disso é reprovação direta, sem direito à Final.' + trocaJusta + '</p>' +
                   '</div>';
        } else {
          htmlP += '<div class="af">' +
                     '<p class="af-label">Situação</p>' +
                     '<p class="af-value">—</p>' +
                     '<p class="af-note">nem com 10 em ' + nomesFalta + ' a média chega aos 3,0</p>' +
                   '</div>';
        }
      }

      htmlP += tabela('<tr><td class="c-nome">Parcial</td><td class="c-nota"></td>' +
                      '<td class="c-peso">' + pesoFeito + '%</td>' +
                      '<td class="c-pts">' + fmt(pontos / 100, 2) + '</td></tr>');

      mostrar(saida, htmlP, pct(parcial, 10), aoVivo);
      return;
    }

    /* ---- every nota is in: the real AG ---- */
    var ag = pontos / 100;
    var agRedondo = Math.round(ag * 10) / 10;

    /* the verdict follows the number on screen: a shown 7,0 is Aprovado */
    var estado = agRedondo >= 7 ? 'pass' : (agRedondo >= 3 ? 'warn' : 'fail');
    var rotulo = { pass: 'Aprovado', warn: 'Você vai para a Final', fail: 'Reprovado' }[estado];

    var html =
      '<div class="verdict">' +
        '<span class="verdict-value is-' + estado + '">' + fmt(agRedondo) + '</span>' +
        '<span class="verdict-label">Média do semestre (AG)</span>' +
      '</div>' +
      '<span class="tag is-' + estado + '">' + rotulo + '</span>' +
      regua(Object.assign({}, reguaBase, { marker: { label: fmt(agRedondo) } }));

    if (estado === 'pass') {
      html += '<p class="readout-note">Sua média ficou <strong>' + fmt(agRedondo) +
              '</strong> e alcançou o corte de 7,0. Não precisa fazer Avaliação Final nesta disciplina.</p>';
    } else if (estado === 'warn') {
      var af = Math.round(((50 - 6 * agRedondo) / 4) * 10) / 10;
      html +=
        '<p class="readout-note">Com AG de <strong>' + fmt(agRedondo) +
        '</strong> você faz a Avaliação Final.</p>' +
        '<div class="af">' +
          '<p class="af-label">Você precisa tirar na Avaliação Final</p>' +
          '<p class="af-value">' + fmt(af) + '</p>' +
          '<p class="af-note">Faltam ' + fmt(7 - agRedondo) + ' para o 7,0 · ' +
            '(50 − 6 × ' + fmt(agRedondo) + ') ÷ 4</p>' +
        '</div>';
    } else {
      html += '<p class="readout-note">A média ficou abaixo de 3,0, então não há direito à Avaliação Final. ' +
              'Faltaram <strong>' + fmt(3 - agRedondo) + '</strong> pontos só para alcançar a Final.</p>';
    }

    html += tabela('<tr><td class="c-nome">AG</td><td class="c-nota"></td>' +
                   '<td class="c-peso">100%</td>' +
                   '<td class="c-pts">' + fmt(ag, 2) + '</td></tr>');

    mostrar(saida, html, pct(agRedondo, 10), aoVivo);
  }

  /* the result follows what you type; the button stays for who prefers it */
  var aoDigitar = debounce(function () { calcular(true); }, 220);
  PESOS.forEach(function (p) {
    document.getElementById(p.id).addEventListener('input', aoDigitar);
  });
  botao.addEventListener('click', function () { calcular(false); });
})();

/* ============================================================
   CALCULADORA 2 — saldo de faltas
   1 aula = 50 min · 1 dia letivo = 2 aulas
   Presença mínima de 75%, logo o saldo é 25% das aulas
   ============================================================ */
(function () {
  var botao = document.getElementById('btnCalcularFaltas');
  var carga = document.getElementById('cargaHoraria');
  var atuais = document.getElementById('faltasAtuais');
  var saida = document.getElementById('resultadoFaltas');
  var labelFaltas = document.getElementById('labelFaltas');
  var segs = document.querySelectorAll('.seg');
  if (!botao || !saida) return;

  var AULA_MIN = 50;
  var AULAS_POR_DIA = 2;
  var unidade = 'dias';

  function nomeUnidade(n) {
    return unidade === 'dias' ? plural(n, 'dia', 'dias') : plural(n, 'falta', 'faltas');
  }

  /* ---- unit toggle ---- */
  segs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var anterior = unidade;
      unidade = btn.getAttribute('data-unit');
      if (anterior === unidade) return;

      /* convert what was typed so the toggle re-expresses the same
         situation instead of silently turning it into a different one */
      var valor = parseFloat(atuais.value);
      if (!isNaN(valor)) {
        /* going back to dias rounds up: 7 faltas ocupam 4 dias, nunca 3 */
        atuais.value = anterior === 'dias'
          ? valor * AULAS_POR_DIA
          : Math.ceil(valor / AULAS_POR_DIA);
      }

      segs.forEach(function (b) {
        var ligado = b === btn;
        b.classList.toggle('is-on', ligado);
        b.setAttribute('aria-checked', String(ligado));
      });

      labelFaltas.textContent = unidade === 'dias'
        ? 'Dias que você já faltou'
        : 'Faltas lançadas até agora';

      /* keep an open result in sync with the unit on screen */
      if (!saida.hidden) calcular();
    });
  });

  function calcular(aoVivo) {
    var horas = parseFloat(carga.value);
    var valor = parseFloat(atuais.value) || 0;

    if (!horas || horas <= 0) {
      erro(saida, 'Escolha a carga horária da disciplina para calcular o saldo.');
      return;
    }
    if (valor < 0) {
      erro(saida, 'O número de faltas não pode ser negativo.');
      return;
    }

    var totalAulas = Math.round((horas * 60) / AULA_MIN);
    var totalDias = totalAulas / AULAS_POR_DIA;
    var limiteAulas = Math.floor(totalAulas * 0.25);

    /* dias are indivisible: meio dia de falta não existe, então o limite
       em dias é arredondado para baixo (9 aulas = 4 dias, não 4,5) */
    var emDias = unidade === 'dias';
    var limiteUnit = emDias ? Math.floor(limiteAulas / AULAS_POR_DIA) : limiteAulas;
    var faltasUnit = emDias ? Math.round(valor) : valor;
    var restantesUnit = Math.max(0, limiteUnit - faltasUnit);
    var excedenteUnit = Math.max(0, faltasUnit - limiteUnit);

    var faltasAulas = emDias ? faltasUnit * AULAS_POR_DIA : faltasUnit;
    var presenca = Math.max(0, 100 - (faltasAulas / totalAulas) * 100);

    var estourou = faltasUnit > limiteUnit;
    /* two days' worth either way, so the warning fires at the same real point */
    var apertado = restantesUnit <= (emDias ? 2 : AULAS_POR_DIA * 2);
    var estado = estourou ? 'fail' : (apertado ? 'warn' : 'pass');
    var rotulo = estourou
      ? 'Reprovado por falta'
      : (restantesUnit === 0 ? 'No limite — não pode mais faltar'
                             : (apertado ? 'No limite' : 'Dentro do permitido'));

    var valorPrincipal = estourou ? excedenteUnit : restantesUnit;
    var legenda = estourou
      ? nomeUnidade(excedenteUnit) + ' acima do limite'
      : nomeUnidade(restantesUnit) + ' ainda ' + plural(restantesUnit, 'disponível', 'disponíveis');

    /* one mark per allowed unit — countable, like a tally in a notebook */
    var marcas = '';
    for (var i = 0; i < limiteUnit; i++) {
      marcas += '<i class="' + (estourou ? 'over' : ((i + 1) <= faltasUnit ? 'used' : '')) +
                '" style="--i:' + i + '"></i>';
    }

    var html =
      '<div class="verdict">' +
        '<span class="verdict-value is-' + estado + '">' + qtd(valorPrincipal) + '</span>' +
        '<span class="verdict-label">' + legenda + '</span>' +
      '</div>' +
      '<span class="tag is-' + estado + '">' + rotulo + '</span>' +

      '<div class="tally">' +
        '<p class="readout-note">Seu saldo nesta disciplina, um traço por ' +
          (unidade === 'dias' ? 'dia' : 'falta lançada') + ':</p>' +
        '<div class="tally-marks">' + marcas + '</div>' +
      '</div>' +

      '<dl class="readout-split">' +
        '<div class="stat"><dt>Dias letivos</dt><dd>' + qtd(totalDias) + '</dd></div>' +
        '<div class="stat"><dt>Aulas no total</dt><dd>' + totalAulas + '</dd></div>' +
        '<div class="stat"><dt>Limite de faltas</dt><dd>' + qtd(limiteUnit) + ' ' + nomeUnidade(limiteUnit) + '</dd></div>' +
        '<div class="stat"><dt>Já faltou</dt><dd>' + qtd(faltasUnit) + ' ' + nomeUnidade(faltasUnit) + '</dd></div>' +
        '<div class="stat"><dt>Presença atual</dt><dd>' + fmt(presenca) + '%</dd></div>' +
      '</dl>';

    if (estourou) {
      html += '<p class="readout-note">Você passou do limite de <strong>' + qtd(limiteUnit) + ' ' +
              nomeUnidade(limiteUnit) + '</strong> e sua presença caiu para <strong>' + fmt(presenca) +
              '%</strong>, abaixo dos 75% exigidos. Procure a coordenação para saber o que ainda dá para fazer.</p>';
    } else {
      html += '<p class="readout-note">De <strong>' + qtd(totalDias) + ' dias letivos</strong> (' + totalAulas +
              ' aulas), você pode faltar até <strong>' + qtd(limiteUnit) + ' ' + nomeUnidade(limiteUnit) +
              '</strong> e ainda manter os 75% de presença.</p>';
    }

    html += '<span class="formula">' + horas + 'h × 60 ÷ 50 = ' + totalAulas +
            ' aulas · 25% = ' + limiteAulas + ' faltas' +
            (emDias ? ' = ' + limiteUnit + ' ' + plural(limiteUnit, 'dia inteiro', 'dias inteiros') : '') +
            '</span>';

    mostrar(saida, html, undefined, aoVivo);
  }

  var aoDigitar = debounce(function () { calcular(true); }, 220);
  atuais.addEventListener('input', aoDigitar);
  carga.addEventListener('change', function () { calcular(true); });
  botao.addEventListener('click', function () { calcular(false); });
})();
