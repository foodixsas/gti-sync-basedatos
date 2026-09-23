-- Robot diario de fórmulas con grupos (Contífico web).
-- El export Excel y la API aplanan la fórmula; el HTML de
-- /sistema/inventario/producto/consultar/{pk}/ trae los grupos:
--   NE = No Elegible (fijo, se suman todas las líneas)
--   UN = Sólo Uno (el cliente elige una)
--   VA = Varios o Ninguno (el cajero puede marcar cualquiera o ninguna)
-- Este robot solo LEE y guarda la fórmula tal cual. La regla de costeo
-- (mezcla real de ventas, y "la más cara" si no hay datos) va aparte.

CREATE TABLE IF NOT EXISTS contifico_web.producto_pk (
  codigo          text PRIMARY KEY,
  pk_web          bigint NOT NULL,
  id_integracion  text,
  nombre          text,
  tipo_producto   text,
  costo_contifico numeric,
  actualizado_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE contifico_web.producto_pk IS
  'Código de producto → pk interno del sitio web de Contífico (distinto del id de la API). Cache del robot de fórmulas.';

CREATE TABLE IF NOT EXISTS contifico_web.formula_linea (
  producto_codigo    text NOT NULL,
  producto_pk        bigint NOT NULL,
  grupo_orden        int NOT NULL,
  grupo_nombre       text,
  grupo_tipo         text NOT NULL CHECK (grupo_tipo IN ('NE','UN','VA')),
  linea_orden        int NOT NULL,
  ingrediente_pk     bigint NOT NULL,
  ingrediente_codigo text,
  ingrediente_nombre text,
  cantidad           numeric,
  unidad             text,
  run_id             uuid NOT NULL,
  scraped_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (producto_codigo, grupo_orden, linea_orden)
);
CREATE INDEX IF NOT EXISTS formula_linea_ingrediente_idx ON contifico_web.formula_linea (ingrediente_codigo);
COMMENT ON TABLE contifico_web.formula_linea IS
  'Fórmula vigente de cada producto compuesto/producido según la web de Contífico, con su grupo (NE/UN/VA). Se reemplaza por producto en cada corrida.';

-- Latido: una fila por corrida, aunque no haya cambios.
CREATE TABLE IF NOT EXISTS contifico_web.formula_run (
  run_id           uuid PRIMARY KEY,
  iniciado_at      timestamptz NOT NULL DEFAULT now(),
  terminado_at     timestamptz,
  productos_ok     int,
  productos_error  int,
  lineas           int,
  detalle          jsonb
);

-- Reemplaza la fórmula de los productos leídos en el lote (transaccional).
CREATE OR REPLACE FUNCTION public.fn_web_formula_commit(p_run_id uuid, p_pks jsonb, p_productos text[], p_lineas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = contifico_web, public AS $$
DECLARE v_pks int; v_lineas int;
BEGIN
  INSERT INTO contifico_web.producto_pk (codigo, pk_web, id_integracion, nombre, tipo_producto, costo_contifico, actualizado_at)
  SELECT x->>'codigo', (x->>'pk_web')::bigint, x->>'id_integracion', x->>'nombre', x->>'tipo_producto',
         nullif(x->>'costo','')::numeric, now()
  FROM jsonb_array_elements(coalesce(p_pks,'[]'::jsonb)) x
  ON CONFLICT (codigo) DO UPDATE SET pk_web = EXCLUDED.pk_web, id_integracion = EXCLUDED.id_integracion,
    nombre = EXCLUDED.nombre, tipo_producto = EXCLUDED.tipo_producto, costo_contifico = EXCLUDED.costo_contifico,
    actualizado_at = now();
  GET DIAGNOSTICS v_pks = ROW_COUNT;

  DELETE FROM contifico_web.formula_linea WHERE producto_codigo = ANY(p_productos);
  INSERT INTO contifico_web.formula_linea (producto_codigo, producto_pk, grupo_orden, grupo_nombre, grupo_tipo,
    linea_orden, ingrediente_pk, ingrediente_codigo, ingrediente_nombre, cantidad, unidad, run_id)
  SELECT x->>'producto_codigo', (x->>'producto_pk')::bigint, (x->>'grupo_orden')::int, x->>'grupo_nombre',
         x->>'grupo_tipo', (x->>'linea_orden')::int, (x->>'ingrediente_pk')::bigint, x->>'ingrediente_codigo',
         x->>'ingrediente_nombre', nullif(x->>'cantidad','')::numeric, x->>'unidad', p_run_id
  FROM jsonb_array_elements(coalesce(p_lineas,'[]'::jsonb)) x;
  GET DIAGNOSTICS v_lineas = ROW_COUNT;
  RETURN jsonb_build_object('pks', v_pks, 'productos', coalesce(array_length(p_productos,1),0), 'lineas', v_lineas);
END $$;

CREATE OR REPLACE FUNCTION public.fn_web_formula_pks()
RETURNS TABLE (codigo text, pk_web bigint, nombre text)
LANGUAGE sql SECURITY DEFINER SET search_path = contifico_web, public AS $$
  SELECT codigo, pk_web, nombre FROM contifico_web.producto_pk
$$;

CREATE OR REPLACE FUNCTION public.fn_web_formula_run(p_run_id uuid, p_terminado boolean, p_ok int, p_error int, p_lineas int, p_detalle jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = contifico_web, public AS $$
  INSERT INTO contifico_web.formula_run (run_id, terminado_at, productos_ok, productos_error, lineas, detalle)
  VALUES (p_run_id, CASE WHEN p_terminado THEN now() END, p_ok, p_error, p_lineas, p_detalle)
  ON CONFLICT (run_id) DO UPDATE SET terminado_at = EXCLUDED.terminado_at, productos_ok = EXCLUDED.productos_ok,
    productos_error = EXCLUDED.productos_error, lineas = EXCLUDED.lineas, detalle = EXCLUDED.detalle
$$;

REVOKE ALL ON FUNCTION public.fn_web_formula_commit(uuid, jsonb, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_web_formula_pks() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_web_formula_run(uuid, boolean, int, int, int, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_web_formula_commit(uuid, jsonb, text[], jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_web_formula_pks() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_web_formula_run(uuid, boolean, int, int, int, jsonb) TO service_role;
REVOKE ALL ON contifico_web.producto_pk, contifico_web.formula_linea, contifico_web.formula_run FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
