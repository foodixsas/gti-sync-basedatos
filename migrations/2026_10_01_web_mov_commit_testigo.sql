-- Guarda del export vacío: comprobar con un documento testigo antes de dar el slice por fallido.
--
-- Qué pasaba (01-oct-2026). fn_web_mov_commit tiene una guarda desde el incidente del 06-sep: si un
-- export llega sin documentos y en la base hay documentos vivos para ese mismo rango/tipo/origen, no
-- toca nada y cuenta el slice como fallo (ese día el portal devolvió vacíos tres exports AJU y se
-- dieron de baja 37 documentos que seguían vivos). La guarda no sabe distinguir ese fallo de un
-- borrado real, y el 29/30-sep Contabilidad eliminó en Contifico 10 ajustes ("AJUSTE DE COSTO
-- PENDIENTE ELIMINAR", fechas 19 al 28-sep). Resultado:
--   · el scrape diario y el de cierre quedaron en rojo cada corrida (4 slices AJU "fallidos"), con su
--     aviso por WhatsApp, y habría seguido así hasta que esas fechas salieran de la ventana;
--   · los 10 ajustes siguieron vivos en nuestra copia aunque ya no existen;
--   · la relectura del 22-sep (cola del PR #16) no podía cerrarse nunca: 29 de 31 slices para siempre.
-- Comprobado a mano ese día, en modo --dry: el export AJU de septiembre devuelve el ajuste del 14-sep
-- (sigue vivo) y ninguno del 15-sep en adelante. El export funciona; los documentos se borraron.
--
-- Qué cambia. El scraper, cuando la guarda salta, hace esa misma comprobación:
--   1. pide documentos testigo: otros documentos vivos del mismo tipo (y origen), fuera del rango;
--   2. baja y asienta el día de un candidato; si ese export trae documentos, el export de ese tipo
--      responde, y cualquiera de ellos sirve de testigo (queda visto por la corrida);
--   3. vuelve a leer el rango sospechoso; si sigue vacío, hace commit citando al testigo.
-- fn_web_mov_commit no le cree de palabra: verifica en la base que ese testigo fue visto por la misma
-- corrida hace menos de 10 minutos. Sin testigo válido, todo sigue como antes (bloqueo + ok=false).
-- El 06-sep no habría pasado la prueba: todos los exports AJU venían vacíos, ningún testigo aparece.

-- Candidatos a testigo: documentos vivos del mismo tipo (y origen), fuera del rango, uno por día,
-- primero los vistos más recientemente (los que con más seguridad siguen en Contifico). Sin límite de
-- antigüedad: el 01-oct los únicos AJU:MAN confiables eran de marzo, releídos esa mañana.
-- Se excluyen los que ya están bajo sospecha: los que caen en un rango donde la guarda saltó después
-- de la última vez que se los vio (un testigo que no aparece queda asentado así y no se repite).
CREATE OR REPLACE FUNCTION public.fn_web_mov_testigos(
  p_tipo text, p_origen text, p_fecha_desde date, p_fecha_hasta date, p_max integer DEFAULT 5)
RETURNS TABLE (codigo varchar, fecha date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'contifico_web'
AS $function$
  WITH sospecha AS MATERIALIZED (
    SELECT l.fecha_desde, l.fecha_hasta, l.created_at
      FROM contifico_web.sync_log l
     WHERE l.tipo = p_tipo AND l.ok = false AND l.meta ->> 'guarda' = 'export_vacio'
  ), recientes AS (
    SELECT d.codigo, d.fecha, d.last_seen_at
      FROM contifico_web.mov_inventario_doc d
     WHERE d.deleted_at IS NULL
       AND d.tipo = p_tipo AND (p_origen IS NULL OR d.origen = p_origen)
       AND d.fecha NOT BETWEEN p_fecha_desde AND p_fecha_hasta
     ORDER BY d.last_seen_at DESC, d.fecha DESC, d.codigo DESC
     LIMIT 200
  ), limpios AS (
    SELECT r.* FROM recientes r
     WHERE NOT EXISTS (SELECT 1 FROM sospecha s
                        WHERE r.fecha BETWEEN s.fecha_desde AND s.fecha_hasta AND s.created_at > r.last_seen_at)
  ), por_dia AS (
    SELECT DISTINCT ON (l.fecha) l.codigo, l.fecha, l.last_seen_at
      FROM limpios l ORDER BY l.fecha, l.last_seen_at DESC, l.codigo DESC
  )
  SELECT p.codigo, p.fecha FROM por_dia p
   ORDER BY p.last_seen_at DESC, p.fecha DESC
   LIMIT greatest(coalesce(p_max, 5), 1);
$function$;

REVOKE ALL ON FUNCTION public.fn_web_mov_testigos(text, text, date, date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_web_mov_testigos(text, text, date, date, integer) TO service_role;

-- La función de commit es la vigente más la verificación del testigo y el "sondeo" (el scraper
-- pregunta antes de dar el slice por fallido; así cada slice deja una sola fila en sync_log).
CREATE OR REPLACE FUNCTION public.fn_web_mov_commit(p_run_id uuid, p_fecha_desde date, p_fecha_hasta date, p_tipo text, p_origen text, p_modo text DEFAULT 'manual'::text, p_http_status integer DEFAULT 200, p_bytes integer DEFAULT NULL::integer, p_dur_ms integer DEFAULT NULL::integer, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'contifico_web'
AS $function$
DECLARE
  v_filas integer := 0; v_docs integer := 0; v_nuevos integer := 0; v_act integer := 0; v_borrados integer := 0;
  v_vivos integer := 0; v_motivo text; v_testigo text; v_confirmado boolean := false;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _codes (codigo varchar(32) PRIMARY KEY, origen_prev varchar(3)) ON COMMIT DROP;
  TRUNCATE _codes;
  INSERT INTO _codes (codigo, origen_prev)
  SELECT s.codigo, d.origen
  FROM (SELECT DISTINCT codigo FROM contifico_web.mov_inventario_stage WHERE run_id = p_run_id) s
  LEFT JOIN contifico_web.mov_inventario_doc d ON d.codigo = s.codigo;
  SELECT count(*) INTO v_docs FROM _codes;

  -- Guarda (incidente 06-sep-2026): tres exports AJU llegaron vacíos (solo cabecera, 5.632 bytes) por un fallo
  -- del portal y el bloque de fantasmas dio de baja 37 documentos de agosto que seguían vivos en Contifico.
  -- Un export sin documentos, cuando en la DB hay documentos vivos para ese mismo rango/tipo/origen, es
  -- sospechoso: no se toca nada, queda ok=false en sync_log y el scraper lo cuenta como fallo (avisa por WhatsApp).
  IF v_docs = 0 THEN
    SELECT count(*) INTO v_vivos FROM contifico_web.mov_inventario_doc d
     WHERE d.deleted_at IS NULL AND d.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
       AND d.tipo = p_tipo AND (p_origen IS NULL OR d.origen = p_origen);
    -- Testigo (01-oct-2026). La guarda sola no distingue "el portal devolvió vacío por error" de "esos
    -- documentos se borraron de verdad en Contifico": Contabilidad eliminó 10 ajustes ("AJUSTE DE COSTO
    -- PENDIENTE ELIMINAR", 19 al 28-sep) y la guarda los sostuvo vivos, con el scrape en rojo cada día y la
    -- relectura del 22-sep sin poder cerrarse nunca. Ahora el scraper puede probar que el export de ese
    -- tipo SÍ responde: baja y asienta el día de otro documento vivo (el testigo) y vuelve a leer el rango.
    -- Aquí no se le cree de palabra: el testigo tiene que constar como visto por ESTA misma corrida hace
    -- menos de 10 minutos, ser del mismo tipo (y origen) y caer fuera del rango. Si consta, el vacío es
    -- real y el bloque de fantasmas da de baja esos documentos (reversible: si un export posterior los
    -- trae, reviven).
    IF v_vivos > 0 AND coalesce(p_meta #>> '{testigo,codigo}', '') <> '' THEN
      SELECT d.codigo INTO v_testigo FROM contifico_web.mov_inventario_doc d
       WHERE d.codigo = p_meta #>> '{testigo,codigo}'
         AND d.last_run_id = p_run_id AND d.last_seen_at >= now() - interval '10 minutes'
         AND d.deleted_at IS NULL AND d.tipo = p_tipo AND (p_origen IS NULL OR d.origen = p_origen)
         AND d.fecha NOT BETWEEN p_fecha_desde AND p_fecha_hasta;
      v_confirmado := v_testigo IS NOT NULL;
    END IF;
    IF v_vivos > 0 AND NOT v_confirmado THEN
      v_motivo := format('export vacío sospechoso: 0 docs en el export y %s docs vivos en %s..%s %s/%s; no se marcan fantasmas',
                         v_vivos, p_fecha_desde, p_fecha_hasta, p_tipo, coalesce(p_origen, 'TODOS'));
      -- Sondeo: el scraper pregunta antes de darlo por fallo. No se asienta nada todavía (cada slice
      -- deja UNA sola fila en sync_log); él intenta el testigo y vuelve a llamar sin esta marca.
      IF coalesce(p_meta ->> 'sondeo', '') = 'true' THEN
        DELETE FROM contifico_web.mov_inventario_stage WHERE run_id = p_run_id;
        RETURN jsonb_build_object('ok', false, 'necesita_testigo', true, 'motivo', v_motivo, 'vivos', v_vivos,
                                  'filas', 0, 'docs', 0, 'nuevos', 0, 'actualizados', 0, 'borrados', 0);
      END IF;
      INSERT INTO contifico_web.sync_log (run_id, modo, fecha_desde, fecha_hasta, tipo, origen, ok, http_status, bytes, filas, docs, docs_nuevos, docs_actualizados, docs_borrados, dur_ms, error, meta)
      VALUES (p_run_id, p_modo, p_fecha_desde, p_fecha_hasta, p_tipo, p_origen, false, p_http_status, p_bytes, 0, 0, 0, 0, 0, p_dur_ms, v_motivo,
              (p_meta - 'sondeo') || jsonb_build_object('guarda', 'export_vacio', 'docs_vivos', v_vivos));
      DELETE FROM contifico_web.mov_inventario_stage WHERE run_id = p_run_id;
      RETURN jsonb_build_object('ok', false, 'motivo', v_motivo, 'vivos', v_vivos, 'filas', 0, 'docs', 0, 'nuevos', 0, 'actualizados', 0, 'borrados', 0);
    END IF;
  END IF;
  -- resolver origen en stage cuando viene NULL (slice "Todos")
  UPDATE contifico_web.mov_inventario_stage st
     SET origen = COALESCE(
           st.origen,
           CASE WHEN st.referencia_tipo IN ('FAC','NVE','DNA','LQR','LQC','NDT','NCT') THEN 'DOC'
                WHEN st.referencia_tipo = 'PRO' THEN 'PRO' END,
           c.origen_prev)
    FROM _codes c
   WHERE st.run_id = p_run_id AND st.codigo = c.codigo AND st.origen IS NULL;

  -- reemplazo por documento
  DELETE FROM contifico_web.mov_inventario_detalle d USING _codes c WHERE d.codigo = c.codigo;
  INSERT INTO contifico_web.mov_inventario_detalle
    (fecha, codigo, tipo, origen, bodega_origen, bodega_destino, descripcion, cantidad, unidad, codigo_prod, nombre_prod, serie,
     pvp, valor_unitario, valor_total, referencia, referencia_tipo, referencia_num, centro_costo, proyecto, categoria_prod, orden_compra_venta,
     row_num, run_id, scraped_at)
  SELECT fecha, codigo, tipo, origen, bodega_origen, bodega_destino, descripcion, cantidad, unidad, codigo_prod, nombre_prod, serie,
         pvp, valor_unitario, valor_total, referencia, referencia_tipo, referencia_num, centro_costo, proyecto, categoria_prod, orden_compra_venta,
         row_num, p_run_id, now()
  FROM contifico_web.mov_inventario_stage WHERE run_id = p_run_id;
  GET DIAGNOSTICS v_filas = ROW_COUNT;

  -- cabeceras
  WITH agg AS (
    SELECT codigo, min(fecha) AS fecha, min(tipo) AS tipo, min(origen) AS origen,
           min(bodega_origen) AS bodega_origen, min(bodega_destino) AS bodega_destino,
           min(descripcion) AS descripcion, min(referencia) AS referencia,
           count(*) AS n_lineas, sum(valor_total) AS valor_total
    FROM contifico_web.mov_inventario_stage WHERE run_id = p_run_id GROUP BY codigo
  ), up AS (
    INSERT INTO contifico_web.mov_inventario_doc AS d
      (codigo, fecha, tipo, origen, bodega_origen, bodega_destino, descripcion, referencia, n_lineas, valor_total, first_seen_at, last_seen_at, last_run_id, deleted_at)
    SELECT codigo, fecha, tipo, origen, bodega_origen, bodega_destino, descripcion, referencia, n_lineas, valor_total, now(), now(), p_run_id, NULL FROM agg
    ON CONFLICT (codigo) DO UPDATE SET
      fecha = EXCLUDED.fecha, tipo = EXCLUDED.tipo, origen = COALESCE(EXCLUDED.origen, d.origen),
      bodega_origen = EXCLUDED.bodega_origen, bodega_destino = EXCLUDED.bodega_destino, descripcion = EXCLUDED.descripcion,
      referencia = EXCLUDED.referencia, n_lineas = EXCLUDED.n_lineas, valor_total = EXCLUDED.valor_total,
      last_seen_at = now(), last_run_id = p_run_id, deleted_at = NULL
    RETURNING (xmax = 0) AS is_insert
  )
  SELECT count(*) FILTER (WHERE is_insert), count(*) FILTER (WHERE NOT is_insert) INTO v_nuevos, v_act FROM up;

  -- fantasmas: docs del mismo rango/tipo(/origen) que ya no vienen en el export
  UPDATE contifico_web.mov_inventario_doc d
     SET deleted_at = now()
   WHERE d.deleted_at IS NULL
     AND d.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
     AND d.tipo = p_tipo
     AND (p_origen IS NULL OR d.origen = p_origen)
     AND NOT EXISTS (SELECT 1 FROM _codes c WHERE c.codigo = d.codigo);
  GET DIAGNOSTICS v_borrados = ROW_COUNT;

  INSERT INTO contifico_web.sync_log (run_id, modo, fecha_desde, fecha_hasta, tipo, origen, ok, http_status, bytes, filas, docs, docs_nuevos, docs_actualizados, docs_borrados, dur_ms, meta)
  VALUES (p_run_id, p_modo, p_fecha_desde, p_fecha_hasta, p_tipo, p_origen, true, p_http_status, p_bytes, v_filas, v_docs, v_nuevos, v_act, v_borrados, p_dur_ms,
          (p_meta - 'sondeo') || CASE WHEN v_confirmado
            THEN jsonb_build_object('guarda', 'export_vacio_confirmado', 'docs_vivos', v_vivos) ELSE '{}'::jsonb END);

  DELETE FROM contifico_web.mov_inventario_stage WHERE run_id = p_run_id;
  RETURN jsonb_build_object('ok', true, 'filas', v_filas, 'docs', v_docs, 'nuevos', v_nuevos, 'actualizados', v_act, 'borrados', v_borrados)
         || CASE WHEN v_confirmado THEN jsonb_build_object('confirmado_con_testigo', v_testigo) ELSE '{}'::jsonb END;
END
$function$;
