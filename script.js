/* ---- SCROLL ANIMATIONS ---- */
(function() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(function(el) {
    observer.observe(el);
  });
})();

/* ---- NAVBAR SCROLL ---- */
(function() {
  var nav = document.querySelector('nav');
  if (!nav) return;
  window.addEventListener('scroll', function() {
    if (window.scrollY > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
})();

/* ---- HAMBURGER MENU ---- */
(function() {
  var hamburger = document.querySelector('.hamburger');
  var mobileMenu = document.querySelector('.mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', function() {
    mobileMenu.classList.toggle('open');
  });

  mobileMenu.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', function() {
      mobileMenu.classList.remove('open');
    });
  });
})();

/* ---- NUMBER INPUT BUTTONS ---- */
(function() {
  document.querySelectorAll('.tool-number-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var wrap = btn.closest('.tool-number-wrap');
      var input = wrap.querySelector('input[type="number"]');
      if (!input) return;
      var step = parseFloat(input.step) || 1;
      var min = parseFloat(input.min);
      var max = parseFloat(input.max);
      var val = parseFloat(input.value) || 0;
      var dir = btn.getAttribute('data-dir');

      if (dir === 'up') {
        val = val + step;
      } else {
        val = val - step;
      }

      if (!isNaN(min) && val < min) val = min;
      if (!isNaN(max) && val > max) val = max;

      input.value = Math.round(val * 10) / 10;
    });
  });
})();

/* ---- CALCULADORA DE MEDIA ---- */
(function() {
  var btnCalcular = document.getElementById('btnCalcularMedia');
  var resultado = document.getElementById('resultadoMedia');

  if (!btnCalcular) return;

  btnCalcular.addEventListener('click', function() {
    var av1Input = document.getElementById('notaAV1');
    var av2Input = document.getElementById('notaAV2');
    var av3Input = document.getElementById('notaAV3');
    var edagInput = document.getElementById('notaEDAG');

    var av1 = parseFloat(av1Input.value);
    var av2 = parseFloat(av2Input.value);
    var av3 = parseFloat(av3Input.value);
    var edag = parseFloat(edagInput.value);

    if (isNaN(av1) || isNaN(av2) || isNaN(av3) || isNaN(edag)) {
      resultado.style.display = 'block';
      resultado.innerHTML = '<div class="result-title">Erro</div><div class="result-detail">Preencha todas as notas antes de calcular.</div>';
      return;
    }

    av1 = Math.max(0, Math.min(10, av1));
    av2 = Math.max(0, Math.min(10, av2));
    av3 = Math.max(0, Math.min(10, av3));
    edag = Math.max(0, Math.min(10, edag));

    var ag = (av1 * 25 + av2 * 25 + av3 * 30 + edag * 20) / 100;
    var agArredondado = Math.round(ag * 10) / 10;

    var tabela =
      '<table class="result-table">' +
        '<thead><tr><th>Avaliação</th><th>Nota</th><th>Peso (%)</th></tr></thead>' +
        '<tbody>' +
          '<tr><td>AV1</td><td>' + av1.toFixed(1) + '</td><td>25%</td></tr>' +
          '<tr><td>AV2</td><td>' + av2.toFixed(1) + '</td><td>25%</td></tr>' +
          '<tr><td>AV3</td><td>' + av3.toFixed(1) + '</td><td>30%</td></tr>' +
          '<tr><td>EDAG</td><td>' + edag.toFixed(1) + '</td><td>20%</td></tr>' +
        '</tbody>' +
      '</table>';

    var explicacao = '<div class="result-detail">A média do semestre é calculada considerando os pesos de cada avaliação: somatório das notas multiplicadas pelos pesos, dividido por 100.</div>';

    resultado.style.display = 'block';

    if (ag >= 7) {
      resultado.innerHTML =
        '<div class="result-section">' +
          '<div class="result-value aprovado">' + agArredondado.toFixed(1) + '</div>' +
          '<div class="result-title">Média do Semestre</div>' +
          '<div class="result-status aprovado-bg">Aprovado!</div>' +
          explicacao + tabela +
        '</div>' +
        '<div class="result-bar"><div class="result-bar-fill green" style="width:' + (ag * 10) + '%"></div></div>';
    } else if (ag >= 3) {
      var notaFinal = (50 - 6 * agArredondado) / 4;
      notaFinal = Math.round(notaFinal * 10) / 10;
      resultado.innerHTML =
        '<div class="result-section">' +
          '<div class="result-value final">' + agArredondado.toFixed(1) + '</div>' +
          '<div class="result-title">Média do Semestre</div>' +
          '<div class="result-status final-bg">Você irá para a FINAL</div>' +
          explicacao + tabela +
        '</div>' +
        '<div class="result-divider"></div>' +
        '<div class="result-section">' +
          '<div class="result-value final-nota">' + notaFinal.toFixed(1) + '</div>' +
          '<div class="result-title">Pontuação para Aprovação</div>' +
          '<div class="result-detail">Este é o quanto você precisa na Final.</div>' +
          '<div class="result-detail">O estudante que não obtiver AG igual ou superior a 7,0 poderá fazer Avaliação Final (AF), em caráter de recuperação.</div>' +
          '<div class="result-formula">Pontuação necessária = (50 - 6 × AG) / 4</div>' +
        '</div>' +
        '<div class="result-bar"><div class="result-bar-fill orange" style="width:' + (ag * 10) + '%"></div></div>';
    } else {
      resultado.innerHTML =
        '<div class="result-section">' +
          '<div class="result-value reprovado">' + agArredondado.toFixed(1) + '</div>' +
          '<div class="result-title">Média do Semestre</div>' +
          '<div class="result-status reprovado-bg">Reprovado</div>' +
          '<div class="result-detail">A média ficou abaixo de 3,0, sem direito à Avaliação Final.</div>' +
          tabela +
        '</div>' +
        '<div class="result-bar"><div class="result-bar-fill red" style="width:' + (ag * 10) + '%"></div></div>';
    }
  });
})();

