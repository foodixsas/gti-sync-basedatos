-- Cola de días de Contífico web que hay que volver a leer.
--
-- Por qué existe (01-oct-2026). Cuando Contabilidad corrige un movimiento en
-- Contífico y marca "error ya corregido" en Control de Costos, el dashboard
-- disparaba un workflow_dispatch por cada día. Dos fallas, las dos silenciosas:
--   1. En producción faltaba la llave (GITHUB_PAT): ninguna relectura corrió
--      nunca. 36 días marcados, 29 sin releer; la referencia de costo de la
--      Esencia Michelada siguió en $5,47/kg con datos leídos el 18-ago.
--   2. Aun con la llave, el workflow tiene `concurrency` con un solo cupo en
--      espera: si llegan tres pedidos seguidos, GitHub cancela el del medio.
--      Luis registra varios días uno tras otro: se habrían perdido.
--
-- Con la cola, el pedido queda escrito en la base ANTES de despertar a nadie.
-- El dispatch pasa a ser un aviso ("hay pendientes"); la corrida diaria también
-- vacía la cola. Si el dispatch falla, el día se relee igual a más tardar al
-- día siguiente, y lo que no se ha releído se puede contar: fila con
-- hecho_at IS NULL.

CREATE TABLE IF NOT EXISTS contifico_web.mov_inventario_relectura (
  fecha             date PRIMARY KEY,
  pedido_at         timestamptz NOT NULL DEFAULT now(),
  ultimo_pedido_at  timestamptz NOT NULL DEFAULT now(),
  pedido_por        text,
  motivo            text,
  veces_pedido      int NOT NULL DEFAULT 1,
  intentos          int NOT NULL DEFAULT 0,
  ultimo_intento_at timestamptz,
  ultimo_error      text,
  hecho_at          timestamptz,
  run_id            uuid
);
CREATE INDEX IF NOT EXISTS mov_inventario_relectura_pendiente_idx
  ON contifico_web.mov_inventario_relectura (pedido_at) WHERE hecho_at IS NULL;
COMMENT ON TABLE contifico_web.mov_inventario_relectura IS
  'Días de Contífico web pendientes de volver a leer (una fila por día). hecho_at NULL = pendiente. La llena el dashboard al marcar "error ya corregido"; la vacía scrape-mov-inventario --pendientes.';
COMMENT ON COLUMN contifico_web.mov_inventario_relectura.pedido_at IS
  'Primer pedido del ciclo pendiente actual: mide cuánto lleva esperando.';
COMMENT ON COLUMN contifico_web.mov_inventario_relectura.ultimo_pedido_at IS
  'Último pedido. Una relectura solo cierra la fila si empezó DESPUÉS de este momento: un pedido que llega a mitad de la lectura no se pierde.';

GRANT SELECT, INSERT, UPDATE, DELETE ON contifico_web.mov_inventario_relectura TO service_role;

-- Pedir la relectura de uno o varios días. Idempotente por día.
CREATE OR REPLACE FUNCTION public.fn_web_relectura_pedir(
  p_fechas date[], p_por text DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'contifico_web'
AS $function$
DECLARE
  v_hoy date := (now() AT TIME ZONE 'America/Guayaquil')::date;
  v_validas date[];
  v_n int := 0;
BEGIN
  -- Sin nulos, sin repetidos, sin días que todavía no existen.
  SELECT coalesce(array_agg(DISTINCT f), '{}') INTO v_validas
    FROM unnest(coalesce(p_fechas, '{}')) AS f
   WHERE f IS NOT NULL AND f <= v_hoy AND f >= DATE '2020-01-01';

  INSERT INTO contifico_web.mov_inventario_relectura AS r (fecha, pedido_por, motivo)
  SELECT f, p_por, p_motivo FROM unnest(v_validas) AS f
  ON CONFLICT (fecha) DO UPDATE SET
    -- Ya releída y la vuelven a pedir: ciclo nuevo. Si seguía pendiente, el
    -- primer pedido conserva su hora (así la espera se mide desde el principio).
    pedido_at        = CASE WHEN r.hecho_at IS NOT NULL THEN now() ELSE r.pedido_at END,
    intentos         = CASE WHEN r.hecho_at IS NOT NULL THEN 0 ELSE r.intentos END,
    ultimo_error     = CASE WHEN r.hecho_at IS NOT NULL THEN NULL ELSE r.ultimo_error END,
    hecho_at         = NULL,
    run_id           = NULL,
    ultimo_pedido_at = now(),
    veces_pedido     = r.veces_pedido + 1,
    pedido_por       = coalesce(EXCLUDED.pedido_por, r.pedido_por),
    motivo           = coalesce(EXCLUDED.motivo, r.motivo);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object(
    'pedidas', v_n,
    'descartadas', coalesce(array_length(p_fechas, 1), 0) - coalesce(array_length(v_validas, 1), 0),
    'pendientes_total', (SELECT count(*) FROM contifico_web.mov_inventario_relectura WHERE hecho_at IS NULL));
END
$function$;

-- Lo que falta por releer, lo más viejo primero.
CREATE OR REPLACE FUNCTION public.fn_web_relectura_pendientes(p_max int DEFAULT 200)
RETURNS TABLE (fecha date, pedido_at timestamptz, intentos int)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'contifico_web'
AS $function$
  SELECT r.fecha, r.pedido_at, r.intentos
    FROM contifico_web.mov_inventario_relectura r
   WHERE r.hecho_at IS NULL
   ORDER BY r.pedido_at, r.fecha
   LIMIT greatest(coalesce(p_max, 200), 1);
$function$;

-- Resultado de releer un día. p_iniciado_at = cuándo empezó a leerse ese día:
-- si alguien lo volvió a pedir después, la fila queda pendiente.
CREATE OR REPLACE FUNCTION public.fn_web_relectura_marcar(
  p_fecha date, p_ok boolean, p_run_id uuid, p_iniciado_at timestamptz, p_error text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'contifico_web'
AS $function$
DECLARE
  v_cerrada boolean := false;
BEGIN
  IF p_ok THEN
    UPDATE contifico_web.mov_inventario_relectura
       SET hecho_at = now(), run_id = p_run_id, ultimo_intento_at = now(),
           intentos = intentos + 1, ultimo_error = NULL
     WHERE fecha = p_fecha AND hecho_at IS NULL AND ultimo_pedido_at <= p_iniciado_at;
    v_cerrada := FOUND;
    IF NOT v_cerrada THEN
      -- Pedida de nuevo mientras se leía: cuenta el intento y sigue pendiente.
      UPDATE contifico_web.mov_inventario_relectura
         SET ultimo_intento_at = now(), intentos = intentos + 1
       WHERE fecha = p_fecha AND hecho_at IS NULL;
    END IF;
  ELSE
    UPDATE contifico_web.mov_inventario_relectura
       SET ultimo_intento_at = now(), intentos = intentos + 1,
           ultimo_error = left(coalesce(p_error, 'sin detalle'), 500), run_id = p_run_id
     WHERE fecha = p_fecha AND hecho_at IS NULL;
  END IF;
  RETURN jsonb_build_object('fecha', p_fecha, 'cerrada', v_cerrada);
END
$function$;

REVOKE ALL ON FUNCTION public.fn_web_relectura_pedir(date[], text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_web_relectura_pendientes(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_web_relectura_marcar(date, boolean, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_web_relectura_pedir(date[], text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_web_relectura_pendientes(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_web_relectura_marcar(date, boolean, uuid, timestamptz, text) TO service_role;
