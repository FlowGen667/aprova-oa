// Painel de Yamileth Gill — SPA simples com rotas por hash.
(function () {
  'use strict';

  /* ================================================================ */
  /* utilidades                                                        */
  /* ================================================================ */

  var nf = (function () {
    try { return new Intl.NumberFormat('es-CO', { useGrouping: 'always' }); } catch (e) { return new Intl.NumberFormat('es-CO'); }
  })();
  var fmt = function (n) { return nf.format(Math.round(n || 0)); };
  var money = function (n) { return '$' + fmt(n); };
  var pct = function (a, b) { return b ? (a / b) * 100 : 0; };
  var pctTxt = function (v) { return (v < 10 && v > 0 ? v.toFixed(1) : Math.round(v)) + '%'; };
  var rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  var regionName = (function () {
    try { var dn = new Intl.DisplayNames(['es'], { type: 'region' }); return function (c) { try { return c && c !== '??' ? dn.of(c) : 'Desconocido'; } catch (e) { return c; } }; }
    catch (e) { return function (c) { return c; }; }
  })();
  var dayFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
  var dayLong = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
  var dateTime = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  var timeOnly = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ago(ms) {
    var diff = (ms - Date.now()) / 1000;
    var abs = Math.abs(diff);
    if (abs < 60) return 'hace un momento';
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    return dayFmt.format(ms);
  }
  function parseDay(d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2800);
  }

  function confirmDialog(title, text, okLabel) {
    return new Promise(function (resolve) {
      var bg = document.createElement('div');
      bg.className = 'confirm-bg';
      bg.innerHTML = '<div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-t"><h2 id="cf-t">' + esc(title) + '</h2><p>' + esc(text) + '</p>' +
        '<div class="actions"><button class="btn" data-no type="button">Cancelar</button><button class="btn btn--danger" data-yes type="button">' + esc(okLabel || 'Confirmar') + '</button></div></div>';
      document.body.appendChild(bg);
      var done = function (v) { bg.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      var onKey = function (e) { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', onKey);
      bg.addEventListener('click', function (e) {
        if (e.target === bg || e.target.closest('[data-no]')) done(false);
        if (e.target.closest('[data-yes]')) done(true);
      });
      bg.querySelector('[data-no]').focus();
    });
  }

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(path, init).then(function (r) {
      if (r.status === 401) { location.href = '/dashboard/login'; throw new Error('401'); }
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
        return j;
      });
    });
  }

  /* ================================================================ */
  /* ícones                                                            */
  /* ================================================================ */

  function icon(name, size) {
    size = size || 18;
    var p = {
      resumen: '<path d="M3 13h8V3H3z"/><path d="M13 21h8V11h-8z"/><path d="M3 21h8v-6H3z"/><path d="M13 3v6h8V3z"/>',
      crm: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
      trafico: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
      clics: '<path d="M9 9l11 4-5 2-2 5z"/><path d="M5 3v3M3 5h3M15 3l-2 2M3 15l2-2"/>',
      pixel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
      ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
      users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
      lead: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
      target: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      percent: '<path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
      money: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
      wa: '<path d="M20.5 3.5A11 11 0 0 0 3.6 17.2L2 22l4.9-1.6A11 11 0 0 0 20.5 3.5zM12 20a8 8 0 0 1-4.2-1.2l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" fill="currentColor" stroke="none"/>',
      mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
      copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
      click: '<path d="M9 9l11 4-5 2-2 5z"/>',
      page: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
      scroll: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
      form: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/>',
      star: '<path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
      meta: '<path d="M3 15c0-4 2-8 4.5-8 3.5 0 5.5 10 9 10C19 17 21 15 21 12s-1.5-5-3.5-5c-3.5 0-5.5 10-9 10C6 17 3 17 3 15z"/>',
      google: '<path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5a4.3 4.3 0 0 1-1.9 2.8v2.3h3A9 9 0 0 0 21 12.2z"/><path d="M12 21a8.9 8.9 0 0 0 6.1-2.3l-3-2.3a5.5 5.5 0 0 1-8.2-2.9H3.8v2.4A9 9 0 0 0 12 21z"/><path d="M6.9 13.5a5.4 5.4 0 0 1 0-3.4V7.7H3.8a9 9 0 0 0 0 8.2z"/><path d="M12 6.6a4.9 4.9 0 0 1 3.4 1.3l2.6-2.6A8.7 8.7 0 0 0 12 3a9 9 0 0 0-8.2 4.7l3.1 2.4A5.4 5.4 0 0 1 12 6.6z"/>'
    }[name] || '';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ================================================================ */
  /* dados fixos                                                       */
  /* ================================================================ */

  var STAGES = [
    { id: 'nuevo', name: 'Nuevo' },
    { id: 'contactado', name: 'Contactado' },
    { id: 'negociando', name: 'Negociando' },
    { id: 'cliente', name: 'Cliente' },
    { id: 'perdido', name: 'Perdido' }
  ];
  var stageName = function (id) { var s = STAGES.find(function (x) { return x.id === id; }); return s ? s.name : id; };
  var stageColor = function (id) { return 'var(--st-' + id + ')'; };

  var COURSES = [
    ['Workshop Ruta 3x Express', 84], ['Inmersión Desafío Next + Ebook', 112], ['Workshop Orgánico', 0], ['EduNetFlix (1.0)', 0],
    ['Código 500', 1092], ['Método Red', 2754], ['Método Hacking Sales', 0],
    ['Código Millonario', 1262], ['Escala Afiliados', 2754], ['Liga de Afiliadas', 6647]
  ];

  var SECTION_NAMES = { sobre: 'Sobre Yamileth', 'por-que': '¿Por qué aprender?', cursos: 'Catálogo de cursos', empezar: 'Cierre (botón final)' };

  function clickName(label) {
    if (label.indexOf('curso:') === 0) return 'Curso · ' + label.slice(6);
    if (label === 'hero:conocer_cursos') return 'Hero · Conocer los cursos';
    if (label === 'cierre:elegir_entrenamiento') return 'Cierre · Elegir mi entrenamiento';
    return label || '(sin nombre)';
  }

  var ROUTES = {
    resumen: { title: 'Resumen', sub: 'Cómo está funcionando tu landing.', icon: 'resumen', range: true },
    crm: { title: 'CRM', sub: 'Arrastra cada lead a la etapa en la que está.', icon: 'crm', range: false },
    trafico: { title: 'Tráfico', sub: 'De dónde llegan tus visitas y qué hacen en la página.', icon: 'trafico', range: true },
    clics: { title: 'Clics', sub: 'Qué botones y cursos llaman más la atención.', icon: 'clics', range: true },
    pixel: { title: 'Pixel', sub: 'Conecta Meta y Google, y mira los eventos en vivo.', icon: 'pixel', range: true },
    ajustes: { title: 'Ajustes', sub: 'Datos de demostración, exportación y sesión.', icon: 'ajustes', range: false }
  };

  /* ================================================================ */
  /* estado e navegação                                                */
  /* ================================================================ */

  var state = {
    days: +lsGet('yg_days', '30'),
    route: 'resumen',
    stats: null,
    leads: null,
    knownLeadIds: null,
    q: '',
    drawerId: null
  };
  var view = document.getElementById('view');
  var tz = -new Date().getTimezoneOffset();
  var timers = { refresh: null, feed: null };

  function buildNav() {
    var html = Object.keys(ROUTES).map(function (k) {
      return '<a href="#/' + k + '" data-route="' + k + '">' + icon(ROUTES[k].icon) + '<span>' + ROUTES[k].title + '</span>' + (k === 'crm' ? '<b class="nav__count" id="badge-' + k + '" hidden></b>' : '') + '</a>';
    }).join('');
    document.getElementById('nav').innerHTML = html;
    document.getElementById('tabbar').innerHTML = Object.keys(ROUTES).map(function (k) {
      return '<a href="#/' + k + '" data-route="' + k + '">' + icon(ROUTES[k].icon, 20) + '<span>' + ROUTES[k].title + '</span></a>';
    }).join('');
  }

  function setRangeButtons() {
    document.querySelectorAll('#range button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.getAttribute('data-days') === state.days));
    });
  }

  document.getElementById('range').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    state.days = +b.getAttribute('data-days');
    lsSet('yg_days', String(state.days));
    setRangeButtons();
    render(true);
  });

  document.getElementById('refresh').addEventListener('click', function (e) {
    var b = e.currentTarget;
    b.classList.add('is-spinning');
    render(false).then(function () { setTimeout(function () { b.classList.remove('is-spinning'); }, 400); toast('Datos actualizados'); });
  });

  document.querySelectorAll('[data-logout]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      api('/api/logout', { method: 'POST' }).catch(function () {}).then(function () { location.href = '/dashboard/login'; });
    });
  });

  window.addEventListener('hashchange', route);

  function route() {
    var r = (location.hash.replace(/^#\/?/, '') || 'resumen').split('?')[0];
    if (!ROUTES[r]) r = 'resumen';
    state.route = r;
    var meta = ROUTES[r];
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('page-sub').textContent = meta.sub;
    document.title = meta.title + ' · Panel Yamileth Gill';
    document.getElementById('range').hidden = !meta.range;
    document.querySelectorAll('[data-route]').forEach(function (a) {
      if (a.getAttribute('data-route') === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    closeDrawer(true);
    clearInterval(timers.feed);
    view.innerHTML = '<div class="grid grid--kpi">' + '<div class="skeleton"></div>'.repeat(5) + '</div><div class="skeleton" style="min-height:300px"></div>';
    window.scrollTo(0, 0);
    render(true);
  }

  function loadStats() {
    return api('/api/stats?days=' + state.days + '&tz=' + tz).then(function (s) {
      state.stats = s;
      var badge = document.getElementById('badge-crm');
      if (badge) { badge.textContent = s.stages.nuevo; badge.hidden = !s.stages.nuevo; }
      document.getElementById('banner').innerHTML = s.hasDemo
        ? '<div class="banner"><span>Estás viendo datos de demostración mezclados con los reales.</span><a class="btn" href="#/ajustes">Borrar datos de demo</a></div>'
        : '';
      return s;
    });
  }

  function render(animate) {
    var r = state.route;
    var p;
    if (r === 'crm') p = Promise.all([loadStats(), loadLeads()]).then(function () { renderCrm(); });
    else if (r === 'ajustes') p = loadStats().then(renderAjustes);
    else if (r === 'pixel') p = Promise.all([loadStats(), api('/api/settings')]).then(function (res) { renderPixel(res[0], res[1].settings); });
    else p = loadStats().then(function (s) { ({ resumen: renderResumen, trafico: renderTrafico, clics: renderClics })[r](s, animate); });
    return p.catch(function (err) {
      if (err.message === '401') return;
      view.innerHTML = '<div class="card empty"><h2>No pudimos cargar los datos</h2><p>' + esc(err.message) + '</p><button class="btn btn--gold" type="button" onclick="location.reload()">Intentar de nuevo</button></div>';
    });
  }

  // atualização automática a cada 30 s (sem atrapalhar quem está editando)
  timers.refresh = setInterval(function () {
    if (document.hidden || state.drawerId || document.querySelector('.is-dragging') || document.querySelector('.confirm-bg')) return;
    if (state.route === 'ajustes') return;
    if (state.route === 'crm') { loadLeads().then(function (changed) { if (changed) renderBoard(); }); loadStats().catch(function () {}); return; }
    if (state.route === 'pixel') return; // o feed ao vivo já atualiza sozinho
    render(false);
  }, 30000);

  /* ================================================================ */
  /* peças reutilizáveis                                               */
  /* ================================================================ */

  function delta(cur, prev, mode) {
    if (!state.stats || !state.stats.prev) return '';
    if (mode === 'pp') {
      if (!state.stats.prev.visitors) return '<span class="delta delta--flat">sin datos previos</span>';
      var d = cur - prev;
      if (Math.abs(d) < 0.05) return '<span class="delta delta--flat">= igual</span>';
      return '<span class="delta ' + (d > 0 ? 'delta--up' : 'delta--down') + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(1) + ' pp</span>';
    }
    if (!prev && !cur) return '<span class="delta delta--flat">= igual</span>';
    if (!prev) return '<span class="delta delta--up">▲ nuevo</span>';
    var ch = ((cur - prev) / prev) * 100;
    if (Math.abs(ch) < 0.5) return '<span class="delta delta--flat">= igual</span>';
    return '<span class="delta ' + (ch > 0 ? 'delta--up' : 'delta--down') + '">' + (ch > 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(0) + '%</span>';
  }

  function kpi(label, ic, value, foot, d) {
    return '<div class="card kpi"><div class="kpi__label">' + icon(ic, 16) + label + '</div><div class="kpi__value">' + value + '</div>' +
      '<div class="kpi__foot">' + (d || '') + '<span>' + foot + '</span></div></div>';
  }

  function periodLabel() {
    return state.days ? 'vs. ' + state.days + ' días anteriores' : 'desde el inicio';
  }

  function emptyState(title, text) {
    return '<div class="card empty"><img src="/logo.png" alt="" width="64" height="64"><h2>' + title + '</h2><p>' + text + '</p>' +
      '<div class="actions" style="justify-content:center"><a class="btn btn--gold" href="/" target="_blank" rel="noopener">Abrir la landing</a>' +
      '<button class="btn" type="button" data-seed>Cargar datos de demostración</button></div></div>';
  }

  view.addEventListener('click', function (e) {
    if (e.target.closest('[data-seed]')) seedDemo(e.target.closest('[data-seed]'));
  });

  function seedDemo(btn) {
    btn.disabled = true;
    btn.textContent = 'Cargando…';
    return api('/api/demo', { method: 'POST' }).then(function (r) {
      toast('Listo: ' + fmt(r.leads) + ' leads y ' + fmt(r.events) + ' eventos de demostración');
      state.leads = null; state.knownLeadIds = null;
      render(true);
    }).catch(function (err) { toast(err.message); btn.disabled = false; });
  }

  function hasData(s) { return s.kpis.visitors > 0 || s.kpis.leads > 0; }

  function seriesFor(s, key) {
    return s.series.map(function (d) {
      var dt = parseDay(d.day);
      return { label: dayFmt.format(dt), title: dayLong.format(dt), value: d[key] };
    });
  }

  /* ================================================================ */
  /* RESUMEN                                                           */
  /* ================================================================ */

  function renderResumen(s) {
    if (!hasData(s)) {
      view.innerHTML = emptyState('Todavía no hay visitas', 'Cuando alguien abra tu landing, los datos aparecerán aquí al instante. Comparte el enlace o carga datos de demostración para explorar el panel.');
      return;
    }
    var k = s.kpis, p = s.prev || {};
    var conv = pct(k.leads, k.visitors), convPrev = pct(p.leads, p.visitors);
    var html = '<div class="grid grid--kpi">' +
      kpi('Visitantes', 'users', fmt(k.visitors), periodLabel(), delta(k.visitors, p.visitors)) +
      kpi('Leads', 'lead', fmt(k.leads), periodLabel(), delta(k.leads, p.leads)) +
      kpi('Conversión', 'percent', pctTxt(conv), 'de visitantes a leads', delta(conv, convPrev, 'pp')) +
      kpi('Clics en botones', 'click', fmt(k.clicks), fmt(k.clickers) + ' personas', delta(k.clicks, p.clicks)) +
      kpi('Ventas cerradas', 'money', money(k.revenue), fmt(k.customers) + ' clientes', delta(k.revenue, p.revenue)) +
      '</div>' +
      '<div class="grid grid--2-1">' +
      '<section class="card"><div class="card__head"><h2>Visitantes por día</h2><span>Personas únicas</span></div><div class="chart" id="ch-visitors"></div></section>' +
      '<section class="card"><div class="card__head"><h2>Embudo</h2><span>Personas únicas</span></div><div id="ch-funnel"></div></section>' +
      '</div>' +
      '<div class="grid grid--1-1">' +
      '<section class="card"><div class="card__head"><h2>Leads por día</h2><span>Formularios enviados</span></div><div class="chart" id="ch-leads"></div></section>' +
      '<section class="card"><div class="card__head"><h2>Fuentes de tráfico</h2><a class="btn" href="#/trafico">Ver todo</a></div><div id="ch-sources"></div></section>' +
      '</div>' +
      '<div class="grid grid--2-1">' +
      '<section class="card"><div class="card__head"><h2>Últimos leads</h2><a class="btn" href="#/crm">Abrir CRM</a></div><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Fuente</th><th>Interés</th><th>Etapa</th><th class="num">Cuándo</th></tr></thead><tbody>' +
      (s.recentLeads.length ? s.recentLeads.map(function (l) {
        return '<tr class="is-link" data-open-lead="' + l.id + '"><td><strong>' + esc(l.name) + '</strong>' + (l.is_demo ? ' <span class="chip chip--demo">Demo</span>' : '') + '<div class="muted">' + esc(l.email) + '</div></td>' +
          '<td>' + esc(l.source || 'Directo') + '</td><td class="muted">' + esc(l.interest || '—') + '</td>' +
          '<td><span class="chip"><i class="stage-dot" style="--c:' + stageColor(l.stage) + '"></i>' + stageName(l.stage) + '</span></td>' +
          '<td class="num muted">' + ago(l.created_at) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">Todavía no hay leads.</td></tr>') +
      '</tbody></table></div></section>' +
      '<section class="card"><div class="card__head"><h2>Pipeline del CRM</h2><span>Todos los leads</span></div><div id="ch-stages"></div></section>' +
      '</div>';
    view.innerHTML = html;

    YGCharts.area(document.getElementById('ch-visitors'), seriesFor(s, 'visitors'), { label: 'Visitantes por día', unit: 'visitantes' });
    YGCharts.bars(document.getElementById('ch-leads'), seriesFor(s, 'leads'), { label: 'Leads por día', unit: 'leads' });
    YGCharts.funnel(document.getElementById('ch-funnel'), [
      { name: 'Visitaron la landing', value: k.visitors },
      { name: 'Vieron el catálogo', value: k.saw_catalog },
      { name: 'Abrieron el formulario', value: k.form_opens },
      { name: 'Enviaron sus datos', value: k.leads }
    ]);
    YGCharts.barList(document.getElementById('ch-sources'), s.sources.slice(0, 6).map(function (x) {
      return { name: x.name, value: x.visitors, extra: fmt(x.leads) + ' leads' };
    }));
    var stagesEl = document.getElementById('ch-stages');
    var totalLeads = STAGES.reduce(function (a, st) { return a + s.stages[st.id]; }, 0);
    stagesEl.innerHTML = '<ul class="barlist">' + STAGES.map(function (st, i) {
      var n = s.stages[st.id];
      return '<li><div class="barlist__head"><span class="barlist__name"><span class="chip" style="border:0;background:none;padding:0"><i class="stage-dot" style="--c:' + stageColor(st.id) + '"></i>' + st.name + '</span></span>' +
        '<span class="barlist__val"><strong>' + fmt(n) + '</strong><em>' + pctTxt(pct(n, totalLeads)) + '</em></span></div>' +
        '<div class="barlist__track"><i style="--w:' + pct(n, totalLeads).toFixed(1) + '%;--d:' + i * 50 + 'ms;background:' + stageColor(st.id) + ';box-shadow:none"></i></div></li>';
    }).join('') + '</ul>';

    view.querySelectorAll('[data-open-lead]').forEach(function (tr) {
      tr.addEventListener('click', function () { location.hash = '#/crm'; setTimeout(function () { openDrawer(+tr.getAttribute('data-open-lead')); }, 350); });
    });
  }

  /* ================================================================ */
  /* CRM                                                               */
  /* ================================================================ */

  function loadLeads() {
    return api('/api/leads').then(function (r) {
      var prevIds = state.knownLeadIds;
      var sig = JSON.stringify(r.leads.map(function (l) { return [l.id, l.stage, l.updated_at]; }));
      var changed = sig !== state.leadsSig;
      state.leadsSig = sig;
      state.leads = r.leads;
      var ids = {};
      r.leads.forEach(function (l) { ids[l.id] = true; });
      state.newIds = {};
      if (prevIds) {
        r.leads.forEach(function (l) {
          if (!prevIds[l.id]) { state.newIds[l.id] = true; if (!l.is_demo) toast('Nuevo lead: ' + l.name); }
        });
      }
      state.knownLeadIds = ids;
      return changed;
    });
  }

  function filteredLeads() {
    var q = state.q.trim().toLowerCase();
    if (!q) return state.leads;
    var digits = q.replace(/\D/g, '');
    return state.leads.filter(function (l) {
      return l.name.toLowerCase().indexOf(q) >= 0 || l.email.indexOf(q) >= 0 || (digits && l.phone.indexOf(digits) >= 0) ||
        (l.interest || '').toLowerCase().indexOf(q) >= 0 || (l.source || '').toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderCrm() {
    if (!state.leads.length) {
      view.innerHTML = emptyState('Tu CRM está listo', 'Cada persona que envíe el formulario de la landing aparecerá aquí como un nuevo lead. Luego podrás moverla entre etapas hasta convertirla en cliente.');
      return;
    }
    view.innerHTML =
      '<div class="crm-bar">' +
      '<label class="search">' + icon('search', 16) + '<input type="search" id="crm-q" placeholder="Buscar por nombre, email, teléfono o curso" value="' + esc(state.q) + '" aria-label="Buscar leads"></label>' +
      '<a class="btn" href="/api/leads.csv" download>' + icon('download', 16) + 'Exportar CSV</a>' +
      '<span class="crm-summary" id="crm-summary"></span>' +
      '</div><div class="board" id="board"></div>';
    var q = document.getElementById('crm-q');
    q.addEventListener('input', function () { state.q = q.value; renderBoard(); });
    renderBoard();
  }

  function renderBoard() {
    var board = document.getElementById('board');
    if (!board) return;
    var list = filteredLeads();
    var customers = list.filter(function (l) { return l.stage === 'cliente'; });
    var revenue = customers.reduce(function (a, l) { return a + (l.value || 0); }, 0);
    document.getElementById('crm-summary').innerHTML = '<strong>' + fmt(list.length) + '</strong> leads · <strong>' + fmt(customers.length) + '</strong> clientes · <strong>' + money(revenue) + '</strong> en ventas';

    var LIMIT = 80;
    board.innerHTML = STAGES.map(function (st) {
      var items = list.filter(function (l) { return l.stage === st.id; });
      var sum = items.reduce(function (a, l) { return a + (l.value || 0); }, 0);
      return '<section class="col" data-stage="' + st.id + '" aria-label="' + st.name + '">' +
        '<header class="col__head"><i class="stage-dot" style="--c:' + stageColor(st.id) + '"></i><h3>' + st.name + '</h3><span class="col__count">' + items.length + '</span>' +
        (sum ? '<span class="col__sum">' + money(sum) + '</span>' : '') + '</header>' +
        '<div class="col__list">' +
        (items.length ? items.slice(0, LIMIT).map(cardHtml).join('') : '<p class="col__empty">Arrastra un lead aquí</p>') +
        (items.length > LIMIT ? '<p class="col__more">y ' + (items.length - LIMIT) + ' más · usa la búsqueda</p>' : '') +
        '</div></section>';
    }).join('');
    bindBoard(board);
  }

  function waLink(l) {
    var first = (l.name || '').split(' ')[0];
    var msg = 'Hola ' + first + ', ¡gracias por tu interés en mis entrenamientos!' + (l.interest ? ' Vi que te interesa ' + l.interest + '.' : '');
    return 'https://wa.me/' + String(l.phone || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
  }

  function cardHtml(l) {
    return '<article class="lead-card' + (state.newIds && state.newIds[l.id] ? ' is-new' : '') + '" draggable="true" tabindex="0" data-id="' + l.id + '" style="--c:' + stageColor(l.stage) + '" aria-label="' + esc(l.name) + ', abrir detalles">' +
      '<div class="lead-card__top"><h4>' + esc(l.name) + '</h4><time>' + ago(l.created_at) + '</time></div>' +
      '<div class="lead-card__meta">' + esc(l.email) + '</div>' +
      (l.course ? '<div class="lead-card__interest">' + icon('star', 12) + ' ' + esc(l.course) + (l.value ? ' · ' + money(l.value) : '') + '</div>'
        : l.interest ? '<div class="lead-card__interest">Interés: ' + esc(l.interest) + '</div>' : '') +
      '<div class="lead-card__foot"><span class="chip">' + esc(l.source || 'Directo') + '</span>' +
      (l.is_demo ? '<span class="chip chip--demo">Demo</span>' : '') +
      (l.notes_count ? '<span class="chip">' + l.notes_count + (l.notes_count > 1 ? ' notas' : ' nota') + '</span>' : '') +
      '<span class="lead-card__actions">' +
      '<a class="icon-btn icon-btn--wa" href="' + esc(waLink(l)) + '" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp" title="WhatsApp" data-stop>' + icon('wa', 14) + '</a>' +
      '<a class="icon-btn" href="mailto:' + esc(l.email) + '" aria-label="Enviar email" title="Email" data-stop>' + icon('mail', 14) + '</a>' +
      '</span></div></article>';
  }

  function bindBoard(board) {
    var dragId = null;
    board.addEventListener('dragstart', function (e) {
      var card = e.target.closest('.lead-card');
      if (!card) return;
      dragId = +card.getAttribute('data-id');
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragId));
    });
    board.addEventListener('dragend', function (e) {
      var card = e.target.closest('.lead-card');
      if (card) card.classList.remove('is-dragging');
      board.querySelectorAll('.col.is-over').forEach(function (c) { c.classList.remove('is-over'); });
    });
    board.addEventListener('dragover', function (e) {
      var col = e.target.closest('.col');
      if (!col || dragId === null) return;
      e.preventDefault();
      board.querySelectorAll('.col.is-over').forEach(function (c) { if (c !== col) c.classList.remove('is-over'); });
      col.classList.add('is-over');
    });
    board.addEventListener('drop', function (e) {
      var col = e.target.closest('.col');
      if (!col || dragId === null) return;
      e.preventDefault();
      var id = dragId;
      dragId = null;
      moveLead(id, col.getAttribute('data-stage'));
    });
    board.addEventListener('click', function (e) {
      if (e.target.closest('[data-stop]')) return;
      var card = e.target.closest('.lead-card');
      if (card) openDrawer(+card.getAttribute('data-id'));
    });
    board.addEventListener('keydown', function (e) {
      var card = e.target.closest('.lead-card');
      if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDrawer(+card.getAttribute('data-id')); }
    });
  }

  function moveLead(id, stage) {
    var lead = state.leads.find(function (l) { return l.id === id; });
    if (!lead || lead.stage === stage) return Promise.resolve();
    var old = lead.stage;
    lead.stage = stage;
    lead.updated_at = Date.now();
    renderBoard();
    return api('/api/leads/' + id, { method: 'PATCH', body: { stage: stage } }).then(function () {
      toast(lead.name + ' → ' + stageName(stage));
      loadStats().catch(function () {});
      // cliente sem curso registrado: abre os detalhes para anotar a venda
      if (stage === 'cliente' && !lead.course) setTimeout(function () { openDrawer(id, true); }, 250);
    }).catch(function (err) {
      lead.stage = old;
      renderBoard();
      toast('No se pudo mover: ' + err.message);
    });
  }

  /* ---------------- gaveta de detalhes ---------------- */

  var drawer, drawerBg;
  function ensureDrawer() {
    if (drawer) return;
    drawerBg = document.createElement('div');
    drawerBg.className = 'drawer-bg';
    drawerBg.hidden = true;
    drawer = document.createElement('aside');
    drawer.className = 'drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'dr-title');
    drawer.hidden = true;
    document.body.appendChild(drawerBg);
    document.body.appendChild(drawer);
    drawerBg.addEventListener('click', function () { closeDrawer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.drawerId && !document.querySelector('.confirm-bg')) closeDrawer(); });
  }

  var lastFocus = null;
  function openDrawer(id, focusSale) {
    ensureDrawer();
    lastFocus = document.activeElement;
    state.drawerId = id;
    drawer.hidden = false;
    drawerBg.hidden = false;
    drawer.innerHTML = '<div class="drawer__body"><div class="skeleton"></div><div class="skeleton"></div></div>';
    requestAnimationFrame(function () { drawer.classList.add('is-open'); drawerBg.classList.add('is-open'); });
    loadDrawer(id, focusSale);
  }

  function closeDrawer(instant) {
    if (!drawer || !state.drawerId) return;
    state.drawerId = null;
    drawer.classList.remove('is-open');
    drawerBg.classList.remove('is-open');
    setTimeout(function () { drawer.hidden = true; drawerBg.hidden = true; }, instant ? 0 : 320);
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
  }

  function loadDrawer(id, focusSale) {
    return api('/api/leads/' + id).then(function (r) {
      if (state.drawerId !== id) return;
      renderDrawer(r.lead, r.activity);
      if (focusSale) { var sel = drawer.querySelector('#dr-course'); if (sel) sel.focus(); }
      else { var t = drawer.querySelector('#dr-close'); if (t) t.focus(); }
    }).catch(function (err) {
      drawer.innerHTML = '<div class="drawer__body"><p>' + esc(err.message) + '</p></div>';
    });
  }

  function renderDrawer(l, activity) {
    var actLabel = { registro: 'Registro', etapa: 'Cambio de etapa', nota: 'Nota', curso: 'Venta' };
    drawer.innerHTML =
      '<header class="drawer__head"><div><h2 id="dr-title">' + esc(l.name) + '</h2><p>Lead desde ' + dateTime.format(l.created_at) + (l.is_demo ? ' · <span class="chip chip--demo">Demo</span>' : '') + '</p></div>' +
      '<button class="btn btn--icon" id="dr-close" type="button" aria-label="Cerrar">' + icon('close', 16) + '</button></header>' +
      '<div class="drawer__body">' +
      '<section><h3>Contacto</h3><div class="contact">' +
      '<div class="contact__row">' + icon('mail', 16) + '<span>' + esc(l.email) + '</span><button class="icon-btn" type="button" data-copy="' + esc(l.email) + '" aria-label="Copiar email">' + icon('copy', 14) + '</button><a class="icon-btn" href="mailto:' + esc(l.email) + '" aria-label="Enviar email">' + icon('mail', 14) + '</a></div>' +
      '<div class="contact__row">' + icon('wa', 16) + '<span>' + esc(l.phone) + '</span><button class="icon-btn" type="button" data-copy="' + esc(l.phone) + '" aria-label="Copiar teléfono">' + icon('copy', 14) + '</button><a class="icon-btn icon-btn--wa" href="' + esc(waLink(l)) + '" target="_blank" rel="noopener" aria-label="Abrir WhatsApp">' + icon('wa', 14) + '</a></div>' +
      '</div></section>' +
      '<section><h3>Etapa</h3><div class="stage-pick" role="group" aria-label="Etapa del lead">' + STAGES.map(function (st) {
        return '<button type="button" data-stage="' + st.id + '" aria-pressed="' + (l.stage === st.id) + '" style="--c:' + stageColor(st.id) + '"><i class="stage-dot" style="--c:' + stageColor(st.id) + '"></i>' + st.name + '</button>';
      }).join('') + '</div></section>' +
      '<section><h3>Venta</h3><div class="sale">' +
      '<select class="select" id="dr-course" aria-label="Curso comprado"><option value="">Sin curso vendido</option>' + COURSES.map(function (c) {
        return '<option value="' + esc(c[0]) + '" data-price="' + c[1] + '"' + (l.course === c[0] ? ' selected' : '') + '>' + esc(c[0]) + (c[1] ? ' · ' + money(c[1]) : '') + '</option>';
      }).join('') + '</select>' +
      '<input class="input" id="dr-value" type="number" min="0" step="1" inputmode="numeric" value="' + (l.value || 0) + '" aria-label="Valor de la venta en dólares">' +
      '</div><p class="help" style="margin-top:8px">El valor se completa con el precio del curso; puedes ajustarlo si hubo descuento.</p></section>' +
      '<section><h3>Origen</h3><div class="facts">' +
      fact('Fuente', l.source || 'Directo') + fact('Medio', l.medium || '—') + fact('Campaña', l.campaign || '—') + fact('Interés', l.interest || '—') +
      fact('Dispositivo', l.device || '—') + fact('País', regionName(l.country)) +
      '</div></section>' +
      '<section><h3>Notas</h3><form id="dr-note"><textarea class="textarea" name="text" placeholder="Ej.: Le escribí por WhatsApp, quiere empezar el lunes." aria-label="Nueva nota"></textarea>' +
      '<div class="actions" style="margin-top:8px;justify-content:flex-end"><button class="btn btn--gold" type="submit">Agregar nota</button></div></form></section>' +
      '<section><h3>Historial</h3><ul class="timeline">' + activity.map(function (a) {
        return '<li class="' + (a.kind === 'nota' ? 'is-note' : '') + '"><strong>' + (actLabel[a.kind] || a.kind) + '</strong><p>' + esc(prettyActivity(a)) + '</p><time>' + dateTime.format(a.created_at) + '</time></li>';
      }).join('') + '</ul></section>' +
      '</div>' +
      '<footer class="drawer__foot"><button class="btn btn--danger" type="button" id="dr-delete">' + icon('trash', 15) + 'Eliminar lead</button>' +
      '<a class="btn btn--gold" href="' + esc(waLink(l)) + '" target="_blank" rel="noopener">' + icon('wa', 15) + 'WhatsApp</a></footer>';

    drawer.querySelector('#dr-close').addEventListener('click', function () { closeDrawer(); });
    drawer.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-copy');
        (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { toast('Copiado: ' + v); }, function () { toast(v); });
      });
    });
    drawer.querySelectorAll('.stage-pick button').forEach(function (b) {
      b.addEventListener('click', function () {
        var st = b.getAttribute('data-stage');
        drawer.querySelectorAll('.stage-pick button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        moveLead(l.id, st).then(function () { if (st !== 'cliente' || l.course) loadDrawer(l.id); });
      });
    });
    var course = drawer.querySelector('#dr-course');
    var value = drawer.querySelector('#dr-value');
    course.addEventListener('change', function () {
      var price = +course.selectedOptions[0].getAttribute('data-price') || 0;
      if (course.value) value.value = price;
      else value.value = 0;
      saveLead(l.id, { course: course.value, value: +value.value }, course.value ? 'Venta registrada: ' + course.value : 'Curso removido');
    });
    value.addEventListener('change', function () { saveLead(l.id, { value: Math.max(0, +value.value || 0) }, 'Valor actualizado'); });
    drawer.querySelector('#dr-note').addEventListener('submit', function (e) {
      e.preventDefault();
      var ta = e.target.elements.text;
      if (!ta.value.trim()) { ta.focus(); return; }
      api('/api/leads/' + l.id + '/notes', { method: 'POST', body: { text: ta.value } }).then(function () {
        toast('Nota guardada');
        var lead = state.leads && state.leads.find(function (x) { return x.id === l.id; });
        if (lead) { lead.notes_count = (lead.notes_count || 0) + 1; renderBoard(); }
        loadDrawer(l.id);
      }).catch(function (err) { toast(err.message); });
    });
    drawer.querySelector('#dr-delete').addEventListener('click', function () {
      confirmDialog('¿Eliminar a ' + l.name + '?', 'Se borrarán el lead y todo su historial. Esta acción no se puede deshacer.', 'Eliminar').then(function (ok) {
        if (!ok) return;
        api('/api/leads/' + l.id, { method: 'DELETE' }).then(function () {
          state.leads = state.leads.filter(function (x) { return x.id !== l.id; });
          closeDrawer();
          renderBoard();
          loadStats().catch(function () {});
          toast('Lead eliminado');
        }).catch(function (err) { toast(err.message); });
      });
    });
  }

  function fact(label, value) {
    return '<div class="fact"><span>' + label + '</span><strong title="' + esc(value) + '">' + esc(value) + '</strong></div>';
  }

  function prettyActivity(a) {
    if (a.kind === 'etapa') {
      var parts = a.text.split(' → ');
      if (parts.length === 2) return stageName(parts[0]) + ' → ' + stageName(parts[1]);
    }
    return a.text;
  }

  function saveLead(id, body, msg) {
    return api('/api/leads/' + id, { method: 'PATCH', body: body }).then(function () {
      var lead = state.leads && state.leads.find(function (x) { return x.id === id; });
      if (lead) { Object.assign(lead, body); renderBoard(); }
      toast(msg);
      loadStats().catch(function () {});
      loadDrawer(id);
    }).catch(function (err) { toast(err.message); });
  }

  /* ================================================================ */
  /* TRÁFICO                                                           */
  /* ================================================================ */

  function renderTrafico(s) {
    if (!hasData(s)) { view.innerHTML = emptyState('Sin tráfico todavía', 'Aquí verás de dónde llegan tus visitas (Instagram, TikTok, Google…), desde qué dispositivo y hasta dónde leen la página.'); return; }
    var k = s.kpis;
    var scrollMap = {}; s.scroll.forEach(function (x) { scrollMap[x.name] = x.visitors; });
    var secMap = {}; s.sections.forEach(function (x) { secMap[x.name] = x.visitors; });
    view.innerHTML =
      '<div class="grid grid--kpi4">' +
      kpi('Sesiones', 'eye', fmt(k.sessions), periodLabel(), delta(k.sessions, (s.prev || {}).sessions)) +
      kpi('Páginas vistas', 'page', fmt(k.pageviews), (k.visitors ? (k.pageviews / k.visitors).toFixed(1) : '0') + ' por visitante', delta(k.pageviews, (s.prev || {}).pageviews)) +
      kpi('Vieron el catálogo', 'star', pctTxt(pct(k.saw_catalog, k.visitors)), fmt(k.saw_catalog) + ' personas') +
      kpi('Leyeron hasta el final', 'scroll', pctTxt(pct(scrollMap['100'] || 0, k.visitors)), fmt(scrollMap['100'] || 0) + ' personas') +
      '</div>' +
      '<div class="grid grid--2-1">' +
      '<section class="card"><div class="card__head"><h2>Fuentes de tráfico</h2><span>Visitantes únicos</span></div><div class="table-wrap"><table><thead><tr><th>Fuente</th><th>Visitantes</th><th class="num">Leads</th><th class="num">Conversión</th></tr></thead><tbody>' +
      (s.sources.length ? s.sources.map(function (x) {
        var max = s.sources[0].visitors || 1;
        return '<tr><td><strong>' + esc(x.name) + '</strong></td><td><div class="cell-bar"><i style="width:' + Math.max(4, (x.visitors / max) * 120) + 'px"></i>' + fmt(x.visitors) + '</div></td><td class="num">' + fmt(x.leads) + '</td><td class="num">' + pctTxt(pct(x.leads, x.visitors)) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">Sin datos.</td></tr>') +
      '</tbody></table></div></section>' +
      '<section class="card"><div class="card__head"><h2>Dispositivos</h2></div><div id="ch-devices"></div></section>' +
      '</div>' +
      '<div class="grid grid--3">' +
      '<section class="card"><div class="card__head"><h2>Países</h2></div><div id="ch-countries"></div></section>' +
      '<section class="card"><div class="card__head"><h2>Navegadores</h2></div><div id="ch-browsers"></div></section>' +
      '<section class="card"><div class="card__head"><h2>Hasta dónde leen</h2><span>% de visitantes</span></div><div id="ch-scroll"></div></section>' +
      '</div>' +
      '<div class="grid grid--2-1">' +
      '<section class="card"><div class="card__head"><h2>¿Cuándo te visitan?</h2><span>Día y hora (tu zona horaria)</span></div><div id="ch-heat"></div></section>' +
      '<section class="card"><div class="card__head"><h2>Secciones vistas</h2><span>% de visitantes</span></div><div id="ch-sections"></div></section>' +
      '</div>' +
      '<div class="grid grid--1-1">' +
      '<section class="card"><div class="card__head"><h2>Campañas (UTM)</h2><span>Enlaces con utm_campaign</span></div><div class="table-wrap"><table><thead><tr><th>Campaña</th><th>Fuente / medio</th><th class="num">Visitantes</th><th class="num">Leads</th></tr></thead><tbody>' +
      (s.campaigns.length ? s.campaigns.map(function (c) {
        return '<tr><td><strong>' + esc(c.name) + '</strong></td><td class="muted">' + esc((c.source || 'Directo') + (c.medium ? ' / ' + c.medium : '')) + '</td><td class="num">' + fmt(c.visitors) + '</td><td class="num">' + fmt(c.leads) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">Aún no hay campañas. Crea un enlace con el generador de al lado.</td></tr>') +
      '</tbody></table></div></section>' +
      '<section class="card"><div class="card__head"><h2>Generador de enlaces con UTM</h2><span>Para saber qué publicación trae más leads</span></div>' +
      '<div class="grid" style="gap:10px">' +
      '<select class="select" id="utm-src" aria-label="Fuente"><option>instagram</option><option>tiktok</option><option>facebook</option><option>youtube</option><option>whatsapp</option><option>email</option></select>' +
      '<select class="select" id="utm-med" aria-label="Medio"><option value="social">social (publicación orgánica)</option><option value="bio">bio (enlace del perfil)</option><option value="stories">stories</option><option value="paid">paid (anuncio)</option><option value="email">email</option></select>' +
      '<input class="input" id="utm-camp" placeholder="Nombre de la campaña (ej.: reel-codigo-500)" aria-label="Nombre de la campaña">' +
      '<div class="form-row"><input class="input" id="utm-out" readonly aria-label="Enlace generado"><button class="btn btn--gold" type="button" id="utm-copy">' + icon('copy', 15) + 'Copiar</button></div>' +
      '</div></section>' +
      '</div>';

    YGCharts.barList(document.getElementById('ch-devices'), s.devices.map(function (x) { return { name: x.name, value: x.visitors, extra: pctTxt(pct(x.visitors, k.visitors)) }; }));
    YGCharts.barList(document.getElementById('ch-countries'), s.countries.map(function (x) { return { name: regionName(x.name), value: x.visitors, extra: pctTxt(pct(x.visitors, k.visitors)) }; }));
    YGCharts.barList(document.getElementById('ch-browsers'), s.browsers.map(function (x) { return { name: x.name, value: x.visitors, extra: pctTxt(pct(x.visitors, k.visitors)) }; }));
    YGCharts.barList(document.getElementById('ch-scroll'), ['25', '50', '75', '100'].map(function (m) {
      return { name: m === '100' ? 'Hasta el final' : 'El ' + m + '% de la página', value: pct(scrollMap[m] || 0, k.visitors), extra: fmt(scrollMap[m] || 0) + ' personas' };
    }), { format: pctTxt });
    YGCharts.barList(document.getElementById('ch-sections'), ['sobre', 'por-que', 'cursos', 'empezar'].map(function (id) {
      return { name: SECTION_NAMES[id], value: pct(secMap[id] || 0, k.visitors), extra: fmt(secMap[id] || 0) };
    }), { format: pctTxt });
    YGCharts.heatmap(document.getElementById('ch-heat'), s.heatmap);

    var src = document.getElementById('utm-src'), med = document.getElementById('utm-med'), camp = document.getElementById('utm-camp'), out = document.getElementById('utm-out');
    var build = function () {
      var c = camp.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      var u = new URL('/', location.origin);
      u.searchParams.set('utm_source', src.value);
      u.searchParams.set('utm_medium', med.value);
      if (c) u.searchParams.set('utm_campaign', c);
      out.value = u.toString();
    };
    [src, med, camp].forEach(function (x) { x.addEventListener('input', build); });
    build();
    document.getElementById('utm-copy').addEventListener('click', function () {
      (navigator.clipboard ? navigator.clipboard.writeText(out.value) : Promise.reject()).then(function () { toast('Enlace copiado'); }, function () { out.select(); toast('Selecciona y copia el enlace'); });
    });
  }

  /* ================================================================ */
  /* CLICS                                                             */
  /* ================================================================ */

  function renderClics(s) {
    if (!hasData(s)) { view.innerHTML = emptyState('Sin clics todavía', 'Aquí verás cuántas veces tocaron cada botón: el de la portada, el de cada curso y el botón final.'); return; }
    var k = s.kpis, p = s.prev || {};
    var max = s.clicks.length ? s.clicks[0].clicks : 1;
    view.innerHTML =
      '<div class="grid grid--kpi4">' +
      kpi('Clics totales', 'click', fmt(k.clicks), periodLabel(), delta(k.clicks, p.clicks)) +
      kpi('Personas que hicieron clic', 'users', fmt(k.clickers), 'personas únicas', delta(k.clickers, p.clickers)) +
      kpi('Tasa de clic', 'percent', pctTxt(pct(k.clickers, k.visitors)), 'de los visitantes', delta(pct(k.clickers, k.visitors), pct(p.clickers, p.visitors), 'pp')) +
      kpi('Abrieron el formulario', 'form', fmt(k.form_opens), pctTxt(pct(k.form_opens, k.visitors)) + ' de los visitantes', delta(k.form_opens, p.form_opens)) +
      '</div>' +
      '<div class="grid"><section class="card"><div class="card__head"><h2>Clics por día</h2><span>Todos los botones</span></div><div class="chart" id="ch-clicks"></div></section></div>' +
      '<div class="grid"><section class="card"><div class="card__head"><h2>Botones y cursos</h2><span>Ordenados por clics</span></div><div class="table-wrap"><table><thead><tr><th>Botón</th><th>Clics</th><th class="num">Personas</th><th class="num">% de visitantes</th></tr></thead><tbody>' +
      (s.clicks.length ? s.clicks.map(function (c) {
        return '<tr><td><strong>' + esc(clickName(c.name)) + '</strong></td><td><div class="cell-bar"><i style="width:' + Math.max(4, (c.clicks / max) * 160) + 'px"></i>' + fmt(c.clicks) + '</div></td><td class="num">' + fmt(c.unique_clicks) + '</td><td class="num">' + pctTxt(pct(c.unique_clicks, k.visitors)) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">Sin clics en este período.</td></tr>') +
      '</tbody></table></div></section></div>';
    YGCharts.bars(document.getElementById('ch-clicks'), seriesFor(s, 'clicks'), { label: 'Clics por día', unit: 'clics' });
  }

  /* ================================================================ */
  /* PIXEL                                                             */
  /* ================================================================ */

  function renderPixel(s, settings) {
    var meta = settings.meta_pixel_id || '', ga = settings.ga4_id || '';
    var rows = [
      ['Visita a la página', 'PageView', 'page_view', s.pixel.PageView],
      ['Clic en un curso', 'ViewContent', 'view_item', s.pixel.ViewContent],
      ['Abrió el formulario', 'InitiateCheckout', 'begin_checkout', s.pixel.InitiateCheckout],
      ['Envió sus datos', 'Lead', 'generate_lead', s.pixel.Lead]
    ];
    view.innerHTML =
      '<div class="grid grid--1-1">' +
      pixelCard('meta', 'Pixel de Meta', 'Facebook e Instagram Ads', meta, 'ID del Pixel (solo números)', 'Lo encuentras en Meta Business › Administrador de eventos › Orígenes de datos.') +
      pixelCard('google', 'Google Analytics 4', 'Google Ads y Analytics', ga, 'ID de medición (G-XXXXXXX)', 'Lo encuentras en Analytics › Administrar › Flujos de datos › tu sitio web.') +
      '</div>' +
      '<div class="grid grid--1-1">' +
      '<section class="card"><div class="card__head"><h2>Eventos que se envían</h2><span>En el período elegido</span></div><div class="table-wrap"><table><thead><tr><th>Qué pasó en la landing</th><th>Meta</th><th>Google</th><th class="num">Veces</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td><strong>' + r[0] + '</strong></td><td><code class="muted">' + r[1] + '</code></td><td><code class="muted">' + r[2] + '</code></td><td class="num">' + fmt(r[3]) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="help" style="margin-top:36px">Los eventos se registran siempre en este panel. A Meta y Google se envían solo cuando su ID está guardado. Para probar, abre la landing en otra pestaña y mira los eventos llegar aquí al lado.</p></section>' +
      '<section class="card"><div class="card__head"><h2>En vivo</h2><span class="live"><i></i>Se actualiza cada 4 segundos</span></div><ul class="feed" id="feed"><li class="muted">Cargando eventos…</li></ul></section>' +
      '</div>';

    view.querySelectorAll('form[data-pixel]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var key = form.getAttribute('data-pixel') === 'meta' ? 'meta_pixel_id' : 'ga4_id';
        var msg = form.querySelector('.form-msg');
        var body = {}; body[key] = form.elements.id.value.trim();
        api('/api/settings', { method: 'PUT', body: body }).then(function () {
          msg.className = 'form-msg ok';
          msg.textContent = body[key] ? 'Guardado. La landing ya envía los eventos.' : 'Desconectado.';
          var chip = form.closest('.card').querySelector('.chip');
          chip.className = 'chip ' + (body[key] ? 'chip--ok' : 'chip--off');
          chip.textContent = body[key] ? 'Activo' : 'Sin conectar';
        }).catch(function (err) { msg.className = 'form-msg err'; msg.textContent = err.message; });
      });
    });
    startFeed();
  }

  function pixelCard(kind, title, sub, value, ph, help) {
    return '<section class="card pixel-card"><div class="pixel-card__head"><span class="pixel-card__logo">' + icon(kind, 22) + '</span><div><h2>' + title + '</h2><p>' + sub + '</p></div>' +
      '<span class="chip ' + (value ? 'chip--ok' : 'chip--off') + '">' + (value ? 'Activo' : 'Sin conectar') + '</span></div>' +
      '<form data-pixel="' + kind + '" novalidate><div class="form-row"><input class="input" name="id" value="' + esc(value) + '" placeholder="' + ph + '" aria-label="' + ph + '" autocomplete="off" spellcheck="false">' +
      '<button class="btn btn--gold" type="submit">Guardar</button></div><p class="form-msg" role="status"></p></form>' +
      '<p class="help">' + help + '</p></section>';
  }

  function describeEvent(e) {
    var where = [e.source || 'Directo', e.device, e.country ? regionName(e.country) : ''].filter(Boolean).join(' · ');
    switch (e.type) {
      case 'pageview': return { ic: 'eye', title: 'Nueva visita', sub: where };
      case 'click': return { ic: 'click', title: 'Clic en ' + clickName(e.label), sub: where };
      case 'form_open': return { ic: 'form', title: 'Abrió el formulario', sub: where };
      case 'section': return { ic: 'page', title: 'Vio ' + (SECTION_NAMES[e.label] || e.label), sub: where };
      case 'scroll': return { ic: 'scroll', title: 'Leyó el ' + e.label + '% de la página', sub: where };
      case 'lead': return { ic: 'lead', title: 'Nuevo lead' + (e.label ? ' · ' + e.label : ''), sub: where, lead: true };
      default: return { ic: 'pixel', title: e.type, sub: where };
    }
  }

  function startFeed() {
    var lastId = 0;
    var first = true;
    var feed = document.getElementById('feed');
    var tick = function () {
      if (!document.getElementById('feed')) return clearInterval(timers.feed);
      api('/api/events/recent?limit=' + (first ? 40 : 30) + '&after=' + lastId).then(function (r) {
        var evs = r.events;
        if (first) feed.innerHTML = evs.length ? '' : '<li class="muted" data-empty>Todavía no hay eventos. Abre la landing en otra pestaña para verlos llegar.</li>';
        if (!evs.length) { first = false; return; }
        var empty = feed.querySelector('[data-empty]');
        if (empty) empty.remove();
        lastId = Math.max(lastId, evs[0].id);
        var html = evs.map(function (e) {
          var d = describeEvent(e);
          return '<li class="' + (first ? '' : 'is-new') + '"><span class="feed__icon' + (d.lead ? ' feed__icon--lead' : '') + '">' + icon(d.ic, 15) + '</span>' +
            '<div class="feed__text"><strong>' + esc(d.title) + '</strong>' + (e.is_demo ? ' <span class="chip chip--demo">Demo</span>' : '') + '<span>' + esc(d.sub) + '</span></div>' +
            '<time>' + (Date.now() - e.created_at < 86400000 ? timeOnly.format(e.created_at) : dateTime.format(e.created_at)) + '</time></li>';
        }).join('');
        feed.insertAdjacentHTML('afterbegin', html);
        while (feed.children.length > 80) feed.lastElementChild.remove();
        if (!first && evs.some(function (e) { return e.type === 'lead'; })) toast('¡Nuevo lead acaba de llegar!');
        first = false;
      }).catch(function () {});
    };
    clearInterval(timers.feed);
    tick();
    timers.feed = setInterval(tick, 4000);
  }

  /* ================================================================ */
  /* AJUSTES                                                           */
  /* ================================================================ */

  function renderAjustes(s) {
    view.innerHTML =
      '<div class="settings">' +
      '<section class="card"><h2>Datos de demostración</h2><p>Carga 30 días de visitas, clics y leads ficticios para explorar el panel antes de tener tráfico real. Todo lo de demostración queda marcado con la etiqueta “Demo” y se borra con un clic, sin tocar tus datos reales.</p>' +
      '<div class="actions"><button class="btn btn--gold" type="button" data-seed>' + (s.hasDemo ? 'Volver a generar la demo' : 'Cargar datos de demostración') + '</button>' +
      '<button class="btn btn--danger" type="button" id="clear-demo"' + (s.hasDemo ? '' : ' disabled') + '>' + icon('trash', 15) + 'Borrar datos de demo</button></div></section>' +
      '<section class="card"><h2>Exportar leads</h2><p>Descarga todos tus leads reales en una planilla (CSV) que abre en Excel o Google Sheets.</p>' +
      '<div class="actions"><a class="btn" href="/api/leads.csv" download>' + icon('download', 15) + 'Descargar CSV</a></div></section>' +
      '<section class="card"><h2>Contraseña del panel</h2><p>La contraseña se define en la variable <code class="help">DASHBOARD_PASSWORD</code>: en tu computadora está en el archivo <code class="help">.dev.vars</code>; al publicar en Cloudflare, se guarda con <code class="help">npx wrangler secret put DASHBOARD_PASSWORD</code>. Al cambiarla, las sesiones abiertas siguen activas hasta que cambies también <code class="help">SESSION_SECRET</code>.</p></section>' +
      '<section class="card"><h2>Sesión</h2><p>La sesión dura 14 días en este navegador.</p><div class="actions"><button class="btn" type="button" data-logout-btn>Cerrar sesión</button></div></section>' +
      '</div>';
    var clear = document.getElementById('clear-demo');
    clear.addEventListener('click', function () {
      confirmDialog('¿Borrar los datos de demostración?', 'Se eliminarán las visitas, clics y leads marcados como Demo. Tus datos reales no se tocan.', 'Borrar demo').then(function (ok) {
        if (!ok) return;
        clear.disabled = true;
        api('/api/demo', { method: 'DELETE' }).then(function () {
          toast('Datos de demostración borrados');
          state.leads = null; state.knownLeadIds = null;
          render(true);
        }).catch(function (err) { toast(err.message); clear.disabled = false; });
      });
    });
    view.querySelector('[data-logout-btn]').addEventListener('click', function () {
      api('/api/logout', { method: 'POST' }).catch(function () {}).then(function () { location.href = '/dashboard/login'; });
    });
  }

  /* ================================================================ */
  /* início                                                            */
  /* ================================================================ */

  buildNav();
  setRangeButtons();
  route();
})();
