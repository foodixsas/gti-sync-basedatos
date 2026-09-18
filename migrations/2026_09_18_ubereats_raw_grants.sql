-- Complemento de 2026_09_17_ubereats_order_history.sql
-- Sin esto el import corre "sin error" y la tabla queda en cero (403 silencioso).

GRANT USAGE ON SCHEMA ubereats_raw TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ubereats_raw.order_history_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ubereats_raw.orders                TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ubereats_raw.order_history_reports_id_seq  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ubereats_raw.orders_id_seq                 TO service_role;

-- Datos crudos de un proveedor: nadie más los lee.
REVOKE ALL ON ubereats_raw.order_history_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ubereats_raw.orders                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA ubereats_raw                FROM PUBLIC, anon, authenticated;

-- Idempotencia del reporte: reimportar el MISMO archivo no crea una fila nueva.
ALTER TABLE ubereats_raw.order_history_reports
  ADD CONSTRAINT order_history_reports_file_sha256_key UNIQUE (file_sha256);

-- Exponer el schema a PostgREST.
-- ⚠️ La lista se ESCRIBE COMPLETA y pisa la anterior. Antes de correr esto:
--    SELECT unnest(rolconfig) FROM pg_roles WHERE rolname = 'authenticator';
-- y reconstruir la lista con lo que haya ahí + ubereats_raw. Nunca de memoria.
ALTER ROLE authenticator SET pgrst.db_schemas =
  'public, gdi_direccion, gth_talento_humano, contifico_raw, gfc_finanzas, contifico_clean, otter_raw, pedidosya_raw, costos, gop_operaciones, gmkt_marketing, rpt_lectura, ubereats_raw';

NOTIFY pgrst, 'reload config';
-- esperar ~5s
NOTIFY pgrst, 'reload schema';
