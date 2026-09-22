-- Informe "Detalles de pago" de Uber Eats Manager (REPORT_TYPE_PAYMENT_DETAILS_REPORT).
-- Una fila por movimiento que Uber liquida: pedidos, reembolsos y cargos sueltos
-- (gasto en anuncios, otras tarifas, redondeos de IVA), que no traen pedido.
--
-- Por qué importa: es la única fuente real de la comisión de Uber (tasa_servicio)
-- y de cuánto pone Uber en cada promoción (ajuste_marketing = cofinanciamiento).
--
-- Llave: tienda + pedido + estado + fecha del pedido + concepto. Verificado sin
-- repetidos en 1.698 filas (11 al 22-sep-2026). NO incluye fecha de pago ni
-- referencia: un pedido llega "pendiente" y días después se liquida; con esta
-- llave el upsert actualiza la misma fila en vez de duplicarla.
-- Montos tal cual los da Uber: lo que Uber descuenta llega en negativo.
CREATE TABLE IF NOT EXISTS ubereats_raw.uber_pagos (
  id                         bigserial PRIMARY KEY,
  informe_id                 bigint NOT NULL REFERENCES ubereats_raw.uber_informes(id),
  llave                      text NOT NULL UNIQUE,
  tienda                     text NOT NULL,
  tienda_codigo_externo      text,
  tienda_uuid                uuid,
  pedido_codigo              text,
  flujo_uuid                 uuid,
  pedido_fecha               date,
  aceptado_hora              text,
  completado_at              timestamp without time zone,
  modalidad                  text,
  canal                      text,
  estado                     text,
  membresia_uber             text,
  moneda                     text,
  ventas_con_iva             numeric,
  iva_ventas                 numeric,
  cargo_error_sin_iva        numeric,
  iva_cargo_error            numeric,
  cargo_error_con_iva        numeric,
  ajuste_precios_sin_iva     numeric,
  iva_ajuste_precios         numeric,
  promociones_articulos      numeric,
  tarifa_canje_oferta        numeric,
  iva_tarifa_canje_oferta    numeric,
  ajuste_marketing           numeric,
  cupon_comida               numeric,
  cupon_proveedor            text,
  ventas_despues_ajustes     numeric,
  promociones_envio          numeric,
  tasa_servicio_sin_iva      numeric,
  iva_tasa_servicio          numeric,
  retencion_iva              numeric,
  retencion_renta            numeric,
  tarifa_solicitud           numeric,
  propinas                   numeric,
  otros_pagos_descripcion    text,
  otras_ganancias            numeric,
  efectivo_recibido          numeric,
  embargo                    numeric,
  pago_total                 numeric,
  pago_fecha                 date,
  factura_url                text,
  referencia_ganancias       text,
  fila_cruda                 jsonb,
  capturado_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uber_pagos_tienda_fecha_idx ON ubereats_raw.uber_pagos (tienda_uuid, pedido_fecha DESC);
CREATE INDEX IF NOT EXISTS uber_pagos_flujo_idx ON ubereats_raw.uber_pagos (flujo_uuid);
CREATE INDEX IF NOT EXISTS uber_pagos_pago_fecha_idx ON ubereats_raw.uber_pagos (pago_fecha);

COMMENT ON TABLE ubereats_raw.uber_pagos IS
  'Detalles de pago de Uber Eats por movimiento. Fuente de comisión real (tasa_servicio_sin_iva) y cofinanciamiento de promociones (ajuste_marketing). Carga diaria: uber-order-history-daily.yml.';

GRANT SELECT, INSERT, UPDATE, DELETE ON ubereats_raw.uber_pagos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ubereats_raw.uber_pagos_id_seq TO service_role;
-- Datos crudos de un proveedor: nadie más los lee.
REVOKE ALL ON ubereats_raw.uber_pagos FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
