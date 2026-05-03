-- ════════════════════════════════════════════════════════════════════════════
-- SCHEMA: pedidosya_raw   (v3 — 2026-05-02)
-- ════════════════════════════════════════════════════════════════════════════
-- Modelo en 3 niveles + catálogo unificado:
--
--   contifico_clean.mapeo_centro_costo (extendida — 1 fila por local FOODIX,
--                                       cubre Otter + PedidosYa + futuros)
--     ↓
--   pedidosya_raw.payouts (transferencia bancaria)
--     ↓
--   pedidosya_raw.invoices (factura semanal)
--     ↓
--   pedidosya_raw.invoice_lines (pedido individual con comisión real)
--
-- Cada pedido individual queda trazable hasta su transferencia bancaria.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 0a. EXTENDER catálogo maestro contifico_clean.mapeo_centro_costo
--     Agrega columna `marca` (snake_case) + columnas `pya_*` para PedidosYa
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE contifico_clean.mapeo_centro_costo
  ADD COLUMN IF NOT EXISTS marca           TEXT,         -- chios_burger / santo_cachon / simon_bolon / foodix_fries
  ADD COLUMN IF NOT EXISTS pya_grid_code   TEXT,         -- HZUU1Y, 4F3TTD, etc.
  ADD COLUMN IF NOT EXISTS pya_vendor_id   TEXT,         -- 238962, 210361, etc.
  ADD COLUMN IF NOT EXISTS pya_nombre      TEXT,         -- nombre tal cual aparece en PedidosYa
  ADD COLUMN IF NOT EXISTS pya_chain_id    TEXT;         -- 0016900002hloN8 si pertenece a cadena

CREATE UNIQUE INDEX IF NOT EXISTS mapeo_pya_grid_uidx
  ON contifico_clean.mapeo_centro_costo (pya_grid_code)
  WHERE pya_grid_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS mapeo_marca_idx
  ON contifico_clean.mapeo_centro_costo (marca);

-- ─────────────────────────────────────────────────────────────────────────────
-- 0b. POBLAR datos PedidosYa + marca para los locales conocidos
--     Capturado oficialmente desde response /auth/v4/login el 2026-05-02
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE contifico_clean.mapeo_centro_costo SET
  marca           = 'chios_burger',
  pya_grid_code   = 'HZUU1Y',
  pya_vendor_id   = '238962',
  pya_nombre      = 'Chios Burger - Isla Floreana',
  pya_chain_id    = '0016900002hloN8'
WHERE centro_costo_raw = 'FLOREANA';

UPDATE contifico_clean.mapeo_centro_costo SET
  marca           = 'chios_burger',
  pya_grid_code   = '4F3TTD',
  pya_vendor_id   = '210361',
  pya_nombre      = 'Chios Burger - Real Audiencia',
  pya_chain_id    = '0016900002hloN8'
WHERE centro_costo_raw = 'REAL';

UPDATE contifico_clean.mapeo_centro_costo SET
  marca           = 'chios_burger',
  pya_grid_code   = '4F3SJT',
  pya_vendor_id   = '210792',
  pya_nombre      = 'Chios Burger Portugal',
  pya_chain_id    = '0016900002hloN8'
WHERE centro_costo_raw = 'PORTUGAL';

UPDATE contifico_clean.mapeo_centro_costo SET
  marca           = 'santo_cachon',
  pya_grid_code   = 'HRE4HC',
  pya_vendor_id   = '528672',
  pya_nombre      = 'Santo Cachón',
  pya_chain_id    = NULL
WHERE centro_costo_raw = 'SANTO CACHON REAL';

UPDATE contifico_clean.mapeo_centro_costo SET
  marca           = 'santo_cachon',
  pya_grid_code   = 'HPQKWK',
  pya_vendor_id   = '587373',
  pya_nombre      = 'Santo Cachón - Portugal',
  pya_chain_id    = NULL
WHERE centro_costo_raw = 'SANTO CACHON PORTUGAL';

UPDATE contifico_clean.mapeo_centro_costo SET
  marca           = 'simon_bolon',
  pya_grid_code   = 'HAJUYT',
  pya_vendor_id   = '480041',
  pya_nombre      = 'Simón Bolón',
  pya_chain_id    = NULL
WHERE centro_costo_raw = 'SIMON BOLON';

