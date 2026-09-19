-- 2026-09-19 · Conciliación Uber ↔ Contifico v2: pases por cercanía (hora, monto, artículos) con rastro.
--
-- Por qué: con código exacto + typo el cruce llegaba al 96,7 % (ago→16-sep). Medido sobre los
-- cruces exactos: Simón Bolón factura el mismo monto que el recibo de Uber (97 %), Chios factura
-- ~0,53 del recibo (p10 = p50 = 0,53), Santo Cachón mezcla ambos; los artículos coinciden 86–99 %;
-- Santo Cachón R.A. y Simón Bolón facturan en minutos, Chios con mediana de 1,5 h y p90 de 5 h.
-- Con esas reglas, entre los sobrantes de ambos lados salen pares únicos que un humano daría por
-- obvios (nota "U#000" = pedido D6E98: 2 artículos, 68 min, $13,48 sobre $23,50).
--
-- Pases, en orden (cada fila lleva `metodo`, `confianza` y `_trace` con el porqué):
--   exacto                 código igual, mismo día, canal UBER EATS
--   exacto_dia_siguiente   código igual, día siguiente, canal UBER EATS      (no es error de la tienda)
--   exacto_otro_canal      código igual, mismo día o siguiente, canal ≠ UBER (canal mal elegido en caja)
--   typo                   ≤ 2 caracteres de diferencia, única en ambos sentidos
--   cercania               sobrantes de ambos lados: hora, monto y artículos calzan; única en ambos sentidos
--   posible_mostrador      factura TIENDA/PARA LLEVAR sin nota que calza; confianza MEDIA (la tienda verifica)
--   sin_match              ninguna factura rastreable
--
-- Pasa a vista MATERIALIZADA porque agrupa las facturas por documento (unidades) desde marzo;
-- se refresca con ubereats_raw.uber_refresh_conciliacion() al terminar cada carga y cada hora.
DROP VIEW IF EXISTS ubereats_raw.uber_conciliacion_contifico;
DROP MATERIALIZED VIEW IF EXISTS ubereats_raw.uber_conciliacion_contifico;

