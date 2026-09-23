# 08 · Transacciones (menú "registro")

Estado: 🔄 primera versión (22-sep-2026). Faltan: listas de documentos y sus filtros, anulaciones, POS, bandeja electrónica (barrido en curso).

## 1. Qué hace
Todo el ciclo documental: facturas de venta (POS y manuales), compras, notas de crédito/débito, liquidaciones, retenciones, anticipos, proformas/cotizaciones/prefacturas/órdenes, cobros y pagos, cruces, depósitos (cierre de caja), guías de remisión, carga de XML del SRI (bandeja electrónica) y anulaciones. Emite y firma comprobantes electrónicos y los envía al SRI.

## 2. Entidades y campos

### Documento (`registro/documento/registrar/`; `?de=1` electrónico; `?proforma=1`, `?cotizacion=1`, `?prefactura=1`)
- Cabecera: `fecha_emision`, `tipo_registro_documento` CLI/PRO, `tipo_documento` (físico: 20 tipos con código SRI: FAC, NVE, LQC, LMU, DNA, DAC, EIF, NDT, NCT, NCL, REE, PEA, BEP, CPA, TMR, EIE, EXP, CVE…; electrónico: FAC, NDT, NCT, REE, LQC, LQR; proforma: COT, PRE, **OCV Orden Compra/Contrato**), `establecimiento` (esta cuenta solo `001`) + `punto_emision` + `numero_documento`, `autorizacion`, `persona_id`, `vendedor_id` (26 vendedores = usuarios), `referencia`, `documento_relacionado_id`, `vencimiento`, `propina`, `bodega_id` (default 59587), `sin_movimiento` (no toca inventario), `aplica_iva_12`/`porcentaje_iva` (IVA manual), `descripcion`, `adicional1`, `adicional2`, `pagado_caja_chica`, `guardar_enviar_sri`, `es_agrupar`, `duplicar`, `numero_cuotas`.
- Líneas de 4 clases: **producto** (`producto_template`: cantidad, producto, unidad, precio compra/venta (pvp elegido o manual), % IVA 12/14/15/5/8/0/no objeto, ICE, descuento, centro de costo, proyecto, lote, serie, color, nombre manual), **cuenta contable** (`cuenta_template`: gasto directo con centro de costo, IVA, ICE, retenciones), **activo fijo** (`activofijo_template`: nombre, código, categoría, tipo, ubicación, % depreciación 5/10/20/33, valor inicial/actual, fecha inicio depreciación) y **reembolso** (`docreembolsoproveedor_template`: identificación, tipo de comprobante SRI por tipo de id, bases, IVA, ICE).
- **Retención (dentro del documento de compra)**: `fecha_emision_retencion`, `fecha_periodo_fiscal_*`, `tipo_retencion` F/E, `numero_documento_retencion`, `autorizacion_retencion`, `establecimiento_retencion` (001), `punto_emision_retencion`, `excluir_secuencia_retencion`, `guardar_enviar_sri_retencion`; líneas `retencion_template` (IR) y `retencion_iva_template` (IVA) con `codigo_sri`, `base`, `porcentaje`, `valor`, `gasto`, `tipo_documento_reembolso`. Campos para el ATS: `regimen_retencion` (general, paraíso fiscal, régimen preferente), país del pago, `doble_tributacion`, `pago_sujeto_retencion`, `denominacion_regimen_preferente`, utilidades (`anio_utilidades`, `monto_pagado_ir`, fracción básica).
- **Formas de pago SRI** (`pago_template`): `forma_pago` 01, 15, 16, 17, 18, 19, 20, 21 + `plazo`/`unidad` días/meses + `valor`.
- Totales: `subtotal_iva`, `subtotal_iva_5`, `subtotal_0`, `descuento`, `iva`, `iva_5`, `ice`, `total`.
- Acciones: `frm_firmar` → `POST registro/documento/firmar/` (firma con clave del certificado `id_password_firma`), `frm_enviar_proforma`, `cargar_datos_xml/` (leer XML de compra), `secuencia/`, `get_secuencia_dac/`, `get_secuencia_proforma/`, `agrupar_documentos/`, `login_tienda/`.

