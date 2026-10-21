// Worker da landing de Yamileth Gill.
// - /api/*        → rastreamento público, captura de leads e API autenticada do painel
// - /dashboard/*  → painel protegido por senha (cookie de sessão assinado)
// - resto         → arquivos estáticos de ./public

const STAGES = ['nuevo', 'contactado', 'negociando', 'cliente', 'perdido'];
const EVENT_TYPES = ['pageview', 'click', 'form_open', 'section', 'scroll'];
const SESSION_COOKIE = 'yg_session';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 14; // 14 dias
const DAY = 86400000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path.startsWith('/api/')) return await handleApi(request, env, url);
      if (path === '/dashboard' || path.startsWith('/dashboard/')) return await handleDashboard(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      return json({ error: 'Error interno del servidor' }, 500);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

async function handleDashboard(request, env, url) {
  const path = url.pathname;
  const isPublicAsset = path.startsWith('/dashboard/assets/');
  const isLogin = path === '/dashboard/login' || path === '/dashboard/login.html';
  if (isPublicAsset) return env.ASSETS.fetch(request);

  const authed = await isAuthed(request, env);
  if (isLogin) {
    if (authed) return redirect(url, '/dashboard');
    return env.ASSETS.fetch(new Request(new URL('/dashboard/login', url), request));
  }
  if (!authed) return redirect(url, '/dashboard/login');
  // SPA com rotas por hash: qualquer /dashboard/* devolve o index do painel
  const res = await env.ASSETS.fetch(new Request(new URL('/dashboard/', url), request));
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-store');
  return out;
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;

  // públicas
  if (path === '/api/track' && method === 'POST') return track(request, env);
  if (path === '/api/lead' && method === 'POST') return createLead(request, env);
  if (path === '/api/config' && method === 'GET') return publicConfig(env);
  if (path === '/api/login' && method === 'POST') return login(request, env, url);
  if (path === '/api/logout' && method === 'POST') return logout(url);

  // daqui pra baixo, só com sessão
  if (!(await isAuthed(request, env))) return json({ error: 'No autorizado' }, 401);

  if (path === '/api/me' && method === 'GET') return json({ ok: true });
  if (path === '/api/stats' && method === 'GET') return stats(env, url);
  if (path === '/api/events/recent' && method === 'GET') return recentEvents(env, url);
  if (path === '/api/leads' && method === 'GET') return listLeads(env, url);
  if (path === '/api/leads.csv' && method === 'GET') return exportLeads(env);
  if (path === '/api/settings' && method === 'GET') return getSettings(env);
  if (path === '/api/settings' && method === 'PUT') return putSettings(request, env);
  if (path === '/api/demo' && method === 'POST') return seedDemo(env);
  if (path === '/api/demo' && method === 'DELETE') return clearDemo(env);

  const m = path.match(/^\/api\/leads\/(\d+)(\/notes)?$/);
  if (m) {
    const id = Number(m[1]);
    if (m[2] && method === 'POST') return addNote(request, env, id);
    if (!m[2] && method === 'GET') return getLead(env, id);
    if (!m[2] && method === 'PATCH') return updateLead(request, env, id);
    if (!m[2] && method === 'DELETE') return deleteLead(env, id);
  }
  return json({ error: 'Ruta no encontrada' }, 404);
}

/* ---------- rastreamento ---------- */

async function track(request, env) {
  const body = await readJson(request);
  if (!body || !EVENT_TYPES.includes(body.type)) return new Response(null, { status: 204 });
  const ctx = requestContext(request);
  await env.DB.prepare(
    `INSERT INTO events (type, label, visitor_id, session_id, source, medium, campaign, referrer, device, browser, country, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.type, clip(body.label, 160), clip(body.vid, 64), clip(body.sid, 64),
    clip(body.source, 80), clip(body.medium, 80), clip(body.campaign, 120), clip(body.referrer, 200),
    ctx.device, ctx.browser, ctx.country, Date.now()
  ).run();
  return new Response(null, { status: 204 });
}

async function createLead(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: 'Datos inválidos' }, 400);
  if (body.website) return json({ ok: true }); // honeypot: robô preencheu o campo escondido

  const name = clip(String(body.name || '').trim(), 80);
  const email = clip(String(body.email || '').trim().toLowerCase(), 120);
  const phone = clip(String(body.phone || '').replace(/[^\d+]/g, ''), 20);
  const errors = {};
  if (name.length < 2) errors.name = 'Escribe tu nombre.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Escribe un email válido.';
  if (phone.replace(/\D/g, '').length < 8) errors.phone = 'Escribe un teléfono válido con código de país.';
  if (Object.keys(errors).length) return json({ error: 'Revisa los campos marcados.', fields: errors }, 422);

  const ctx = requestContext(request);
  const now = Date.now();
  const src = {
    source: clip(body.source, 80), medium: clip(body.medium, 80), campaign: clip(body.campaign, 120),
    referrer: clip(body.referrer, 200), interest: clip(body.interest, 120),
  };

  // mesmo email de novo: atualiza o lead existente em vez de duplicar no CRM
  const existing = await env.DB.prepare('SELECT id FROM leads WHERE email = ? AND is_demo = 0 ORDER BY id DESC LIMIT 1').bind(email).first();
  let leadId;
  if (existing) {
    leadId = existing.id;
    await env.DB.batch([
      env.DB.prepare(`UPDATE leads SET name = ?, phone = ?, interest = CASE WHEN ? <> '' THEN ? ELSE interest END, updated_at = ? WHERE id = ?`)
        .bind(name, phone, src.interest, src.interest, now, leadId),
      env.DB.prepare('INSERT INTO lead_activity (lead_id, kind, text, created_at) VALUES (?, ?, ?, ?)')
        .bind(leadId, 'registro', 'Volvió a enviar el formulario' + (src.interest ? ` (interés: ${src.interest})` : ''), now),
    ]);
  } else {
    const res = await env.DB.prepare(
      `INSERT INTO leads (name, email, phone, interest, source, medium, campaign, referrer, device, country, visitor_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(name, email, phone, src.interest, src.source, src.medium, src.campaign, src.referrer,
      ctx.device, ctx.country, clip(body.vid, 64), now, now).run();
    leadId = res.meta.last_row_id;
    await env.DB.prepare('INSERT INTO lead_activity (lead_id, kind, text, created_at) VALUES (?, ?, ?, ?)')
      .bind(leadId, 'registro', 'Se registró en la landing' + (src.interest ? ` (interés: ${src.interest})` : ''), now).run();
  }

  await env.DB.prepare(
    `INSERT INTO events (type, label, visitor_id, session_id, source, medium, campaign, referrer, device, browser, country, created_at)
     VALUES ('lead', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(src.interest, clip(body.vid, 64), clip(body.sid, 64), src.source, src.medium, src.campaign, src.referrer,
    ctx.device, ctx.browser, ctx.country, now).run();

  return json({ ok: true, id: leadId });
}

async function publicConfig(env) {
  const s = await settingsMap(env);
  return json(
    { metaPixelId: s.meta_pixel_id || '', ga4Id: s.ga4_id || '' },
    200,
    { 'Cache-Control': 'public, max-age=60' }
  );
}

/* ---------- login ---------- */

async function login(request, env, url) {
  if (!env.DASHBOARD_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: 'Configura DASHBOARD_PASSWORD y SESSION_SECRET en .dev.vars.' }, 500);
  }
  const body = await readJson(request);
  const ok = body && (await safeEqual(String(body.password || ''), env.DASHBOARD_PASSWORD));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // freia tentativas de força bruta
    return json({ error: 'Contraseña incorrecta.' }, 401);
  }
  const exp = Date.now() + SESSION_TTL;
  const token = `${exp}.${await hmac(env.SESSION_SECRET, String(exp))}`;
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(url, token, SESSION_TTL / 1000) });
}

function logout(url) {
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(url, '', 0) });
}

function sessionCookie(url, value, maxAge) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge)}${secure}`;
}

async function isAuthed(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(env.SESSION_SECRET, exp));
}

/* ---------- estatísticas ---------- */

async function stats(env, url) {
  const days = clampInt(url.searchParams.get('days'), 0, 3650, 30);
  const tz = clampInt(url.searchParams.get('tz'), -840, 840, 0); // minutos em relação ao UTC
  const now = Date.now();
  const since = days ? now - days * DAY : 0;
  const prevSince = days ? since - days * DAY : 0;
  const shift = tz * 60; // segundos
  const db = env.DB;

  const kpiSql = `SELECT
      COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor_id END) AS visitors,
      COALESCE(SUM(type = 'pageview'), 0) AS pageviews,
      COUNT(DISTINCT CASE WHEN type = 'pageview' THEN session_id END) AS sessions,
      COALESCE(SUM(type = 'click'), 0) AS clicks,
      COUNT(DISTINCT CASE WHEN type = 'click' THEN visitor_id END) AS clickers,
      COUNT(DISTINCT CASE WHEN type = 'form_open' THEN visitor_id END) AS form_opens,
      COUNT(DISTINCT CASE WHEN type = 'section' AND label = 'cursos' THEN visitor_id END) AS saw_catalog
    FROM events WHERE created_at >= ? AND created_at < ?`;
  const leadKpiSql = `SELECT COUNT(*) AS leads,
      COALESCE(SUM(stage = 'cliente'), 0) AS customers,
      COALESCE(SUM(CASE WHEN stage = 'cliente' THEN value ELSE 0 END), 0) AS revenue
    FROM leads WHERE created_at >= ? AND created_at < ?`;
  const dayExpr = `strftime('%Y-%m-%d', created_at / 1000 + ${shift}, 'unixepoch')`;

  const q = [
    db.prepare(kpiSql).bind(since, now),
    db.prepare(kpiSql).bind(prevSince, days ? since : 0),
    db.prepare(leadKpiSql).bind(since, now),
    db.prepare(leadKpiSql).bind(prevSince, days ? since : 0),
    db.prepare(`SELECT ${dayExpr} AS day,
        COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor_id END) AS visitors,
        COALESCE(SUM(type = 'pageview'), 0) AS pageviews,
        COALESCE(SUM(type = 'click'), 0) AS clicks
      FROM events WHERE created_at >= ? GROUP BY day ORDER BY day`).bind(since),
    db.prepare(`SELECT ${dayExpr} AS day, COUNT(*) AS leads FROM leads WHERE created_at >= ? GROUP BY day ORDER BY day`).bind(since),
    db.prepare(`SELECT CASE WHEN source = '' THEN 'Directo' ELSE source END AS name, COUNT(DISTINCT visitor_id) AS visitors
      FROM events WHERE type = 'pageview' AND created_at >= ? GROUP BY name ORDER BY visitors DESC LIMIT 10`).bind(since),
    // alias "src" (e não "name") porque leads já tem uma coluna name
    db.prepare(`SELECT CASE WHEN source = '' THEN 'Directo' ELSE source END AS src, COUNT(*) AS leads
      FROM leads WHERE created_at >= ? GROUP BY src`).bind(since),
    db.prepare(`SELECT CASE WHEN device = '' THEN 'Otro' ELSE device END AS name, COUNT(DISTINCT visitor_id) AS visitors
      FROM events WHERE type = 'pageview' AND created_at >= ? GROUP BY name ORDER BY visitors DESC`).bind(since),
    db.prepare(`SELECT CASE WHEN browser = '' THEN 'Otro' ELSE browser END AS name, COUNT(DISTINCT visitor_id) AS visitors
      FROM events WHERE type = 'pageview' AND created_at >= ? GROUP BY name ORDER BY visitors DESC LIMIT 8`).bind(since),
    db.prepare(`SELECT CASE WHEN country = '' THEN '??' ELSE country END AS name, COUNT(DISTINCT visitor_id) AS visitors
      FROM events WHERE type = 'pageview' AND created_at >= ? GROUP BY name ORDER BY visitors DESC LIMIT 10`).bind(since),
    db.prepare(`SELECT label AS name, COUNT(*) AS clicks, COUNT(DISTINCT visitor_id) AS unique_clicks
      FROM events WHERE type = 'click' AND created_at >= ? GROUP BY label ORDER BY clicks DESC LIMIT 30`).bind(since),
    db.prepare(`SELECT CAST(strftime('%w', created_at / 1000 + ${shift}, 'unixepoch') AS INTEGER) AS dow,
        CAST(strftime('%H', created_at / 1000 + ${shift}, 'unixepoch') AS INTEGER) AS hour,
        COUNT(*) AS n
      FROM events WHERE type = 'pageview' AND created_at >= ? GROUP BY dow, hour`).bind(since),
    db.prepare(`SELECT label AS name, COUNT(DISTINCT visitor_id) AS visitors
      FROM events WHERE type = 'scroll' AND created_at >= ? GROUP BY label`).bind(since),
    db.prepare(`SELECT label AS name, COUNT(DISTINCT visitor_id) AS visitors
      FROM events WHERE type = 'section' AND created_at >= ? GROUP BY label`).bind(since),
    db.prepare(`SELECT campaign AS name, medium, source,
        COUNT(DISTINCT visitor_id) AS visitors
      FROM events WHERE type = 'pageview' AND campaign <> '' AND created_at >= ?
      GROUP BY campaign, medium, source ORDER BY visitors DESC LIMIT 15`).bind(since),
    db.prepare(`SELECT campaign AS camp, COUNT(*) AS leads FROM leads WHERE campaign <> '' AND created_at >= ? GROUP BY campaign`).bind(since),
    db.prepare(`SELECT type, label, COUNT(*) AS n FROM events WHERE created_at >= ? GROUP BY type, label`).bind(since),
    db.prepare(`SELECT stage, COUNT(*) AS n FROM leads GROUP BY stage`),
    db.prepare(`SELECT id, name, email, phone, stage, source, interest, is_demo, created_at FROM leads ORDER BY created_at DESC LIMIT 6`),
    db.prepare(`SELECT COUNT(*) AS n FROM events WHERE is_demo = 1`),
  ];
  const r = (await db.batch(q)).map((x) => x.results || []);

  const leadsBySource = Object.fromEntries(r[7].map((x) => [x.src, x.leads]));
  const leadsByCampaign = Object.fromEntries(r[16].map((x) => [x.camp, x.leads]));
  const pixel = { PageView: 0, ViewContent: 0, InitiateCheckout: 0, Lead: 0 };
  for (const row of r[17]) {
    if (row.type === 'pageview') pixel.PageView += row.n;
    else if (row.type === 'click' && row.label.startsWith('curso:')) pixel.ViewContent += row.n;
    else if (row.type === 'form_open') pixel.InitiateCheckout += row.n;
  }
  pixel.Lead = r[2][0]?.leads || 0;

  return json({
    range: { days, since, now, tz },
    kpis: { ...r[0][0], ...r[2][0] },
    prev: days ? { ...r[1][0], ...r[3][0] } : null,
    series: mergeSeries(r[4], r[5], since || firstDay(r[4], r[5]), now, shift),
    sources: r[6].map((x) => ({ ...x, leads: leadsBySource[x.name] || 0 })),
    devices: r[8],
    browsers: r[9],
    countries: r[10],
    clicks: r[11],
    heatmap: r[12],
    scroll: r[13],
    sections: r[14],
    campaigns: r[15].map((x) => ({ ...x, leads: leadsByCampaign[x.name] || 0 })),
    pixel,
    stages: Object.fromEntries(STAGES.map((s) => [s, r[18].find((x) => x.stage === s)?.n || 0])),
    recentLeads: r[19],
    hasDemo: (r[20][0]?.n || 0) > 0,
  });
}

function firstDay(a, b) {
  const days = [...a, ...b].map((x) => x.day).sort();
  return days.length ? Date.parse(days[0] + 'T00:00:00Z') : Date.now() - 6 * DAY;
}

// preenche os dias sem dados com zero, para o gráfico não "pular" datas
function mergeSeries(ev, leads, from, to, shift) {
  const map = new Map();
  const key = (ms) => new Date(ms + shift * 1000).toISOString().slice(0, 10);
  for (let t = from; t <= to + DAY; t += DAY) {
    const k = key(t);
    if (k > key(to)) break;
    map.set(k, { day: k, visitors: 0, pageviews: 0, clicks: 0, leads: 0 });
  }
  for (const e of ev) if (map.has(e.day)) Object.assign(map.get(e.day), { visitors: e.visitors, pageviews: e.pageviews, clicks: e.clicks });
  for (const l of leads) if (map.has(l.day)) map.get(l.day).leads = l.leads;
  return [...map.values()];
}

async function recentEvents(env, url) {
  const limit = clampInt(url.searchParams.get('limit'), 1, 200, 40);
  const after = clampInt(url.searchParams.get('after'), 0, Number.MAX_SAFE_INTEGER, 0);
  const { results } = await env.DB.prepare(
    `SELECT id, type, label, source, device, browser, country, is_demo, created_at
     FROM events WHERE id > ? ORDER BY id DESC LIMIT ?`
  ).bind(after, limit).all();
  return json({ events: results });
}

/* ---------- CRM ---------- */

async function listLeads(env, url) {
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  let sql = `SELECT id, name, email, phone, stage, course, value, interest, source, medium, campaign, device, country, is_demo, notes_count, created_at, updated_at
    FROM (SELECT l.*, (SELECT COUNT(*) FROM lead_activity a WHERE a.lead_id = l.id AND a.kind = 'nota') AS notes_count FROM leads l)`;
  const binds = [];
  if (q) {
    sql += ' WHERE lower(name) LIKE ? OR email LIKE ? OR phone LIKE ?';
    binds.push(`%${q}%`, `%${q}%`, `%${q.replace(/\D/g, '') || q}%`);
  }
  sql += ' ORDER BY updated_at DESC LIMIT 2000';
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return json({ leads: results });
}

async function getLead(env, id) {
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  if (!lead) return json({ error: 'Lead no encontrado' }, 404);
  const { results } = await env.DB.prepare('SELECT * FROM lead_activity WHERE lead_id = ? ORDER BY created_at DESC').bind(id).all();
  return json({ lead, activity: results });
}

async function updateLead(request, env, id) {
  const body = await readJson(request);
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  if (!lead || !body) return json({ error: 'Lead no encontrado' }, 404);
  const now = Date.now();
  const sets = [];
  const binds = [];
  const log = [];
  if (body.stage !== undefined && body.stage !== lead.stage) {
    if (!STAGES.includes(body.stage)) return json({ error: 'Etapa inválida' }, 400);
    sets.push('stage = ?'); binds.push(body.stage);
    log.push(['etapa', `${lead.stage} → ${body.stage}`]);
  }
  if (body.course !== undefined && body.course !== lead.course) {
    sets.push('course = ?'); binds.push(clip(body.course, 120));
    log.push(['curso', body.course ? `Curso: ${body.course}` : 'Curso removido']);
  }
  if (body.value !== undefined) {
    const v = Math.max(0, Number(body.value) || 0);
    if (v !== lead.value) { sets.push('value = ?'); binds.push(v); }
  }
  for (const f of ['name', 'email', 'phone']) {
    if (body[f] !== undefined && String(body[f]).trim() && body[f] !== lead[f]) {
      sets.push(`${f} = ?`); binds.push(clip(String(body[f]).trim(), 120));
    }
  }
  if (!sets.length) return json({ ok: true });
  sets.push('updated_at = ?'); binds.push(now);
  const stmts = [env.DB.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id)];
  for (const [kind, text] of log) {
    stmts.push(env.DB.prepare('INSERT INTO lead_activity (lead_id, kind, text, created_at) VALUES (?, ?, ?, ?)').bind(id, kind, text, now));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}

async function addNote(request, env, id) {
  const body = await readJson(request);
  const text = clip(String(body?.text || '').trim(), 2000);
  if (!text) return json({ error: 'La nota está vacía' }, 400);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO lead_activity (lead_id, kind, text, created_at) VALUES (?, ?, ?, ?)').bind(id, 'nota', text, now),
    env.DB.prepare('UPDATE leads SET updated_at = ? WHERE id = ?').bind(now, id),
  ]);
  return json({ ok: true });
}

