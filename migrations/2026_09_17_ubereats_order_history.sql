-- Uber Eats Manager: Informes > Historial de pedidos.
-- El CSV trae timestamps locales de Ecuador; se conservan como timestamp sin
-- zona para no desplazar la hora al convertirla desde UTC.

CREATE SCHEMA IF NOT EXISTS ubereats_raw;

CREATE TABLE IF NOT EXISTS ubereats_raw.order_history_reports (
  id                BIGSERIAL PRIMARY KEY,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  store_scope       TEXT NOT NULL,
  filename          TEXT,
  file_sha256       TEXT NOT NULL,
  source_url        TEXT NOT NULL,
  raw_csv           TEXT NOT NULL,
  rows_loaded       INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ubereats_raw.orders (
  id                    BIGSERIAL PRIMARY KEY,
  report_id             BIGINT NOT NULL REFERENCES ubereats_raw.order_history_reports(id) ON DELETE CASCADE,
  store_name            TEXT NOT NULL,
  external_store_id     TEXT,
  business_uuid         UUID NOT NULL,
  country_code          TEXT,
  city                  TEXT,
  order_id              TEXT NOT NULL,
  order_uuid            UUID NOT NULL,
  order_status          TEXT,
  delivery_status       TEXT,
  scheduled             BOOLEAN,
  completed             BOOLEAN,
  cancelled_by          TEXT,
  item_count            INT,
  currency              TEXT,
  receipt_amount        NUMERIC(14,2),
  order_date_local      DATE NOT NULL,
  customer_order_at     TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  cancellation_at       TIMESTAMP WITHOUT TIME ZONE,
  merchant_accept_at    TIMESTAMP WITHOUT TIME ZONE,
  order_completed_at    TIMESTAMP WITHOUT TIME ZONE,
  courier_arrival_at    TIMESTAMP WITHOUT TIME ZONE,
  courier_departure_at  TIMESTAMP WITHOUT TIME ZONE,
  courier_delivery_at   TIMESTAMP WITHOUT TIME ZONE,
  accept_minutes        NUMERIC(12,3),
  prep_minutes_original NUMERIC(12,3),
  prep_time_increased   BOOLEAN,
  prep_increase_minutes NUMERIC(12,3),
  delivery_minutes      NUMERIC(12,3),
  fulfillment_minutes   NUMERIC(12,3),
  courier_wait_minutes  NUMERIC(12,3),
  avoidable_wait_minutes NUMERIC(12,3),
  user_wait_minutes     NUMERIC(12,3),
  total_prep_delivery_minutes NUMERIC(12,3),
  duration_minutes      NUMERIC(12,3),
  batch_type             TEXT,
  fulfillment_type      TEXT,
  order_channel          TEXT,
  uber_brand             TEXT,
  subscription_pass      TEXT,
  workflow_uuid          UUID,
  source_timezone        TEXT NOT NULL DEFAULT 'America/Guayaquil',
  raw_row                JSONB,
  captured_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_uuid, order_uuid)
);

CREATE INDEX IF NOT EXISTS ubereats_orders_customer_time_idx
  ON ubereats_raw.orders (order_date_local, customer_order_at);
CREATE INDEX IF NOT EXISTS ubereats_orders_store_time_idx
  ON ubereats_raw.orders (store_name, customer_order_at DESC);
CREATE INDEX IF NOT EXISTS ubereats_orders_order_id_idx
  ON ubereats_raw.orders (order_id);

COMMENT ON COLUMN ubereats_raw.orders.customer_order_at IS
  'Hora del pedido del cliente tal como viene en Uber Manager, hora local Ecuador.';
