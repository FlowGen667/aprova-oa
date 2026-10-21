-- Leads capturados pelo formulário da landing
CREATE TABLE leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  phone       TEXT    NOT NULL,
  stage       TEXT    NOT NULL DEFAULT 'nuevo',
  course      TEXT    NOT NULL DEFAULT '',
  value       REAL    NOT NULL DEFAULT 0,
  interest    TEXT    NOT NULL DEFAULT '',
  source      TEXT    NOT NULL DEFAULT '',
  medium      TEXT    NOT NULL DEFAULT '',
  campaign    TEXT    NOT NULL DEFAULT '',
  referrer    TEXT    NOT NULL DEFAULT '',
  device      TEXT    NOT NULL DEFAULT '',
  country     TEXT    NOT NULL DEFAULT '',
  visitor_id  TEXT    NOT NULL DEFAULT '',
  is_demo     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_leads_created ON leads (created_at);
CREATE INDEX idx_leads_stage   ON leads (stage);
CREATE INDEX idx_leads_email   ON leads (email);

-- Histórico de cada lead no CRM (mudança de etapa, notas, novo cadastro)
CREATE TABLE lead_activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL,
  text        TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_activity_lead ON lead_activity (lead_id, created_at);

-- Eventos de navegação: pageview, click, form_open, section, scroll, lead
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL,
  label       TEXT    NOT NULL DEFAULT '',
  visitor_id  TEXT    NOT NULL DEFAULT '',
  session_id  TEXT    NOT NULL DEFAULT '',
  source      TEXT    NOT NULL DEFAULT '',
  medium      TEXT    NOT NULL DEFAULT '',
  campaign    TEXT    NOT NULL DEFAULT '',
  referrer    TEXT    NOT NULL DEFAULT '',
  device      TEXT    NOT NULL DEFAULT '',
  browser     TEXT    NOT NULL DEFAULT '',
  country     TEXT    NOT NULL DEFAULT '',
  is_demo     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_events_created ON events (created_at);
CREATE INDEX idx_events_type    ON events (type, created_at);

-- Configurações do painel (ids dos pixels etc.)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