/* ---- CALCULADORA DE FALTAS ---- */
(function() {
  var btnFaltas = document.getElementById('btnCalcularFaltas');
  var cargaInput = document.getElementById('cargaHoraria');
  var faltasInput = document.getElementById('faltasAtuais');
  var resultado = document.getElementById('resultadoFaltas');

  if (!btnFaltas) return;

  btnFaltas.addEventListener('click', function() {
    var cargaHoras = parseFloat(cargaInput.value);
    var faltasDias = parseInt(faltasInput.value) || 0;

    if (!cargaHoras || cargaHoras <= 0) {
      resultado.style.display = 'block';
      resultado.innerHTML = '<div class="result-title">Erro</div><div class="result-detail">Selecione a carga horária da disciplina.</div>';
      return;
    }

    var cargaMinutos = cargaHoras * 60;
    var totalDias = cargaMinutos / 100;
    var maxFaltasDias = Math.floor(totalDias * 0.25);
    var faltasRestantes = Math.max(0, maxFaltasDias - faltasDias);
    var percentualUsado = totalDias > 0 ? ((faltasDias / totalDias) * 100) : 0;
    var percentualPresenca = 100 - percentualUsado;

    resultado.style.display = 'block';

    var statusClass, statusText;
    if (faltasDias > maxFaltasDias) {
      statusClass = 'reprovado';
      statusText = 'Reprovado por falta! Você ultrapassou o limite.';
    } else if (faltasRestantes <= 2) {
      statusClass = 'final';
      statusText = 'Cuidado! Você está no limite de faltas.';
    } else {
      statusClass = 'aprovado';
      statusText = 'Você ainda pode faltar.';
    }

    var barWidth = Math.min(100, percentualUsado);
    var barClass = faltasDias > maxFaltasDias ? 'red' : (faltasRestantes <= 2 ? 'orange' : 'green');

    resultado.innerHTML =
      '<div class="result-title">' + statusText + '</div>' +
      '<div class="result-value ' + statusClass + '">' + faltasRestantes + ' dia' + (faltasRestantes !== 1 ? 's' : '') + '</div>' +
      '<div class="result-detail">' +
        'Total de dias letivos: <strong>' + Math.floor(totalDias) + '</strong><br>' +
        'Máximo de faltas permitidas: <strong>' + maxFaltasDias + ' dias</strong><br>' +
        'Faltas acumuladas: <strong>' + faltasDias + ' dias</strong><br>' +
        'Presença atual: <strong>' + percentualPresenca.toFixed(1) + '%</strong>' +
      '</div>' +
      '<div class="result-bar"><div class="result-bar-fill ' + barClass + '" style="width:' + (100 - barWidth) + '%"></div></div>';
  });
})();

/* ---- MODAL CONTATO ---- */
(function() {
  var btnContato = document.getElementById('btnContato');
  var modal = document.getElementById('modalContato');
  var modalClose = document.getElementById('modalClose');

  if (!btnContato || !modal) return;

  btnContato.addEventListener('click', function() {
    modal.classList.add('open');
  });

  if (modalClose) {
    modalClose.addEventListener('click', function() {
      modal.classList.remove('open');
    });
  }

  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.classList.remove('open');
    }
  });
})();

/* ---- PROSEL BUTTON (disabled) ---- */
(function() {
  var btnProsel = document.getElementById('btnProsel');
  if (!btnProsel) return;
  btnProsel.addEventListener('click', function() {
    alert('O PROSEL ainda não está aberto. Fique ligado nas redes!');
  });
})();
