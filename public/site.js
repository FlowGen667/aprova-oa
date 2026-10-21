// Rastreamento próprio + pixels (Meta/GA4) + popup de cadastro da landing.
(function () {
  'use strict';

  /* ---------------- identificação e origem ---------------- */

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function getOrSet(storage, key, make) {
    var s = store(storage);
    try {
      var v = s && s.getItem(key);
      if (!v) { v = make(); if (s) s.setItem(key, v); }
      return v;
    } catch (e) { return make(); }
  }
  function uid() {
    return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  }

  var vid = getOrSet('localStorage', 'yg_vid', uid);
  var sid = getOrSet('sessionStorage', 'yg_sid', uid);

  // origem da visita: UTM tem prioridade; senão, o site de onde a pessoa veio
  function detectSource() {
    var p = new URLSearchParams(location.search);
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    if (ref === location.hostname) ref = '';
    var known = [
      [/instagram/, 'Instagram'], [/facebook|fb\.|fb\.me|m\.me/, 'Facebook'], [/tiktok/, 'TikTok'],
      [/youtube|youtu\.be/, 'YouTube'], [/whatsapp|wa\.me/, 'WhatsApp'], [/t\.co|twitter|x\.com/, 'X'],
      [/google\./, 'Google'], [/bing\./, 'Bing'], [/linkedin|lnkd/, 'LinkedIn'], [/pinterest/, 'Pinterest'], [/hotmart/, 'Hotmart']
    ];
    var src = p.get('utm_source') || '';
    if (src) {
      for (var i = 0; i < known.length; i++) if (known[i][0].test(src.toLowerCase())) { src = known[i][1]; break; }
    } else if (ref) {
      src = ref;
      for (var j = 0; j < known.length; j++) if (known[j][0].test(ref)) { src = known[j][1]; break; }
    }
    return {
      source: src,
      medium: p.get('utm_medium') || (ref ? (/google|bing/.test(ref) ? 'organic' : 'referral') : ''),
      campaign: p.get('utm_campaign') || '',
      referrer: ref
    };
  }
  // guarda a primeira origem da sessão (ela continua valendo se a pessoa navegar por âncoras)
  var origin = (function () {
    var s = store('sessionStorage');
    try {
      var saved = s && s.getItem('yg_origin');
      if (saved) return JSON.parse(saved);
      var o = detectSource();
      if (s) s.setItem('yg_origin', JSON.stringify(o));
      return o;
    } catch (e) { return detectSource(); }
  })();

  /* ---------------- envio de eventos ---------------- */

  function send(type, label) {
    var payload = JSON.stringify({
      type: type, label: label || '', vid: vid, sid: sid,
      source: origin.source, medium: origin.medium, campaign: origin.campaign, referrer: origin.referrer
    });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/track', payload)) return;
    } catch (e) {}
    fetch('/api/track', { method: 'POST', body: payload, keepalive: true }).catch(function () {});
  }

  var pixel = { meta: false, ga: false };
  function fbq() { if (pixel.meta && window.fbq) window.fbq.apply(null, arguments); }
  function gtag() { if (pixel.ga && window.gtag) window.gtag.apply(null, arguments); }

  window.ygTrack = send;

  /* ---------------- pixels (ids vêm do painel) ---------------- */

  fetch('/api/config').then(function (r) { return r.ok ? r.json() : {}; }).then(function (cfg) {
    if (cfg.metaPixelId) {
      /* eslint-disable */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', cfg.metaPixelId);
      pixel.meta = true;
      fbq('track', 'PageView');
    }
    if (cfg.ga4Id) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga4Id);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', cfg.ga4Id);
      pixel.ga = true;
    }
  }).catch(function () {});

  /* ---------------- visita, seções e rolagem ---------------- */

  send('pageview');

  if ('IntersectionObserver' in window) {
    var seen = {};
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var id = e.target.id;
        if (e.isIntersecting && !seen[id]) { seen[id] = true; send('section', id); so.unobserve(e.target); }
      });
    }, { threshold: 0.35 });
    document.querySelectorAll('section[id]').forEach(function (el) { so.observe(el); });
  }

  var marks = [25, 50, 75, 100], hit = {};
  window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (h <= 0) return;
    var pct = (scrollY / h) * 100;
    marks.forEach(function (m) { if (pct >= m - 1 && !hit[m]) { hit[m] = true; send('scroll', String(m)); } });
  }, { passive: true });

  /* ---------------- cliques ---------------- */

  var interest = '';
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (!el) return;
    var label = el.getAttribute('data-track');
    send('click', label);
    if (label.indexOf('curso:') === 0) {
      interest = label.slice(6);
      fbq('track', 'ViewContent', { content_name: interest });
      gtag('event', 'view_item', { item_name: interest });
    }
    // botões sem link de destino abrem o cadastro
    if (el.hasAttribute('data-open-form') || el.getAttribute('href') === '#') {
      e.preventDefault();
      openForm(el, label.indexOf('curso:') === 0 ? interest : '');
    }
  });

  /* ---------------- popup de cadastro ---------------- */

  var modal = document.getElementById('lead-modal');
  if (!modal) return;
  var form = modal.querySelector('form');
  var panel = modal.querySelector('.modal__panel');
  var interestEl = modal.querySelector('[data-interest]');
  var statusEl = modal.querySelector('[data-status]');
  var submitBtn = form.querySelector('button[type="submit"]');
  var countrySel = form.querySelector('select[name="cc"]');
  var lastFocus = null;

  // sugere o código do país pelo fuso horário do aparelho
  (function guessCountry() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    var map = {
      Bogota: '+57', Mexico_City: '+52', Monterrey: '+52', Cancun: '+52', Tijuana: '+52', Lima: '+51', Guayaquil: '+593',
      Caracas: '+58', Santiago: '+56', Buenos_Aires: '+54', Costa_Rica: '+506', Panama: '+507', Guatemala: '+502',
      El_Salvador: '+503', Tegucigalpa: '+504', Managua: '+505', La_Paz: '+591', Asuncion: '+595', Montevideo: '+598',
      Santo_Domingo: '+1', Puerto_Rico: '+1', New_York: '+1', Chicago: '+1', Los_Angeles: '+1', Denver: '+1', Phoenix: '+1',
      Madrid: '+34', Sao_Paulo: '+55'
    };
    var city = tz.split('/').pop();
    if (map[city]) countrySel.value = map[city];
  })();

  function openForm(trigger, course) {
    lastFocus = trigger || document.activeElement;
    interest = course || interest;
    form.elements.interest.value = course || '';
    interestEl.hidden = !course;
    if (course) interestEl.querySelector('strong').textContent = course;
    modal.hidden = false;
    document.documentElement.classList.add('modal-open');
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
    setTimeout(function () { form.elements.name.focus(); }, 60);
    send('form_open', course ? 'curso' : 'cierre');
    fbq('track', 'InitiateCheckout');
    gtag('event', 'begin_checkout');
  }

  function closeForm() {
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('modal-open');
    setTimeout(function () {
      modal.hidden = true;
      modal.classList.remove('is-done');
      form.reset();
      clearErrors();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }, 260);
  }

  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]') || e.target === modal) closeForm();
  });
  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeForm();
    if (e.key === 'Tab') {
      // mantém o foco dentro do popup
      var f = panel.querySelectorAll('button, input, select, a[href]');
      var list = Array.prototype.filter.call(f, function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function clearErrors() {
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('has-error'); });
    form.querySelectorAll('.field__error').forEach(function (el) { el.textContent = ''; });
    statusEl.textContent = '';
  }
  function setError(name, msg) {
    var field = form.querySelector('[data-field="' + name + '"]');
    if (!field) return;
    field.classList.add('has-error');
    field.querySelector('.field__error').textContent = msg;
  }

  function validate(data) {
    var errs = {};
    if (data.name.trim().length < 2) errs.name = 'Escribe tu nombre.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) errs.email = 'Escribe un email válido.';
    if (data.phone.replace(/\D/g, '').length < 7) errs.phone = 'Escribe tu número de teléfono.';
    return errs;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    var data = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      phone: form.elements.phone.value,
      website: form.elements.website.value
    };
    var errs = validate(data);
    var keys = Object.keys(errs);
    if (keys.length) {
      keys.forEach(function (k) { setError(k, errs[k]); });
      form.elements[keys[0]].focus();
      return;
    }
    var phone = countrySel.value + data.phone.replace(/[^\d]/g, '').replace(/^0+/, '');
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name, email: data.email, phone: phone, website: data.website,
        interest: form.elements.interest.value, vid: vid, sid: sid,
        source: origin.source, medium: origin.medium, campaign: origin.campaign, referrer: origin.referrer
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          if (res.body && res.body.fields) Object.keys(res.body.fields).forEach(function (k) { setError(k, res.body.fields[k]); });
          statusEl.textContent = (res.body && res.body.error) || 'No pudimos enviar tus datos. Inténtalo de nuevo.';
          return;
        }
        fbq('track', 'Lead');
        gtag('event', 'generate_lead');
        modal.classList.add('is-done');
        modal.querySelector('[data-done-title]').focus();
      })
      .catch(function () {
        statusEl.textContent = 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
      })
      .then(function () {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      });
  });
})();
