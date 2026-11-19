-- Finanzas: ingresos y egresos.
-- Montos en centavos (enteros, siempre positivos: el signo lo da el tipo).
-- Fechas AAAA-MM-DD; marcas de tiempo en UTC ISO 8601.
CREATE TABLE finanzas_movimientos (
  id         INTEGER PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('egreso', 'ingreso')),
  monto      INTEGER NOT NULL CHECK (monto > 0),
  categoria  TEXT NOT NULL CHECK (categoria <> ''),
  nota       TEXT,
  fecha      TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX finanzas_movimientos_fecha ON finanzas_movimientos (fecha);
