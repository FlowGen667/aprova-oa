// Gráficos em SVG/HTML puro para o painel (sem dependências).
// Todos redesenham ao mudar de tamanho e têm tooltip ao passar o mouse/tocar.
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var nf = (function () { try { return new Intl.NumberFormat('es-CO', { useGrouping: 'always' }); } catch (e) { return new Intl.NumberFormat('es-CO'); } })();

  var tip = document.createElement('div');
  tip.className = 'viz-tip';
  tip.setAttribute('role', 'status');
  document.body.appendChild(tip);

  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add('is-on');
    var r = tip.getBoundingClientRect();
    var left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
    var top = y - r.height - 14;
    if (top < 8) top = y + 18;
    tip.style.transform = 'translate(' + left + 'px,' + top + 'px)';
  }
  function hideTip() { tip.classList.remove('is-on'); }

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // escala "bonita" para o eixo Y (1, 2, 5 × 10^n)
  function niceMax(v) {
    if (v <= 0) return 4;
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    var m = nice * exp;
    return m < 4 ? 4 : m;
  }

  // índices que recebem rótulo no eixo X, sem encavalar o último
  function labelIdx(n, iw) {
    var step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 76))));
    var out = [];
    for (var i = 0; i < n; i += step) out.push(i);
    var last = out[out.length - 1];
    if (last !== n - 1) {
      if (n - 1 - last >= step * 0.9) out.push(n - 1);
      else out[out.length - 1] = n - 1;
    }
    return out;
  }
  function anchor(i, n) { return n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'; }

  function observe(container, draw) {
    if (container._ro) container._ro.disconnect();
    var last = 0;
    var ro = new ResizeObserver(function () {
      if (!container.isConnected) { ro.disconnect(); return; }
      var w = container.clientWidth;
      if (w < 80) return; // ainda sem largura (oculto ou montando): espera o próximo resize
      if (Math.abs(w - last) > 2) { last = w; draw(w); }
    });
    ro.observe(container);
    container._ro = ro;
  }

  /* ---------------- área / linha (série temporal) ---------------- */
  // data: [{label, value, title}]
  function area(container, data, opts) {
    opts = opts || {};
    var H = opts.height || 280;
    var fmt = opts.format || function (v) { return nf.format(v); };
    observe(container, function (W) {
      container.innerHTML = '';
      if (!data.length) return;
      var m = { t: 12, r: 12, b: 28, l: 40 };
      var iw = W - m.l - m.r, ih = H - m.t - m.b;
      var max = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; })));
      var x = function (i) { return m.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw); };
      var y = function (v) { return m.t + ih - (v / max) * ih; };
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || '' }, container);

      var gid = 'g' + Math.random().toString(36).slice(2);
      var defs = el('defs', {}, svg);
      var grad = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: '0%', 'stop-color': 'var(--gold)', 'stop-opacity': '.35' }, grad);
      el('stop', { offset: '100%', 'stop-color': 'var(--gold)', 'stop-opacity': '0' }, grad);

      for (var g = 0; g <= 4; g++) {
        var gv = (max / 4) * g;
        el('line', { x1: m.l, x2: W - m.r, y1: y(gv), y2: y(gv), class: 'viz-grid' }, svg);
        el('text', { x: m.l - 8, y: y(gv) + 4, class: 'viz-axis', 'text-anchor': 'end' }, svg).textContent = nf.format(gv);
      }
      labelIdx(data.length, iw).forEach(function (i) {
        el('text', { x: x(i), y: H - 8, class: 'viz-axis', 'text-anchor': anchor(i, data.length) }, svg).textContent = data[i].label;
      });

      var line = data.map(function (d, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(d.value).toFixed(1); }).join('');
      el('path', { d: line + 'L' + x(data.length - 1) + ',' + y(0) + 'L' + x(0) + ',' + y(0) + 'Z', fill: 'url(#' + gid + ')' }, svg);
      var path = el('path', { d: line, class: 'viz-line' }, svg);
      var len = path.getTotalLength ? path.getTotalLength() : 0;
      if (len && !opts.noAnim) {
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        requestAnimationFrame(function () { path.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)'; path.style.strokeDashoffset = 0; });
      }

      var cross = el('line', { y1: m.t, y2: m.t + ih, class: 'viz-cross', opacity: 0 }, svg);
      var dot = el('circle', { r: 5, class: 'viz-dot', opacity: 0 }, svg);
      var hit = el('rect', { x: m.l, y: 0, width: iw, height: H, fill: 'transparent' }, svg);
      function move(ev) {
        var rect = svg.getBoundingClientRect();
        var px = ev.clientX - rect.left;
        var i = Math.round(((px - m.l) / iw) * (data.length - 1));
        i = Math.max(0, Math.min(data.length - 1, i));
        var d = data[i];
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 1);
        dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(d.value)); dot.setAttribute('opacity', 1);
        showTip('<span>' + (d.title || d.label) + '</span><strong>' + fmt(d.value) + '</strong> ' + (opts.unit || ''), rect.left + x(i), rect.top + y(d.value));
      }
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', function () { cross.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); hideTip(); });
    });
  }

  /* ---------------- barras verticais ---------------- */
  function bars(container, data, opts) {
    opts = opts || {};
    var H = opts.height || 220;
    var fmt = opts.format || function (v) { return nf.format(v); };
    observe(container, function (W) {
      container.innerHTML = '';
      if (!data.length) return;
      var m = { t: 12, r: 8, b: 28, l: 36 };
      var iw = W - m.l - m.r, ih = H - m.t - m.b;
      var max = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; })));
      var slot = iw / data.length;
      var bw = Math.max(2, Math.min(28, slot - 2)); // 2px de respiro entre barras
      var y = function (v) { return m.t + ih - (v / max) * ih; };
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || '' }, container);
      for (var g = 0; g <= 4; g++) {
        var gv = (max / 4) * g;
        el('line', { x1: m.l, x2: W - m.r, y1: y(gv), y2: y(gv), class: 'viz-grid' }, svg);
        el('text', { x: m.l - 8, y: y(gv) + 4, class: 'viz-axis', 'text-anchor': 'end' }, svg).textContent = nf.format(gv);
      }
      var labels = labelIdx(data.length, iw);
      data.forEach(function (d, i) {
        var cx = m.l + slot * i + slot / 2;
        var h = Math.max(d.value > 0 ? 2 : 0, ih - (y(d.value) - m.t));
        var r = Math.min(4, bw / 2, h);
        // topo arredondado (4px), base reta apoiada no eixo
        var x0 = cx - bw / 2, y0 = m.t + ih - h, x1 = cx + bw / 2, yb = m.t + ih;
        var dpath = h > 0
          ? 'M' + x0 + ',' + yb + 'V' + (y0 + r) + 'Q' + x0 + ',' + y0 + ' ' + (x0 + r) + ',' + y0 + 'H' + (x1 - r) + 'Q' + x1 + ',' + y0 + ' ' + x1 + ',' + (y0 + r) + 'V' + yb + 'Z'
          : '';
        var bar = el('path', { d: dpath, class: 'viz-bar' }, svg);
        if (!opts.noAnim) { bar.style.transformOrigin = cx + 'px ' + yb + 'px'; bar.style.animation = 'vizGrow .7s cubic-bezier(.2,.7,.2,1) both'; bar.style.animationDelay = (i * 12) + 'ms'; }
        var hit = el('rect', { x: m.l + slot * i, y: m.t, width: slot, height: ih, fill: 'transparent' }, svg);
        var show = function (ev) {
          var rect = svg.getBoundingClientRect();
          bar.classList.add('is-hover');
          showTip('<span>' + (d.title || d.label) + '</span><strong>' + fmt(d.value) + '</strong> ' + (opts.unit || ''), rect.left + cx, rect.top + y0);
        };
        hit.addEventListener('pointermove', show);
        hit.addEventListener('pointerdown', show);
        hit.addEventListener('pointerleave', function () { bar.classList.remove('is-hover'); hideTip(); });
        if (labels.indexOf(i) >= 0) el('text', { x: i === data.length - 1 && data.length > 1 ? m.l + slot * (i + 1) : i === 0 && data.length > 1 ? m.l : cx, y: H - 8, class: 'viz-axis', 'text-anchor': anchor(i, data.length) }, svg).textContent = d.label;
      });
    });
  }

  /* ---------------- lista de barras horizontais ---------------- */
  // rows: [{name, value, extra}]  → extra aparece à direita em texto secundário
  function barList(container, rows, opts) {
    opts = opts || {};
    var fmt = opts.format || function (v) { return nf.format(v); };
    container.innerHTML = '';
    if (!rows.length) { container.innerHTML = '<p class="empty-mini">' + (opts.empty || 'Sin datos en este período.') + '</p>'; return; }
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
    var ul = document.createElement('ul');
    ul.className = 'barlist';
    rows.forEach(function (r, i) {
      var li = document.createElement('li');
      li.innerHTML =
        '<div class="barlist__head"><span class="barlist__name"></span><span class="barlist__val"><strong>' + fmt(r.value) + '</strong>' +
        (r.extra ? '<em>' + r.extra + '</em>' : '') + '</span></div>' +
        '<div class="barlist__track"><i style="--w:' + ((r.value / max) * 100).toFixed(1) + '%;--d:' + i * 40 + 'ms"></i></div>';
      li.querySelector('.barlist__name').textContent = r.name;
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  /* ---------------- funil ---------------- */
  function funnel(container, steps) {
    container.innerHTML = '';
    var first = steps[0] ? steps[0].value || 0 : 0;
    var ol = document.createElement('ol');
    ol.className = 'funnel';
    steps.forEach(function (s, i) {
      var pct = first ? (s.value / first) * 100 : 0;
      var prev = i ? steps[i - 1].value : 0;
      var stepPct = i && prev ? Math.round((s.value / prev) * 100) : null;
      var li = document.createElement('li');
      li.innerHTML =
        '<div class="funnel__row"><span class="funnel__name"></span><strong>' + nf.format(s.value) + '</strong></div>' +
        '<div class="funnel__track"><i style="--w:' + Math.max(pct, s.value ? 2 : 0).toFixed(1) + '%;--d:' + i * 90 + 'ms"></i></div>' +
        '<div class="funnel__meta">' + (i ? '<span>' + (stepPct === null ? '—' : stepPct + '% del paso anterior') + '</span>' : '<span>Punto de partida</span>') +
        '<span>' + (first ? pct.toFixed(pct < 10 && pct > 0 ? 1 : 0) : 0) + '% del total</span></div>';
      li.querySelector('.funnel__name').textContent = s.name;
      ol.appendChild(li);
    });
    container.appendChild(ol);
  }

  /* ---------------- mapa de calor (dia × hora) ---------------- */
  function heatmap(container, cells) {
    var days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    var order = [1, 2, 3, 4, 5, 6, 0];
    var grid = {};
    var max = 0;
    cells.forEach(function (c) { grid[c.dow + '-' + c.hour] = c.n; if (c.n > max) max = c.n; });
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'heat';
    var html = '<div class="heat__corner"></div>';
    for (var h = 0; h < 24; h++) html += '<div class="heat__hour">' + (h % 3 === 0 ? h + 'h' : '') + '</div>';
    order.forEach(function (d) {
      html += '<div class="heat__day">' + days[d] + '</div>';
      for (var h2 = 0; h2 < 24; h2++) {
        var n = grid[d + '-' + h2] || 0;
        var lvl = n === 0 ? 0 : Math.min(5, Math.ceil((n / (max || 1)) * 5));
        html += '<div class="heat__cell" data-l="' + lvl + '" data-tip="' + days[d] + ' ' + h2 + ':00 – ' + h2 + ':59 · ' + nf.format(n) + ' visitas"></div>';
      }
    });
    wrap.innerHTML = html;
    wrap.addEventListener('pointermove', function (e) {
      var c = e.target.closest('.heat__cell');
      if (!c) return hideTip();
      var r = c.getBoundingClientRect();
      showTip(c.getAttribute('data-tip'), r.left + r.width / 2, r.top);
    });
    wrap.addEventListener('pointerleave', hideTip);
    container.appendChild(wrap);
    var legend = document.createElement('div');
    legend.className = 'heat__legend';
    legend.innerHTML = '<span>Menos</span>' + [0, 1, 2, 3, 4, 5].map(function (l) { return '<i data-l="' + l + '"></i>'; }).join('') + '<span>Más</span>';
    container.appendChild(legend);
  }

  window.YGCharts = { area: area, bars: bars, barList: barList, funnel: funnel, heatmap: heatmap, hideTip: hideTip };
})();