CREATE MATERIALIZED VIEW ubereats_raw.uber_conciliacion_contifico AS
WITH u AS (
  SELECT o.id AS uber_id, o.store_name, o.order_date_local, o.customer_order_at, upper(o.order_id) AS codigo_uber,
         o.receipt_amount, o.item_count, upper(btrim(t.centro_costo_nombre)) AS local_contifico
  FROM ubereats_raw.uber_pedidos o
  LEFT JOIN ubereats_raw.uber_tiendas t ON t.uber_store_name = o.store_name
  WHERE o.order_status = 'completed'
), todos_codigos AS (  -- cualquier estado: una factura de un pedido cancelado u otro día no se reasigna por cercanía
  SELECT DISTINCT upper(btrim(t.centro_costo_nombre)) AS local, upper(o.order_id) AS codigo, o.order_date_local
  FROM ubereats_raw.uber_pedidos o
  LEFT JOIN ubereats_raw.uber_tiendas t ON t.uber_store_name = o.store_name
), c AS (  -- facturas por documento, cualquier canal, desde que hay datos de Uber
  SELECT upper(btrim(d.local)) AS local, d.fecha_emision, d.documento, d.documento_id,
         min(d.hora_emision) AS hora_emision, max(d.total_doc) AS total_doc, max(d.nota) AS nota,
         max(d.vendedor_nombre) AS vendedor_nombre, max(d.canal::text) AS canal, sum(d.cantidad) AS unidades,
         -- El código se reconoce por su forma (5 hex) en cualquier parte de la nota; si no hay, recorte del prefijo.
         COALESCE((regexp_match(upper(max(d.nota)), '(?<![0-9A-Z])([0-9A-F]{5})(?![0-9A-Z])'))[1],
                  NULLIF(upper(btrim(regexp_replace(COALESCE(max(d.nota), ''), '^\s*[uU]\s*#\s*', ''))), '')) AS codigo_factura
  FROM contifico_clean.trx_documento_detalles_ventas d
  WHERE NOT d.anulado AND d.fecha_emision >= (SELECT min(order_date_local) FROM ubereats_raw.uber_pedidos)
  GROUP BY 1, 2, 3, 4
),
-- Pases 1–3: código exacto
ex AS (
  SELECT DISTINCT ON (u.uber_id) u.uber_id, c.documento_id,
         CASE WHEN c.canal = 'UBER EATS' AND c.fecha_emision = u.order_date_local THEN 'exacto'
              WHEN c.canal = 'UBER EATS' THEN 'exacto_dia_siguiente'
              ELSE 'exacto_otro_canal' END AS metodo
  FROM u
  JOIN c ON c.local = u.local_contifico AND c.codigo_factura = u.codigo_uber
        AND c.fecha_emision BETWEEN u.order_date_local AND u.order_date_local + 1
  ORDER BY u.uber_id, (c.canal = 'UBER EATS') DESC, c.fecha_emision, c.hora_emision
),
sob1 AS (SELECT u.* FROM u LEFT JOIN ex ON ex.uber_id = u.uber_id WHERE ex.uber_id IS NULL),
lib1 AS (
  SELECT c.* FROM c LEFT JOIN ex x ON x.documento_id = c.documento_id
  WHERE x.documento_id IS NULL AND c.canal = 'UBER EATS' AND c.codigo_factura IS NOT NULL
),
-- Pase 4: error de tipeo (≤ 2 caracteres), única en ambos sentidos
ty_c AS (
  SELECT s.uber_id, l.documento_id, levenshtein(l.codigo_factura, s.codigo_uber) AS dist,
         count(*) OVER (PARTITION BY s.uber_id) AS por_pedido, count(*) OVER (PARTITION BY l.documento_id) AS por_factura
  FROM sob1 s
  JOIN lib1 l ON l.local = s.local_contifico AND l.fecha_emision BETWEEN s.order_date_local AND s.order_date_local + 1
       AND length(l.codigo_factura) BETWEEN length(s.codigo_uber) - 2 AND length(s.codigo_uber) + 2
       AND levenshtein(l.codigo_factura, s.codigo_uber) <= 2
),
ty AS (SELECT * FROM ty_c WHERE por_pedido = 1 AND por_factura = 1),
ty_amb AS (SELECT uber_id, max(por_pedido) AS candidatas FROM ty_c GROUP BY 1),
sob2 AS (SELECT s.* FROM sob1 s LEFT JOIN ty ON ty.uber_id = s.uber_id WHERE ty.uber_id IS NULL),
-- Pase 5: cercanía entre sobrantes (facturas UBER EATS cuyo código no es de ningún pedido de esa tienda ±3 días)
lib2 AS (
  SELECT l.* FROM lib1 l
  LEFT JOIN ty ON ty.documento_id = l.documento_id
  WHERE ty.documento_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM todos_codigos k
                    WHERE k.local = l.local AND k.codigo = l.codigo_factura
                      AND k.order_date_local BETWEEN l.fecha_emision - 3 AND l.fecha_emision + 3)
  UNION ALL
  SELECT c.* FROM c LEFT JOIN ex x ON x.documento_id = c.documento_id
  WHERE x.documento_id IS NULL AND c.canal = 'UBER EATS' AND c.codigo_factura IS NULL
),
ce_c AS (
  SELECT s.uber_id, l.documento_id,
         round(EXTRACT(EPOCH FROM ((l.fecha_emision + l.hora_emision) - s.customer_order_at)) / 60) AS delta_min,
         round(l.total_doc / NULLIF(s.receipt_amount, 0), 2) AS ratio, l.unidades, s.item_count,
         count(*) OVER (PARTITION BY s.uber_id) AS por_pedido, count(*) OVER (PARTITION BY l.documento_id) AS por_factura
  FROM sob2 s
  JOIN lib2 l ON l.local = s.local_contifico AND l.fecha_emision BETWEEN s.order_date_local AND s.order_date_local + 1
       AND ((l.fecha_emision + l.hora_emision) - s.customer_order_at) BETWEEN interval '-10 min' AND interval '8 hours'
       AND abs(l.unidades - s.item_count) <= 1
       AND (abs(l.total_doc - s.receipt_amount) < 0.05 OR l.total_doc / NULLIF(s.receipt_amount, 0) BETWEEN 0.48 AND 0.72)
),
ce AS (SELECT * FROM ce_c WHERE por_pedido = 1 AND por_factura = 1),
ce_amb AS (SELECT uber_id, max(por_pedido) AS candidatas FROM ce_c GROUP BY 1),
sob3 AS (SELECT s.* FROM sob2 s LEFT JOIN ce ON ce.uber_id = s.uber_id WHERE ce.uber_id IS NULL),
-- Pase 6: posible factura de mostrador sin nota (confianza media: la tienda confirma)
mo_c AS (
  SELECT s.uber_id, l.documento_id,
         round(EXTRACT(EPOCH FROM ((l.fecha_emision + l.hora_emision) - s.customer_order_at)) / 60) AS delta_min,
         round(l.total_doc / NULLIF(s.receipt_amount, 0), 2) AS ratio, l.unidades, s.item_count,
         count(*) OVER (PARTITION BY s.uber_id) AS por_pedido, count(*) OVER (PARTITION BY l.documento_id) AS por_factura
  FROM sob3 s
  JOIN c l ON l.local = s.local_contifico AND l.fecha_emision = s.order_date_local
       AND l.canal IN ('TIENDA', 'PARA LLEVAR') AND l.codigo_factura IS NULL
       AND ((l.fecha_emision + l.hora_emision) - s.customer_order_at) BETWEEN interval '-10 min' AND interval '3 hours'
       AND l.unidades = s.item_count
       AND (abs(l.total_doc - s.receipt_amount) < 0.05 OR l.total_doc / NULLIF(s.receipt_amount, 0) BETWEEN 0.51 AND 0.55)
),
mo AS (SELECT * FROM mo_c WHERE por_pedido = 1 AND por_factura = 1),
mo_amb AS (SELECT uber_id, max(por_pedido) AS candidatas FROM mo_c GROUP BY 1),
elegido AS (
  SELECT u.uber_id,
         COALESCE(ex.documento_id, ty.documento_id, ce.documento_id, mo.documento_id) AS documento_id,
         CASE WHEN u.local_contifico IS NULL THEN 'tienda_sin_mapeo'
              WHEN ex.uber_id IS NOT NULL THEN ex.metodo
              WHEN ty.uber_id IS NOT NULL THEN 'typo'
              WHEN ce.uber_id IS NOT NULL THEN 'cercania'
              WHEN mo.uber_id IS NOT NULL THEN 'posible_mostrador'
              ELSE 'sin_match' END AS metodo,
         CASE WHEN u.local_contifico IS NULL THEN NULL
              WHEN ex.uber_id IS NULL AND ty.uber_id IS NULL AND ce.uber_id IS NULL AND mo.uber_id IS NOT NULL THEN 'media'
              ELSE 'alta' END AS confianza,
         CASE WHEN u.local_contifico IS NULL THEN jsonb_build_object('pase', 'tienda_sin_mapeo', 'store_name', u.store_name)
              WHEN ex.uber_id IS NOT NULL THEN jsonb_build_object('pase', ex.metodo)
              WHEN ty.uber_id IS NOT NULL THEN jsonb_build_object('pase', 'typo', 'distancia', ty.dist)
              WHEN ce.uber_id IS NOT NULL THEN jsonb_build_object('pase', 'cercania', 'delta_min', ce.delta_min, 'ratio', ce.ratio,
                                                                  'unidades_factura', ce.unidades, 'articulos_uber', ce.item_count)
              WHEN mo.uber_id IS NOT NULL THEN jsonb_build_object('pase', 'posible_mostrador', 'delta_min', mo.delta_min, 'ratio', mo.ratio,
                                                                  'unidades_factura', mo.unidades, 'articulos_uber', mo.item_count)
              ELSE jsonb_build_object('pase', 'sin_match',
                                      'typo_ambiguas', COALESCE(ty_amb.candidatas, 0),
                                      'cercania_ambiguas', COALESCE(ce_amb.candidatas, 0),
                                      'mostrador_ambiguas', COALESCE(mo_amb.candidatas, 0)) END AS _trace
  FROM u
  LEFT JOIN ex ON ex.uber_id = u.uber_id
  LEFT JOIN ty ON ty.uber_id = u.uber_id
  LEFT JOIN ce ON ce.uber_id = u.uber_id
  LEFT JOIN mo ON mo.uber_id = u.uber_id
  LEFT JOIN ty_amb ON ty_amb.uber_id = u.uber_id
  LEFT JOIN ce_amb ON ce_amb.uber_id = u.uber_id
  LEFT JOIN mo_amb ON mo_amb.uber_id = u.uber_id
)
SELECT u.uber_id, u.store_name, u.local_contifico, u.order_date_local, u.customer_order_at, u.codigo_uber, u.receipt_amount, u.item_count,
       c.documento, e.documento_id, c.fecha_emision AS fecha_factura, c.hora_emision AS hora_factura, c.total_doc AS total_factura,
       c.nota AS nota_escrita, c.vendedor_nombre AS responsable, c.canal AS canal_factura, c.unidades AS unidades_factura,
       e.metodo, e.confianza, e._trace
