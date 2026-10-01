-- 2026-10-01 · Código corto de tienda (CH001…SB001) en el mapeo de tiendas de Uber.
--
-- Lo necesita el flujo de quejas del dashboard: una opinión de Uber se enruta al
-- grupo TEAM del local por su código corto, el mismo que usan las encuestas.
-- El valor NO se escribe a mano: se deriva de la evidencia que ya está en la tabla
-- (centro_costo_nombre) cruzada con el catálogo canónico de centros de costo
-- (gth_talento_humano.gth_th_centros_costo.nombre), comparando sin tildes y en
-- mayúsculas. Si una fila queda sin código, la migración falla en vez de callar.
-- Idempotente: se puede volver a aplicar.

ALTER TABLE ubereats_raw.uber_tiendas ADD COLUMN IF NOT EXISTS tienda_codigo text;

UPDATE ubereats_raw.uber_tiendas u
   SET tienda_codigo = t.codigo,
       updated_at = now()
  FROM gth_talento_humano.gth_th_centros_costo t
 WHERE u.tienda_codigo IS NULL
   AND t.activo
   AND upper(translate(t.nombre, 'ÁÉÍÓÚÑáéíóúñ', 'AEIOUNaeioun')) = upper(translate(u.centro_costo_nombre, 'ÁÉÍÓÚÑáéíóúñ', 'AEIOUNaeioun'));

DO $$
DECLARE v_sin int;
BEGIN
  SELECT count(*) INTO v_sin FROM ubereats_raw.uber_tiendas WHERE tienda_codigo IS NULL;
  IF v_sin > 0 THEN
    RAISE EXCEPTION 'uber_tiendas: % fila(s) sin tienda_codigo; revisar centro_costo_nombre vs gth_th_centros_costo', v_sin;
  END IF;
END $$;

COMMENT ON COLUMN ubereats_raw.uber_tiendas.tienda_codigo IS
  'Código corto de tienda (CH001…SB001) = gth_talento_humano.gth_th_centros_costo.codigo. Derivado del centro de costo, no escrito a mano.';
