-- Tabla para dedupe de alertas (no spamear WhatsApp si el gap persiste).
-- Cada inserción representa una alerta DISPARADA. El script lee la última y
-- omite nuevas alertas dentro de la ventana de cooldown.

CREATE TABLE IF NOT EXISTS otter_raw.alert_log (
  alert_id           BIGSERIAL PRIMARY KEY,
  alert_type         TEXT NOT NULL,                    -- 'polling_down' | 'anomaly_low_volume' | etc
  alerted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metric_value       NUMERIC,                          -- p.ej. minutos_sin_inserts
  message            TEXT,
  channel            TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'email'
  delivery_status    TEXT,                             -- 'sent' | 'failed:..' | 'twilio_sid:..'
  raw_response       JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_log_type_time
  ON otter_raw.alert_log (alert_type, alerted_at DESC);

COMMENT ON TABLE otter_raw.alert_log IS
  'Bitácora de alertas enviadas. Sirve para evitar spam (cooldown) y auditar entregas.';