FROM u
JOIN elegido e ON e.uber_id = u.uber_id
LEFT JOIN c ON c.documento_id = e.documento_id;

CREATE UNIQUE INDEX uber_conciliacion_contifico_uber_id_idx ON ubereats_raw.uber_conciliacion_contifico (uber_id);
CREATE INDEX uber_conciliacion_contifico_local_fecha_idx ON ubereats_raw.uber_conciliacion_contifico (local_contifico, order_date_local);
GRANT SELECT ON ubereats_raw.uber_conciliacion_contifico TO service_role;

-- Refresco con latido: lo llama la carga diaria al terminar y pg_cron cada hora.
CREATE OR REPLACE FUNCTION ubereats_raw.uber_refresh_conciliacion()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_t0 timestamptz := clock_timestamp(); v_n bigint; v_ultimo date;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY ubereats_raw.uber_conciliacion_contifico;
  SELECT count(*), max(order_date_local) INTO v_n, v_ultimo FROM ubereats_raw.uber_conciliacion_contifico;
  RAISE NOTICE '[uber_conciliacion_contifico] refrescada: % filas hasta % en % ms', v_n, v_ultimo, round(extract(epoch from (clock_timestamp() - v_t0)) * 1000);
  RETURN jsonb_build_object('filas', v_n, 'ultimo_dia', v_ultimo, 'dur_ms', round(extract(epoch from (clock_timestamp() - v_t0)) * 1000));
END $$;
REVOKE ALL ON FUNCTION ubereats_raw.uber_refresh_conciliacion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ubereats_raw.uber_refresh_conciliacion() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'uber_refresh_conciliacion';
SELECT cron.schedule('uber_refresh_conciliacion', '35 * * * *',
  $$SET statement_timeout = '5min'; SELECT ubereats_raw.uber_refresh_conciliacion();$$);
