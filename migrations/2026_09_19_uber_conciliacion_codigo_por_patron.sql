-- 2026-09-19 · El código de Uber se reconoce por su forma (5 caracteres hex), no por el prefijo "U#".
-- Antes la vista quitaba solo "U#" y en Santo Cachón Real Audiencia escriben "UBER#AA798",
-- "uber # a2bac", "Uber EATS#D759D": códigos correctos que quedaban como "sin_match".
-- Si la nota no trae un token de 5 hex (p. ej. "U#AFD08A"), se cae al recorte anterior
-- para que el rescate por distancia (typo) siga funcionando. Aplicada en Supabase el 19-sep.
CREATE OR REPLACE VIEW ubereats_raw.uber_conciliacion_contifico AS
WITH u AS (
  SELECT o.id AS uber_id, o.store_name, o.order_date_local, o.customer_order_at,
         upper(o.order_id) AS codigo_uber, o.receipt_amount,
         upper(btrim(t.centro_costo_nombre)) AS local_contifico
  FROM ubereats_raw.uber_pedidos o
  LEFT JOIN ubereats_raw.uber_tiendas t ON t.uber_store_name = o.store_name
  WHERE o.order_status = 'completed'
), c AS (
  SELECT DISTINCT upper(btrim(d.local)) AS local, d.fecha_emision, d.documento, d.documento_id, d.hora_emision,
         d.total_doc, d.nota, d.vendedor_nombre,
         COALESCE(
           (regexp_match(upper(d.nota), '(?<![0-9A-Z])([0-9A-F]{5})(?![0-9A-Z])'))[1],
           upper(btrim(regexp_replace(d.nota, '^\s*[uU]\s*#\s*', '')))
         ) AS codigo_factura
  FROM contifico_clean.trx_documento_detalles_ventas d
  WHERE d.canal::text = 'UBER EATS' AND NOT d.anulado AND d.nota IS NOT NULL
), ex AS (
  SELECT u_1.uber_id, c.documento, c.documento_id, c.hora_emision, c.total_doc, c.nota, c.vendedor_nombre
  FROM u u_1
  JOIN c ON c.local = u_1.local_contifico AND c.fecha_emision = u_1.order_date_local AND c.codigo_factura = u_1.codigo_uber
), libres AS (
  SELECT c.*
  FROM c
  LEFT JOIN u u_1 ON u_1.local_contifico = c.local AND u_1.order_date_local = c.fecha_emision AND u_1.codigo_uber = c.codigo_factura
  WHERE u_1.uber_id IS NULL
), cand AS (
  SELECT u_1.uber_id, l.documento, l.documento_id, l.hora_emision, l.total_doc, l.nota, l.vendedor_nombre,
         count(*) OVER (PARTITION BY u_1.uber_id) AS candidatas
  FROM u u_1
  LEFT JOIN ex ex_1 ON ex_1.uber_id = u_1.uber_id
  JOIN libres l ON l.local = u_1.local_contifico AND l.fecha_emision = u_1.order_date_local
       AND length(l.codigo_factura) BETWEEN length(u_1.codigo_uber) - 2 AND length(u_1.codigo_uber) + 2
       AND levenshtein(l.codigo_factura, u_1.codigo_uber) <= 2
  WHERE ex_1.uber_id IS NULL
), ty AS (
  SELECT * FROM cand WHERE candidatas = 1
)
SELECT u.uber_id, u.store_name, u.local_contifico, u.order_date_local, u.customer_order_at, u.codigo_uber, u.receipt_amount,
       COALESCE(ex.documento, ty.documento) AS documento,
       COALESCE(ex.documento_id, ty.documento_id) AS documento_id,
       COALESCE(ex.hora_emision, ty.hora_emision) AS hora_factura,
       COALESCE(ex.total_doc, ty.total_doc) AS total_factura,
       COALESCE(ex.nota, ty.nota) AS nota_escrita,
       COALESCE(ex.vendedor_nombre, ty.vendedor_nombre) AS responsable,
       CASE WHEN u.local_contifico IS NULL THEN 'tienda_sin_mapeo'
            WHEN ex.uber_id IS NOT NULL THEN 'exacto'
            WHEN ty.uber_id IS NOT NULL THEN 'typo'
            ELSE 'sin_match' END AS metodo
FROM u
LEFT JOIN ex ON ex.uber_id = u.uber_id
LEFT JOIN ty ON ty.uber_id = u.uber_id;