API v2 `Documento`: `id`, `pos` (api token del POS), `fecha_creacion`, `fecha_emision`, `hora_emision`, `tipo_documento` "FAC, LQC, PRE, NCT, COT", `tipo_registro`, `documento` (número), `estado` **P pendiente, C cobrado, G pagado, A anulado, E generado, F facturado**, `anulado`, `autorizacion`, `caja_id`, `persona_id`, `vendedor`, `descripcion`, `subtotal_0`, `subtotal_12`, `iva`, `ice`, `servicio`, `total`, `saldo`, `saldo_anticipo`, `adicional1/2`, `documento_relacionado_id`, `reserva_relacionada`, `url_ride`, `url_xml`, `entregado`, `electronico`, `logistica`, `fecha_vencimiento`, `tipo_descuento` P/U, `placa`, `fecha/hora/direccion_evento`, `pax`, **`tipo_domicilio` (UB uber, GL glovo)**, `orden_domicilio_id`, `autorizado_sri`, `enviado_sri`, `correo_enviado`, `retencion_*`, `numero_cuotas`, `detalles[]`, `cobros[]`, `retenciones[]`. Coincide 1:1 con `contifico_raw.trx_documentos`.

### Cobro/Pago (`registro/transaccion/registrar/`, `?masivo=1`) y Cruce (`cruzar_documentos/`)
`tipo_transaccion` C/P; `forma_cobro` CAJA, CAJACHEQUE, TRANSF, TC, ELEC; `forma_pago` CHEQUE, TRANSF, CAJA CHICA, TC, ELEC; subcódigos SRI: transferencia 06–09/20/21, tarjeta 10/11, cheque 02–05; `tipo_tarjeta` (25: Visa, Mastercard, Diners, Amex, Discover, débito, por banco); `cuenta_bancaria_id`, `numero_comprobante`, `check_efectivo`, `numero_cheque`, `fecha_cheque`, `lote` (tarjeta), `monto_propina`, `notificacion_correo`; líneas contra **documentos** (`valor_pago`), **anticipos** o **cuentas contables** (con persona y centro de costo). Cruce: `forma_pago_cruce` 02–15 (15 = compensación de deudas). `cobros[]` de la API: `forma_cobro`, `monto`, `monto_propina`, `bin_tarjeta`, `nombre_tarjeta`, `numero_tarjeta`, `lote`, `caja_id`, `cuenta_bancaria_id`, `numero_cheque`, `fecha_cheque`, `tipo_banco`, `tipo_ping`, `numero_comprobante`.

### Depósito (`registro/deposito/registrar/`)
Cierre de caja: `fecha_corte`, `filtro_caja` (POS), `cuenta_banco`, `fecha`, `numero_comprobante`; toma las transacciones en caja y los "Empleado / Descripción" (pagos desde caja) y los deposita. **Cajas de FOODIX** (id → nombre): 9830122 Caja · 10809454 Floreana 003-001 · 10809456 Floreana 003-002 · 10809457 Real Audiencia 002-001 · 14452547 Real Audiencia 002-002 · 10809459 Portugal 004-001 · 11059621 Portugal 004-002 · 14460550 Simón Bolón 005-001 · 14473763 Simón Bolón 005-002 · 14502545 Santo Cachón 006-001 · 14515939 Portugal 007-001 (Santo Cachón Portugal ⚠ inferido por el 007 de las facturas) · 14525844 Diferencias en cajas 2025 · 14432231 Fondo…

### Guía de remisión (`registro/documento/guiaremision/registrar/`)
`electronico`, `establecimiento` 001, `punto_emision`, `numero_documento`, `autorizacion`, `transportista` (persona), `placa`, `fecha_inicio/fin`, `bodega`, `direccion_partida`, `generar_traslado` (guía interna → traslado de inventario), `bodega_destino`, `persona`, `documento`, `direccion`, `motivo`, `ruta`, `codigo_destino`; líneas cantidad/producto/serie/lote. FOODIX: 3 guías en 4 años (no las usa).

