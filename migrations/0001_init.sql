-- Ceuta nos une - esquema inicial
-- Todo el contenido de la web vive aqui: lugares, mensajes de apoyo y ajustes.

-- ---------------------------------------------------------------------------
-- Ajustes editables sin tocar codigo (correo de aviso, fecha del acto, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  label      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO settings (key, value, label) VALUES
  ('notify_email',   'info@ceutanosune.org', 'Correo que recibe el aviso de cada lugar propuesto'),
  ('event_date',     '2026-09-02',           'Fecha del acto (AAAA-MM-DD)'),
  ('event_label',    '2 de septiembre',      'Fecha en texto para la portada'),
  ('site_title',     'Ceuta nos une',        'Titulo del sitio'),
  ('site_claim',     'A favor del pueblo de Ceuta y por nuestra Unidad', 'Lema bajo el titulo'),
  ('places_open',    '1',                    'Admitir propuestas de lugares (1 si / 0 no)'),
  ('messages_open',  '1',                    'Admitir mensajes de apoyo (1 si / 0 no)'),
  ('contact_email',  'info@ceutanosune.org', 'Correo de contacto publico');

-- ---------------------------------------------------------------------------
-- Lugares de la concentracion. Requieren aprobacion antes de salir en la web.
-- ---------------------------------------------------------------------------
CREATE TABLE places (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  city            TEXT NOT NULL,
  province        TEXT NOT NULL,
  venue           TEXT NOT NULL,
  address         TEXT NOT NULL,
  event_date      TEXT NOT NULL,
  event_time      TEXT NOT NULL,
  lat             REAL,
  lon             REAL,
  notes           TEXT,
  organizer       TEXT,
  source_url      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitter_name  TEXT,
  submitter_email TEXT,
  submitter_phone TEXT,
  review_note     TEXT,
  ip_hash         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at     TEXT
);

CREATE INDEX idx_places_status   ON places (status, province, city);
CREATE INDEX idx_places_created  ON places (created_at DESC);

-- ---------------------------------------------------------------------------
-- Muro de apoyo. Se publica al momento (sin moderacion previa); el panel de
-- admin permite ocultar cualquier mensaje y ver los que la gente ha reportado.
-- ---------------------------------------------------------------------------
CREATE TABLE messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  author        TEXT NOT NULL,
  origin        TEXT,
  body          TEXT NOT NULL,
  photo_key     TEXT,
  photo_type    TEXT,
  photo_bytes   INTEGER,
  hidden        INTEGER NOT NULL DEFAULT 0,
  reports       INTEGER NOT NULL DEFAULT 0,
  ip_hash       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_visible ON messages (hidden, id DESC);
CREATE INDEX idx_messages_reports ON messages (reports DESC);

-- ---------------------------------------------------------------------------
-- Registro de los avisos por correo. Queda constancia aunque el envio falle,
-- asi ninguna propuesta se pierde por un problema del proveedor de correo.
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id   INTEGER REFERENCES places(id) ON DELETE SET NULL,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at    TEXT
);

CREATE INDEX idx_notifications_status ON notifications (status, id DESC);