-- Marca para locales que no operan en PedidosYa pero sí son centros operativos
UPDATE contifico_clean.mapeo_centro_costo SET marca = 'foodix_fries'
  WHERE centro_costo_raw = 'FOODIX FRIES';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CREAR schema pedidosya_raw
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS pedidosya_raw;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SCRAPE_RUNS — log de ejecuciones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidosya_raw.scrape_runs (
  id                  BIGSERIAL PRIMARY KEY,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  tipo                TEXT NOT NULL,
  rango_desde         DATE,
  rango_hasta         DATE,
  payouts_nuevos      INT DEFAULT 0,
  payouts_act         INT DEFAULT 0,
  invoices_nuevos     INT DEFAULT 0,
  invoices_act        INT DEFAULT 0,
  invoice_lines_nuev  INT DEFAULT 0,
  errores             INT DEFAULT 0,
  mensajes_error      JSONB,
  duracion_seg        INT,
  status              TEXT DEFAULT 'running'
);
CREATE INDEX IF NOT EXISTS scrape_runs_started_at_idx ON pedidosya_raw.scrape_runs(started_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RAW_RESPONSES — bodies crudos para auditoría / replay
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidosya_raw.raw_responses (
  id              BIGSERIAL PRIMARY KEY,
  scrape_run_id   BIGINT REFERENCES pedidosya_raw.scrape_runs(id) ON DELETE CASCADE,
  operation_name  TEXT NOT NULL,
  variables       JSONB,
  response_status INT,
  response_body   JSONB,
  bytes           INT,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS raw_responses_scrape_idx ON pedidosya_raw.raw_responses(scrape_run_id);
CREATE INDEX IF NOT EXISTS raw_responses_op_idx ON pedidosya_raw.raw_responses(operation_name, fetched_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PAYOUTS — un payout = una transferencia bancaria
--    grid_code apunta a contifico_clean.mapeo_centro_costo.pya_grid_code
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidosya_raw.payouts (
  payout_id              TEXT PRIMARY KEY,
  global_entity_id       TEXT NOT NULL,
  billing_parent_id      TEXT,
  grid_code              TEXT REFERENCES contifico_clean.mapeo_centro_costo(pya_grid_code) ON DELETE SET NULL,
  chain_id               TEXT,
  status                 TEXT,
  total_amount           NUMERIC(12,2),
  currency               TEXT,
  processed_date         DATE,
  payout_period_start    DATE,
  payout_period_end      DATE,
  invoices_count         INT,
  attachments            JSONB,
  raw_extra              JSONB,
  scrape_run_id          BIGINT REFERENCES pedidosya_raw.scrape_runs(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payouts_processed_date_idx ON pedidosya_raw.payouts(processed_date DESC);
CREATE INDEX IF NOT EXISTS payouts_grid_idx           ON pedidosya_raw.payouts(grid_code);
CREATE INDEX IF NOT EXISTS payouts_period_idx         ON pedidosya_raw.payouts(payout_period_start, payout_period_end);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INVOICES — facturas semanales con desglose REAL de comisiones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidosya_raw.invoices (
  invoice_id                 TEXT PRIMARY KEY,
  payout_id                  TEXT REFERENCES pedidosya_raw.payouts(payout_id) ON DELETE SET NULL,
  global_entity_id           TEXT NOT NULL,
  billing_parent_id          TEXT,
  grid_code                  TEXT REFERENCES contifico_clean.mapeo_centro_costo(pya_grid_code) ON DELETE SET NULL,
  chain_id                   TEXT,
  invoice_start_date         DATE,
  invoice_end_date           DATE,
  processed_date             DATE,
  orders_count               INT,
  currency                   TEXT,
  gross_sales                NUMERIC(12,2),
  total_commissions          NUMERIC(12,2),
  total_net_payout           NUMERIC(12,2),
  taxes                      NUMERIC(12,2),
  delivery_fees              NUMERIC(12,2),
  packaging_fees             NUMERIC(12,2),
  mov_fees                   NUMERIC(12,2),
  food_cost_reimbursement    NUMERIC(12,2),
  additional_sales_total     NUMERIC(12,2),
  marketing_fees_total       NUMERIC(12,2),
  additional_fees_total      NUMERIC(12,2),
  cash_collected             NUMERIC(12,2),
  attachments                JSONB,
  earnings_breakdown         JSONB,
  invoice_breakdown          JSONB,
  raw_extra                  JSONB,
  scrape_run_id              BIGINT REFERENCES pedidosya_raw.scrape_runs(id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoices_payout_idx ON pedidosya_raw.invoices(payout_id);
CREATE INDEX IF NOT EXISTS invoices_period_idx ON pedidosya_raw.invoices(invoice_start_date, invoice_end_date);
CREATE INDEX IF NOT EXISTS invoices_grid_idx   ON pedidosya_raw.invoices(grid_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. INVOICE_LINES — pedido individual con su comisión real
--    OBLIGATORIA — se llena con getOrderHistory u equivalente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidosya_raw.invoice_lines (
  id                  BIGSERIAL PRIMARY KEY,
  invoice_id          TEXT NOT NULL REFERENCES pedidosya_raw.invoices(invoice_id) ON DELETE CASCADE,
  payout_id           TEXT REFERENCES pedidosya_raw.payouts(payout_id) ON DELETE SET NULL, -- denormalizado
  grid_code           TEXT REFERENCES contifico_clean.mapeo_centro_costo(pya_grid_code) ON DELETE SET NULL,
  order_display_id    TEXT NOT NULL UNIQUE,
  order_id_interno    TEXT,
  order_date          TIMESTAMPTZ,
  gross_amount        NUMERIC(12,2),
  commission_amount   NUMERIC(12,2),
  commission_pct      NUMERIC(5,2),
  marketing_fees      NUMERIC(12,2),
  additional_fees     NUMERIC(12,2),
  discount_by_brand   NUMERIC(12,2),
  discount_by_self    NUMERIC(12,2),
  net_amount          NUMERIC(12,2),
  payment_method      TEXT,
  order_status        TEXT,
  raw_line            JSONB,
  scrape_run_id       BIGINT REFERENCES pedidosya_raw.scrape_runs(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx  ON pedidosya_raw.invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_lines_payout_idx   ON pedidosya_raw.invoice_lines(payout_id);
CREATE INDEX IF NOT EXISTS invoice_lines_grid_idx     ON pedidosya_raw.invoice_lines(grid_code);
CREATE INDEX IF NOT EXISTS invoice_lines_order_id_idx ON pedidosya_raw.invoice_lines(order_display_id);
CREATE INDEX IF NOT EXISTS invoice_lines_date_idx     ON pedidosya_raw.invoice_lines(order_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TRIGGER — propagar payout_id a invoice_lines cuando un invoice queda pagado
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pedidosya_raw.propagate_payout_to_lines() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payout_id IS DISTINCT FROM OLD.payout_id THEN
    UPDATE pedidosya_raw.invoice_lines
       SET payout_id = NEW.payout_id, updated_at = NOW()
     WHERE invoice_id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_payout_propagate ON pedidosya_raw.invoices;
CREATE TRIGGER invoices_payout_propagate AFTER UPDATE ON pedidosya_raw.invoices
  FOR EACH ROW EXECUTE FUNCTION pedidosya_raw.propagate_payout_to_lines();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TRIGGERS — updated_at automático
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pedidosya_raw.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payouts_touch ON pedidosya_raw.payouts;
CREATE TRIGGER payouts_touch BEFORE UPDATE ON pedidosya_raw.payouts
  FOR EACH ROW EXECUTE FUNCTION pedidosya_raw.touch_updated_at();
DROP TRIGGER IF EXISTS invoices_touch ON pedidosya_raw.invoices;
CREATE TRIGGER invoices_touch BEFORE UPDATE ON pedidosya_raw.invoices
  FOR EACH ROW EXECUTE FUNCTION pedidosya_raw.touch_updated_at();
DROP TRIGGER IF EXISTS invoice_lines_touch ON pedidosya_raw.invoice_lines;
CREATE TRIGGER invoice_lines_touch BEFORE UPDATE ON pedidosya_raw.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION pedidosya_raw.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. VISTAS DERIVADAS — joinean con mapeo_centro_costo (NO con tabla locales)
-- ─────────────────────────────────────────────────────────────────────────────

-- Vista 1: pedido completo con su estado de pago
CREATE OR REPLACE VIEW pedidosya_raw.v_pedidos_completos AS
SELECT
  il.order_display_id, il.order_date,
  m.pya_grid_code        AS grid_code,
  m.pya_nombre           AS nombre_pedidosya,
  m.marca,
  m.centro_costo_raw, m.centro_costo_nombre,
  il.gross_amount, il.commission_amount, il.commission_pct,
  il.marketing_fees, il.additional_fees,
  il.discount_by_brand, il.discount_by_self,
  il.net_amount, il.payment_method, il.order_status,
  i.invoice_id, i.invoice_start_date, i.invoice_end_date,
  i.processed_date AS fecha_factura,
  p.payout_id, p.processed_date AS fecha_transferencia,
  p.total_amount AS monto_transferido,
  CASE
    WHEN p.payout_id IS NULL AND i.payout_id IS NULL THEN 'pendiente_factura'
    WHEN p.payout_id IS NULL THEN 'facturado_sin_pagar'
    ELSE 'pagado'
  END AS estado_pago
FROM pedidosya_raw.invoice_lines il
JOIN pedidosya_raw.invoices i             ON i.invoice_id = il.invoice_id
LEFT JOIN pedidosya_raw.payouts p         ON p.payout_id = i.payout_id
LEFT JOIN contifico_clean.mapeo_centro_costo m ON m.pya_grid_code = il.grid_code;

-- Vista 2: facturas pendientes de pago
CREATE OR REPLACE VIEW pedidosya_raw.v_pagos_pendientes AS
SELECT
  m.marca, m.centro_costo_nombre, m.pya_nombre,
  i.invoice_id, i.invoice_start_date, i.invoice_end_date,
  i.gross_sales, i.total_net_payout, i.orders_count,
  i.processed_date,
  CURRENT_DATE - i.processed_date AS dias_desde_factura
FROM pedidosya_raw.invoices i
LEFT JOIN contifico_clean.mapeo_centro_costo m ON m.pya_grid_code = i.grid_code
WHERE i.payout_id IS NULL
ORDER BY i.processed_date;

-- Vista 3: comisiones efectivas por local y mes
CREATE OR REPLACE VIEW pedidosya_raw.v_comisiones_por_local AS
SELECT
  m.marca, m.centro_costo_nombre, m.pya_grid_code AS grid_code,
  DATE_TRUNC('month', i.invoice_end_date)::DATE AS mes,
  SUM(i.gross_sales)                                                    AS gross_sales,
  SUM(i.total_commissions)                                              AS commission_marketplace,
  SUM(i.marketing_fees_total)                                           AS marketing_fees,
  SUM(i.additional_fees_total)                                          AS additional_fees,
  SUM(i.total_net_payout)                                               AS net_payout,
  ROUND(ABS(SUM(i.total_commissions)) / NULLIF(SUM(i.gross_sales), 0) * 100, 2) AS commission_pct_marketplace,
  ROUND(
    ABS(SUM(i.total_commissions) + COALESCE(SUM(i.marketing_fees_total), 0) + COALESCE(SUM(i.additional_fees_total), 0))
    / NULLIF(SUM(i.gross_sales), 0) * 100, 2
  )                                                                     AS commission_pct_total_efectivo,
  SUM(i.orders_count)                                                   AS pedidos
FROM pedidosya_raw.invoices i
LEFT JOIN contifico_clean.mapeo_centro_costo m ON m.pya_grid_code = i.grid_code
GROUP BY m.marca, m.centro_costo_nombre, m.pya_grid_code, DATE_TRUNC('month', i.invoice_end_date)
ORDER BY mes DESC, m.marca;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Permisos para PostgREST
-- ─────────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA pedidosya_raw TO authenticated, service_role, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pedidosya_raw TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA pedidosya_raw TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pedidosya_raw TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA pedidosya_raw
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA pedidosya_raw
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA pedidosya_raw
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- Recordar agregar pedidosya_raw a pgrst.db_schemas:
--   ALTER ROLE authenticator SET pgrst.db_schemas = 'public, gdi_direccion, gth_talento_humano, contifico_raw, otter_raw, otter_clean, pedidosya_raw';
--   NOTIFY pgrst, 'reload config';

-- ────────────────────────────────────────────────────────────────────────────
-- FIN: pedidosya_raw v3 + extensión mapeo_centro_costo
-- ────────────────────────────────────────────────────────────────────────────
