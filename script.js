/* ============================================================
   HELP CIMATEC — calculadoras acadêmicas
   ============================================================ */

/* ---------- helpers ---------- */

/** 8.25 -> "8,3" (pt-BR decimal) */
function fmt(n, casas) {
  return n.toFixed(casas === undefined ? 1 : casas).replace('.', ',');
}

function pct(value, max) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function plural(n, um, muitos) {
  return n === 1 ? um : muitos;
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

  return '' +
    '<div class="regua">' +
      '<div class="regua-track">' +
        zones +
        '<span class="regua-ticks" style="--minor:' + cfg.minor + '%;--major:' + cfg.major + '%"></span>' +
        cuts +
        '<span class="regua-marker" style="--marker:0%"><b>' + cfg.marker.label + '</b></span>' +
      '</div>' +
      '<div class="regua-axis">' + axis + '</div>' +
    '</div>';
}

/** Reveal a readout and let the marker travel to its value. */
function mostrar(el, html, markerAt) {
  el.innerHTML = html;
  el.hidden = false;

  if (markerAt !== undefined) {
    var marker = el.querySelector('.regua-marker');
    if (marker) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          marker.style.setProperty('--marker', markerAt + '%');
        });
      });
    }
  }
}

function erro(el, mensagem) {
  el.innerHTML = '<p class="error">' + mensagem + '</p>';
  el.hidden = false;
}

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

  botao.addEventListener('click', function () {
    var notas = [];
    var faltando = [];

    PESOS.forEach(function (p) {
      var bruto = parseFloat(document.getElementById(p.id).value);
      if (isNaN(bruto)) {
        faltando.push(p.nome);
        notas.push(null);
      } else {
        notas.push(Math.max(0, Math.min(10, bruto)));
      }
    });

    if (faltando.length) {
      erro(saida, 'Falta preencher ' + faltando.join(', ') + '. Coloque uma nota de 0 a 10 em cada campo.');
      return;
    }

    var ag = notas.reduce(function (soma, nota, i) {
      return soma + nota * PESOS[i].peso;
    }, 0) / 100;
    var agRedondo = Math.round(ag * 10) / 10;

    var estado = ag >= 7 ? 'pass' : (ag >= 3 ? 'warn' : 'fail');
    var rotulo = { pass: 'Aprovado', warn: 'Você vai para a Final', fail: 'Reprovado' }[estado];

    var linhas = PESOS.map(function (p, i) {
      return '<tr><td>' + p.nome + '</td><td>' + fmt(notas[i]) + '</td><td>' + p.peso + '%</td>' +
             '<td>' + fmt(notas[i] * p.peso / 100, 2) + '</td></tr>';
    }).join('');

    var html =
      '<div class="verdict">' +
        '<span class="verdict-value is-' + estado + '">' + fmt(agRedondo) + '</span>' +
        '<span class="verdict-label">Média do semestre (AG)</span>' +
      '</div>' +
      '<span class="tag is-' + estado + '">' + rotulo + '</span>' +

      regua({
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
        ],
        marker: { label: fmt(agRedondo) }
      });

    if (estado === 'pass') {
      html += '<p class="readout-note">Sua média ficou <strong>' + fmt(agRedondo) +
              '</strong>, acima do corte de 7,0. Não precisa fazer Avaliação Final nesta disciplina.</p>';
    } else if (estado === 'warn') {
      var af = Math.round(((50 - 6 * agRedondo) / 4) * 10) / 10;
      html +=
        '<p class="readout-note">Com AG de <strong>' + fmt(agRedondo) +
        '</strong> você faz a Avaliação Final. Veja quanto precisa tirar nela:</p>' +
        '<dl class="readout-split">' +
          '<div class="stat"><dt>Precisa na Final</dt><dd>' + fmt(af) + '</dd></div>' +
          '<div class="stat"><dt>Falta para o 7,0</dt><dd>' + fmt(7 - agRedondo) + '</dd></div>' +
        '</dl>' +
        '<span class="formula">nota na AF = (50 − 6 × ' + fmt(agRedondo) + ') ÷ 4 = ' + fmt(af) + '</span>';
    } else {
      html += '<p class="readout-note">A média ficou abaixo de 3,0, então não há direito à Avaliação Final. ' +
              'Faltaram <strong>' + fmt(3 - agRedondo) + '</strong> pontos só para alcançar a Final.</p>';
    }

    html +=
      '<table class="breakdown">' +
        '<thead><tr><th>Avaliação</th><th>Nota</th><th>Peso</th><th>Contribuição</th></tr></thead>' +
        '<tbody>' + linhas + '</tbody>' +
        '<tfoot><tr><td>AG</td><td></td><td>100%</td><td>' + fmt(ag, 2) + '</td></tr></tfoot>' +
      '</table>';

    mostrar(saida, html, pct(agRedondo, 10));
  });
})();