## 3. Flujos y estados
- Factura POS: la caja (POS) crea FAC con `pos`, `caja_id`, `cobros[]`; queda `estado=C` (cobrado) y `electronico`; se firma y envía al SRI (`firmado`, `enviado_sri`, `autorizado_sri`, `url_xml`, `url_ride`). En 2026: 98.4 % de las FAC CLI son electrónicas; 0.4 % anuladas.
- Compra: FAC PRO (manual o desde XML de la bandeja) → líneas producto (ING de inventario a la bodega) o cuenta (gasto) → retención emitida (F/E) → `estado=P` hasta el pago (`G`).
- NC cliente: `documento_relacionado_id` a la FAC; ⏳ efecto en inventario (devolución) y SRI.
- Anulación: `registro/documento_anulado/` (⏳ ver flujo y si revierte inventario y asiento).
- Proforma → prefactura → factura; OCV = orden de compra/venta con aprobación (permiso `reg_proforma_aprob_orden`).
- Cuotas (`numero_cuotas`, `tiene_cuotas_cobradas_pagadas`) para crédito.

## 4. Reglas de negocio y legales
- Numeración `EEE-PPP-NNNNNNNNN` por establecimiento y punto de emisión; `secuencia/` la calcula el servidor.
- Retención obligatoria al proveedor según tipo de contribuyente (persona: `tipo_retencion_ir`, `tipo_retencion_iva` por defecto); códigos SRI por línea; emisión electrónica de la retención con su propia secuencia 001-PPP.
- Formas de pago con códigos del ATS; IVA 8 % en feriados por fecha.
- Reembolsos de gastos con detalle de comprobantes de terceros.

## 5. Cómo se accede
- API v2 `/documento/` (filtros `tipo_registro`, `tipo`, `fecha_inicial/final`, `persona_id`, `bodega_id`, `fecha_modificacion` en YYYY-MM-DD), `/documento/{id}`, `/estado/{id}`, `/cobro/`, `/forma_pago`; POST/PUT documentos y cobros (escritura, fuera de alcance). 762,817 documentos en total.
- Web: `registro/documento/?excel=1` (1 fila por documento) y `?excel_por_producto=1` (44 columnas por línea, con centro de costo). Formularios POST con csrf para registrar.

## 6. Uso real en FOODIX (Supabase, 22-sep-2026)
| Documento | CLI | PRO |
|---|---:|---:|
| FAC | 722,036 | 32,571 |
| DNA (no autorizado) | 23,329 | 1,097 |
| NCT | 355 | 1,089 |
| DAC (anticipo) | 32 | 1,559 |
| LQR / NVE / LQC | — | 1,045 / 1,010 / 510 |
| PEA / OCV / NDT / PRE | 1 NDT, 1 PRE | 10 / 4 / 1 |
2026: 13,000–18,400 FAC CLI por mes (98 % electrónicas), 520–910 documentos PRO por mes. 12 combinaciones establecimiento-punto históricas (002-001, 004-002, 003-001, 004-001, 005-002, 006-001, 002-002, 007-001, 005-001, 001-001, 003-002, 001-002).

## 7. Defectos y aciertos
- ✅ Documento único para venta y compra con 4 clases de línea y retención embebida: cubre todo el ciclo fiscal ecuatoriano en un solo formulario.
- ✅ `tipo_domicilio` UB/GL y `orden_domicilio_id`: hay campo nativo para atar la factura al pedido de plataforma (FOODIX no lo usa; hoy concilia Uber por hora/monto/artículos).
- ❌ Formulario monolítico de ~330 campos con formsets `*_template`: cualquier robot depende de nombres internos.
- ❌ `promocion_integracion_id` 100 % NULL y `tipo_descuento` = 'P' en 96 %: la promoción aplicada no queda identificada.
- ⚠ DNA (23,329) = ventas con documento no autorizado (⏳ entender cuándo se generan: contingencia, consumidor final sin autorización).

## 8. Qué necesitaríamos para reemplazarlo
⏳ (fase de plano). Incluye emisión electrónica completa: XML v1.1.0/2.1.0 del SRI, firma XAdES-BES con .p12, recepción/autorización por web service, RIDE, contingencia y reintentos; numeración por punto de emisión; retenciones electrónicas; ATS.

## 9. Fuentes
`evidencia/pages/registro_*.json`, OpenAPI v2 (`Documento`, `BienServicioDocumento`, `Cobro`, `Retenciones`, `FormaPago`), `evidencia/uso-real.txt`, `uso-real-2.txt`, memorias `reference_contifico_tipo_registro_cli_pro`, `contifico_documentos_fantasma`.
