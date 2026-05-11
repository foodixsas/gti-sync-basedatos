-- Detección de anomalía de volumen: compara pedidos de la última hora
-- vs media histórica de las últimas 4 semanas (mismo día de la semana, misma hora).
-- Si current_count < expected_count * threshold_pct → es anomalía.

CREATE OR REPLACE VIEW otter_raw.v_volumen_anomalia AS
WITH ahora AS (
  SELECT
    (NOW() AT TIME ZONE 'America/Guayaquil') AS now_ec
),
ventana_actual AS (
  -- Pedidos en la última hora (timezone EC)
  SELECT COUNT(*) AS pedidos_actuales
  FROM otter_raw.otter_pedidos
  WHERE is_test = false
    AND ts_reference_local >= (
      ((SELECT now_ec FROM ahora) - INTERVAL '1 hour')::timestamp
    )
    AND ts_reference_local < (SELECT now_ec FROM ahora)::timestamp
),
historico AS (
  -- Mismo día de la semana + misma hora, últimas 4 semanas (excluye HOY)
  SELECT
    EXTRACT(DOW FROM ts_reference_local::timestamp) AS dow,
    EXTRACT(HOUR FROM ts_reference_local::timestamp) AS hora,
    DATE(ts_reference_local::timestamp) AS fecha,
    COUNT(*) AS cnt
  FROM otter_raw.otter_pedidos
  WHERE is_test = false
    AND ts_reference_local >= ((SELECT now_ec FROM ahora) - INTERVAL '29 days')::timestamp
    AND ts_reference_local <  ((SELECT now_ec FROM ahora) - INTERVAL '1 day')::timestamp
  GROUP BY 1, 2, 3
),
media_misma_hora AS (
  SELECT
    AVG(cnt)::NUMERIC(10,2) AS media_4w,
    STDDEV(cnt)::NUMERIC(10,2) AS std_4w,
    COUNT(*) AS muestras
  FROM historico
  WHERE dow = EXTRACT(DOW FROM (SELECT now_ec FROM ahora))
    AND hora = EXTRACT(HOUR FROM (SELECT now_ec FROM ahora) - INTERVAL '1 hour')
)
SELECT
  (SELECT now_ec FROM ahora) AS evaluado_en_ec,
  va.pedidos_actuales,
  mh.media_4w AS pedidos_esperados,
  mh.std_4w,
  mh.muestras AS semanas_de_referencia,
  CASE
    WHEN mh.media_4w IS NULL OR mh.muestras < 2 THEN NULL
    ELSE ROUND((va.pedidos_actuales::NUMERIC / NULLIF(mh.media_4w, 0)) * 100, 1)
  END AS pct_vs_esperado,
  CASE
    WHEN mh.media_4w IS NULL OR mh.muestras < 2 THEN 'insufficient_history'
    WHEN mh.media_4w < 3 THEN 'low_baseline'    -- baja actividad histórica, no alertar
    WHEN va.pedidos_actuales >= mh.media_4w * 0.30 THEN 'normal'
    ELSE 'anomaly_low_volume'
  END AS estado
FROM ventana_actual va
CROSS JOIN media_misma_hora mh;

COMMENT ON VIEW otter_raw.v_volumen_anomalia IS
  'Detecta caídas anómalas de volumen comparando última hora vs media misma hora/día últimas 4 semanas.';