async function deleteLead(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lead_activity WHERE lead_id = ?').bind(id),
    env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

async function exportLeads(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, phone, stage, course, value, interest, source, medium, campaign, device, country, created_at
     FROM leads WHERE is_demo = 0 ORDER BY created_at DESC`
  ).all();
  const cols = ['id', 'nombre', 'email', 'telefono', 'etapa', 'curso', 'valor', 'interes', 'fuente', 'medio', 'campana', 'dispositivo', 'pais', 'fecha'];
  const esc = (v) => {
    const s = String(v ?? '');
    // evita injeção de fórmula ao abrir no Excel/Sheets
    const safe = /^[=+\-@]/.test(s) && !/^\+\d+$/.test(s) ? `'${s}` : s;
    return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = results.map((r) => [r.id, r.name, r.email, r.phone, r.stage, r.course, r.value, r.interest, r.source, r.medium, r.campaign, r.device, r.country, new Date(r.created_at).toISOString()].map(esc).join(','));
  return new Response('﻿' + [cols.join(','), ...rows].join('\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}

/* ---------- configurações ---------- */

async function settingsMap(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

async function getSettings(env) {
  return json({ settings: await settingsMap(env) });
}

async function putSettings(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: 'Datos inválidos' }, 400);
  const allowed = {
    meta_pixel_id: (v) => /^\d{0,20}$/.test(v),
    ga4_id: (v) => v === '' || /^G-[A-Z0-9]{4,15}$/i.test(v),
  };
  const stmts = [];
  for (const [k, check] of Object.entries(allowed)) {
    if (body[k] === undefined) continue;
    const v = String(body[k]).trim();
    if (!check(v)) return json({ error: k === 'ga4_id' ? 'El ID de GA4 empieza con G- (ej.: G-ABC123XYZ).' : 'El ID del Pixel de Meta solo tiene números.' }, 400);
    stmts.push(env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, settings: await settingsMap(env) });
}

/* ---------- dados de demonstração ---------- */

async function seedDemo(env) {
  await clearDemo(env);
  const rnd = mulberry32(Date.now() % 100000);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const weighted = (pairs) => {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let x = rnd() * total;
    for (const [v, w] of pairs) { if ((x -= w) <= 0) return v; }
    return pairs[0][0];
  };
  const sources = [
    [['Instagram', 'social', 'bio'], 38], [['Directo', '', ''], 18], [['TikTok', 'social', 'video-reels'], 14],
    [['Facebook', 'social', ''], 10], [['Google', 'organic', ''], 9], [['WhatsApp', 'social', 'lista-vip'], 7], [['YouTube', 'social', ''], 4],
  ];
  const devices = [['Móvil', 72], ['Escritorio', 24], ['Tableta', 4]];
  const browsers = [['Chrome', 52], ['Safari', 30], ['Instagram', 9], ['Edge', 5], ['Firefox', 4]];
  const countries = [['CO', 26], ['MX', 22], ['PE', 11], ['EC', 9], ['US', 9], ['VE', 7], ['CL', 6], ['AR', 5], ['ES', 5]];
  const courses = ['Workshop Ruta 3x Express', 'Inmersión Desafío Next + Ebook', 'Workshop Orgánico', 'EduNetFlix (1.0)', 'Código 500', 'Método Red', 'Método Hacking Sales', 'Código Millonario', 'Escala Afiliados', 'Liga de Afiliadas'];
  const prices = { 'Workshop Ruta 3x Express': 84, 'Inmersión Desafío Next + Ebook': 112, 'Código 500': 1092, 'Método Red': 2754, 'Código Millonario': 1262, 'Escala Afiliados': 2754, 'Liga de Afiliadas': 6647 };
  const first = ['Valentina', 'Camila', 'Daniela', 'María José', 'Andrea', 'Carolina', 'Paola', 'Natalia', 'Laura', 'Gabriela', 'Juliana', 'Sofía', 'Luisa', 'Diana', 'Mónica', 'Fernanda', 'Ana', 'Lucía', 'Isabel', 'Carlos', 'Andrés', 'Javier'];
  const last = ['García', 'Rodríguez', 'Martínez', 'López', 'Hernández', 'Gómez', 'Díaz', 'Torres', 'Ramírez', 'Vargas', 'Castro', 'Rojas', 'Morales', 'Ortiz', 'Silva', 'Mendoza'];
  const codes = { CO: '+57', MX: '+52', PE: '+51', EC: '+593', US: '+1', VE: '+58', CL: '+56', AR: '+54', ES: '+34' };

  const events = [];
  const leads = [];
  const now = Date.now();
  for (let d = 29; d >= 0; d--) {
    const dayStart = now - d * DAY - (now % DAY);
    const weekday = new Date(dayStart).getUTCDay();
    const base = 45 + Math.round((29 - d) * 1.6) + (weekday === 0 || weekday === 6 ? -10 : 0);
    const visitors = Math.max(12, Math.round(base + (rnd() - 0.5) * 30));
    for (let v = 0; v < visitors; v++) {
      const vid = 'demo-' + Math.floor(rnd() * 1e12).toString(36);
      const sid = vid + '-s';
      const [source, medium, campaign] = weighted(sources);
      const device = weighted(devices);
      const browser = weighted(browsers);
      const country = weighted(countries);
      const hour = weighted([[8, 2], [10, 3], [12, 4], [13, 5], [15, 4], [18, 6], [19, 8], [20, 9], [21, 8], [22, 5], [23, 2], [1, 1]]);
      let t = Math.min(now - 60000, dayStart + hour * 3600000 + Math.floor(rnd() * 3600000));
      const ev = (type, label = '') => { events.push([type, label, vid, sid, source === 'Directo' ? '' : source, medium, campaign, device, browser, country, t]); t += 4000 + Math.floor(rnd() * 40000); };
      ev('pageview');
      if (rnd() < 0.78) { ev('scroll', '25'); ev('section', 'sobre'); }
      if (rnd() < 0.62) { ev('scroll', '50'); ev('section', 'por-que'); }
      const sawCatalog = rnd() < 0.5;
      if (sawCatalog) {
        ev('section', 'cursos'); ev('scroll', '75');
        if (rnd() < 0.35) ev('click', 'curso:' + pick(courses));
        if (rnd() < 0.12) ev('click', 'curso:' + pick(courses));
      }
      if (rnd() < 0.22) ev('click', 'hero:conocer_cursos');
      if (sawCatalog && rnd() < 0.55) { ev('scroll', '100'); ev('section', 'empezar'); }
      const opened = rnd() < (sawCatalog ? 0.2 : 0.04);
      if (opened) {
        ev('click', 'cierre:elegir_entrenamiento'); ev('form_open', 'cierre');
        if (rnd() < 0.42) {
          const name = `${pick(first)} ${pick(last)}`;
          const stage = weighted([['nuevo', d < 4 ? 70 : 20], ['contactado', 25], ['negociando', 14], ['cliente', 12], ['perdido', 10]]);
          const course = stage === 'cliente' ? weighted([['Workshop Ruta 3x Express', 40], ['Inmersión Desafío Next + Ebook', 25], ['Código 500', 18], ['Método Red', 8], ['Código Millonario', 5], ['Liga de Afiliadas', 4]]) : '';
          leads.push({
            name, email: name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.') + Math.floor(rnd() * 90 + 10) + '@example.com',
            phone: codes[country] + String(3000000000 + Math.floor(rnd() * 699999999)).slice(0, 10), stage, course, value: prices[course] || 0,
            interest: rnd() < 0.6 ? pick(courses) : '', source: source === 'Directo' ? '' : source, medium, campaign, device, country, vid, t,
          });
          events.push(['lead', '', vid, sid, source === 'Directo' ? '' : source, medium, campaign, device, browser, country, t]);
        }
      }
    }
  }

  // D1 aceita até 100 parâmetros por consulta: agrupa as linhas em lotes
  const evCols = '(type, label, visitor_id, session_id, source, medium, campaign, device, browser, country, created_at, is_demo)';
  const stmts = [];
  for (let i = 0; i < events.length; i += 8) {
    const chunk = events.slice(i, i + 8);
    stmts.push(env.DB.prepare(`INSERT INTO events ${evCols} VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').join(', ')}`).bind(...chunk.flat()));
  }
  for (let i = 0; i < stmts.length; i += 400) await env.DB.batch(stmts.slice(i, i + 400));

  for (const l of leads) {
    const res = await env.DB.prepare(
      `INSERT INTO leads (name, email, phone, stage, course, value, interest, source, medium, campaign, device, country, visitor_id, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(l.name, l.email, l.phone, l.stage, l.course, l.value, l.interest, l.source, l.medium, l.campaign, l.device, l.country, l.vid, l.t, l.t + 3600000).run();
    const id = res.meta.last_row_id;
    const acts = [env.DB.prepare('INSERT INTO lead_activity (lead_id, kind, text, created_at) VALUES (?, ?, ?, ?)').bind(id, 'registro', 'Se registró en la landing (demo)', l.t)];
    if (l.stage !== 'nuevo') acts.push(env.DB.prepare('INSERT INTO lead_activity (lead_id, kind, text, created_at) VALUES (?, ?, ?, ?)').bind(id, 'etapa', `nuevo → ${l.stage}`, l.t + 3600000));
    await env.DB.batch(acts);
  }
  return json({ ok: true, events: events.length, leads: leads.length });
}

async function clearDemo(env) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lead_activity WHERE lead_id IN (SELECT id FROM leads WHERE is_demo = 1)'),
    env.DB.prepare('DELETE FROM leads WHERE is_demo = 1'),
    env.DB.prepare('DELETE FROM events WHERE is_demo = 1'),
  ]);
  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* utilidades                                                          */
/* ------------------------------------------------------------------ */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function redirect(url, to) {
  return Response.redirect(new URL(to, url).toString(), 302);
}

async function readJson(request) {
  try {
    const text = await request.text(); // sendBeacon manda text/plain
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function clip(v, n) {
  return String(v ?? '').slice(0, n);
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function requestContext(request) {
  const ua = request.headers.get('User-Agent') || '';
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'Tableta'
    : /Mobi|iPhone|Android/i.test(ua) ? 'Móvil' : 'Escritorio';
  const browser = /Instagram/i.test(ua) ? 'Instagram'
    : /FBAN|FBAV/i.test(ua) ? 'Facebook'
    : /TikTok|musical_ly/i.test(ua) ? 'TikTok'
    : /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : 'Otro';
  const country = request.cf?.country && request.cf.country !== 'T1' ? request.cf.country : '';
  return { device, browser, country };
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// compara via hash para não vazar tamanho nem conteúdo por tempo de resposta
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
