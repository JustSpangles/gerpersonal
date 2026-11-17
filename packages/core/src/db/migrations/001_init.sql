-- 001: tablas comunes a todas las áreas.

-- Último número usado por cada prefijo de código (C14, F203…).
-- Los números nunca se reutilizan, aunque se borre el registro.
CREATE TABLE counters (
  prefix      TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL
) STRICT;

-- Fotos y archivos de cualquier área, ligados a un registro por su código.
CREATE TABLE attachments (
  id          INTEGER PRIMARY KEY,
  record_code TEXT NOT NULL,
  file_path   TEXT NOT NULL, -- relativo a data/media/
  mime        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX attachments_record_code ON attachments (record_code);