/* ============================================================
   CALCULADORA 2 — saldo de faltas
   1 dia letivo = 2 aulas de 50 min = 100 min
   Presença mínima de 75%, logo o saldo é 25% dos dias letivos
   ============================================================ */
(function () {
  var botao = document.getElementById('btnCalcularFaltas');
  var carga = document.getElementById('cargaHoraria');
  var atuais = document.getElementById('faltasAtuais');
  var saida = document.getElementById('resultadoFaltas');
  if (!botao || !saida) return;

  botao.addEventListener('click', function () {
    var horas = parseFloat(carga.value);
    var faltas = parseInt(atuais.value, 10) || 0;

    if (!horas || horas <= 0) {
      erro(saida, 'Escolha a carga horária da disciplina para calcular o saldo.');
      return;
    }
    if (faltas < 0) {
      erro(saida, 'O número de faltas não pode ser negativo.');
      return;
    }

    var totalDias = (horas * 60) / 100;
    var diasLetivos = Math.floor(totalDias);
    var limite = Math.floor(totalDias * 0.25);
    var restantes = Math.max(0, limite - faltas);
    var presenca = Math.max(0, 100 - (faltas / totalDias) * 100);

    var estourou = faltas > limite;
    var estado = estourou ? 'fail' : (restantes <= 2 ? 'warn' : 'pass');
    var rotulo = estourou
      ? 'Reprovado por falta'
      : (restantes === 0 ? 'No limite — não pode mais faltar'
                         : (restantes <= 2 ? 'No limite' : 'Dentro do permitido'));

    /* one mark per allowed absence — countable, like a tally in a notebook */
    var marcas = '';
    for (var i = 0; i < limite; i++) {
      var classe = estourou ? 'over' : (i < faltas ? 'used' : '');
      marcas += '<i class="' + classe + '" style="--i:' + i + '"></i>';
    }

    var valor = estourou ? fmt(faltas - limite, 0) : fmt(restantes, 0);
    var unidade = estourou
      ? plural(faltas - limite, 'dia acima do limite', 'dias acima do limite')
      : plural(restantes, 'dia ainda disponível', 'dias ainda disponíveis');

    var html =
      '<div class="verdict">' +
        '<span class="verdict-value is-' + estado + '">' + valor + '</span>' +
        '<span class="verdict-label">' + unidade + '</span>' +
      '</div>' +
      '<span class="tag is-' + estado + '">' + rotulo + '</span>' +

      '<div class="tally">' +
        '<p class="readout-note">Seu saldo de faltas nesta disciplina, um traço por dia:</p>' +
        '<div class="tally-marks">' + marcas + '</div>' +
      '</div>' +

      '<dl class="readout-split">' +
        '<div class="stat"><dt>Dias letivos</dt><dd>' + diasLetivos + '</dd></div>' +
        '<div class="stat"><dt>Limite de faltas</dt><dd>' + limite + '</dd></div>' +
        '<div class="stat"><dt>Já faltou</dt><dd>' + faltas + '</dd></div>' +
        '<div class="stat"><dt>Presença atual</dt><dd>' + fmt(presenca) + '%</dd></div>' +
      '</dl>';

    if (estourou) {
      html += '<p class="readout-note">Você passou do limite de <strong>' + limite + ' ' +
              plural(limite, 'dia', 'dias') + '</strong> e sua presença caiu para <strong>' +
              fmt(presenca) + '%</strong>, abaixo dos 75% exigidos. Procure a coordenação para saber o que ainda dá para fazer.</p>';
    } else {
      html += '<p class="readout-note">De <strong>' + diasLetivos + ' dias letivos</strong>, você pode faltar até <strong>' +
              limite + '</strong> e ainda manter os 75% de presença.</p>';
    }

    html += '<span class="formula">' + horas + 'h × 60 ÷ 100 = ' + diasLetivos +
            ' dias · 25% = ' + limite + ' faltas</span>';

    mostrar(saida, html);
  });
})();
