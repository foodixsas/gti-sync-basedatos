# 09 · Bancos y Tarjeta de crédito

Estado: 🔄 primera versión (22-sep-2026). Faltan: listas (movimientos, conciliación, lotes, comercios) y configuración de cuentas bancarias (barrido/retiros pendientes).

## 1. Qué hace
Cuentas bancarias con cuenta contable; movimientos bancarios (depósito, transferencia/NC, tarjeta, cheque, transferencia/ND) de ingreso o egreso contra cuentas contables con centro de costo y proyecto; anticipos a proveedores/clientes; reposición de caja chica; conciliación bancaria contra estado de cuenta; cheques protestados; estado de cuenta. Módulo aparte **Tarjeta de crédito**: comercios (configuración), lotes (RECAP) y liquidaciones del banco adquirente con comisión, IVA y retenciones.

## 2. Entidades y campos
| Entidad | Campos (web) |
|---|---|
| Movimiento bancario (`banco/movimiento/registrar/`) | `tipo_registro_movimiento` E/I, `tipo_movimiento` D depósito / N transferencia-NC / X tarjeta / C cheque / T transferencia-ND, `anulado`, `fecha_emision`, `numero_comprobante`, `cuenta_bancaria_id`, `persona_id`, `numero_cheque`, `fecha_cheque`, `descripcion`, líneas `N-cuenta_id`, `N-monto`, `N-centro_costo_id`, `N-proyecto_id`; `duplicar` |
| Anticipo (`banco/anticipo/registrar/`) | `tipo_registro_anticipo` PRO/CLI, `tipo_movimiento` D/N/X/C/T, `cuenta_tarjeta_id`, `lote_id`, `cuenta_bancaria_id`, `persona_id`, cheque, líneas cuenta/monto/CC/proyecto. Se cruzan luego en Cobro/Pago (`anticipo_template`) |
| Reposición caja chica (`banco/reposicion/registrar/`) | `fecha_corte`, `cuenta_caja_chica_id`, `tipo_movimiento` C/T, `cuenta_bancaria_id`, comprobante, persona, cheque; toma las transacciones pagadas con caja chica |
| Conciliación (`banco/conciliacion/registrar/`) | `fecha_corte`, `saldo_final_estado_cuenta`, `saldo_inicial`, `saldo_final`, `banco`, líneas `detalle_N-seleccionar` + `movimiento_id` (marcar conciliados); `banco/conciliacion/movimientos_pendientes/` (AJAX) |
| Cheque protestado | `persona_id`, `cuenta_bancaria_id`, `numero_cheque`, `fecha_cheque`, `valor_cheque`, `valor_multa`, comprobante |
| Liquidación TC (`tarjeta_credito/liquidacion/registrar/`) | `fecha_liquidacion`, `tipo` FAC liquidación por factura / NCT por nota de crédito / FCO factura de comisión / EIF documento de institución financiera, `proveedor` (adquirente), `banco`, `numero_documento`, `autorizacion`, `cuenta_comision`, `cuenta_comision_porliquidar`, `centro_costo`, `comision`, `comision_0`, `comision_no_objeto`, `comision_iva`, `comision_fija`, `enviar_iva_gasto`; **lotes** (`lote_template`: fecha, `num_recap`, cuenta, depósito, comisión, IVA, base ret. IR, base ret. IVA, tipos de retención, a pagar); **retenciones que hace el banco** (IR e IVA por lote: `codigo_sri`, base, %, valor, número y autorización de la retención); firma (`frm_firmar`) |
| Cuentas bancarias (`banco/cuentas_bancarias/`) | ⏳ pantalla; en RRHH y préstamos aparecen 9: Produbanco CC 02005286758 (30463), Pichincha CC 2100249027 (30925), Produbanco CC Daniel Chamorro (31178), Guayaquil CC 0048801676 (39526), DeUna (42162), Produbanco (42843), JUSTO (43184), Internacional (43424), Bolivariano CC 5005108928 (43503) |

API: v1 `GET /banco/movimiento_bancario/` (`fecha_emision`, `fecha_inicial/final`), `/banco/movimiento/{id}`, v1/v2 `/banco/cuenta/`. Supabase: `trx_bancos_movimientos` (18,311, 2022→2025), `cat_bancos_cuentas` (9).

## 3. Flujos y estados
- Cobro con TC en el POS → `cobros[]` con `lote`, `bin_tarjeta`, `nombre_tarjeta` → el adquirente deposita por lote (RECAP) menos comisión y retenciones → **Liquidación TC** registra el depósito, la comisión (gasto con IVA) y las retenciones del banco (que a FOODIX le sirven como crédito tributario) → concilia contra la cuenta por cobrar TC (`cuenta/seleccionar/?tipocuenta=Cuenta+por+CobrarTC`).
- Pago a proveedor: Cobro/Pago (P) con transferencia → movimiento bancario E → conciliación con estado de cuenta.
- Anticipo → se consume en un cobro/pago posterior.

## 4. Reglas de negocio y legales
Formas de pago con códigos SRI (ATS); retenciones de las emisoras de tarjeta (IR 1–2 %, IVA 30/70 %; ⚠ verificar códigos vigentes); caja chica con reposición contable.

## 5. Cómo se accede
API v1 movimientos bancarios; web `banco/movimientos/?tipo_movimiento=D|T&generado=ANT`, `banco/consultar_movimientos/` (estado de cuenta), `tarjeta_credito/lote/`, `tarjeta_credito/liquidacion/`. ⏳ exports.

## 6. Uso real en FOODIX
- 18,311 movimientos bancarios en el espejo (hasta 2025; ⏳ 2026); 9 cuentas bancarias (Produbanco ×3, Pichincha, DeUna, Guayaquil, JUSTO, Internacional, Bolivariano; 2 inactivas), cada una con su cuenta contable (`evidencia/catalogos-web.txt`).
- **Tarjeta de crédito SÍ se usa**: 21 comercios configurados (redes DataExpress, Datafast, Medianet; uno por POS/local, más "DATAFAST API", "APP UNO", "POS Viche Pez"); la lista de **lotes** muestra un lote por POS, red y día con RECAP, número de vales, total cobrado, total liquidado y estado ("Pendiente (Faltante)" en todos los de 19–22-sep-2026: cobrado $73–$1,472 por lote, liquidado $0). Es decir, Contífico ya agrupa los cobros TC en lotes y espera la liquidación del banco; FOODIX hace esa conciliación afuera (proyecto Conciliación de Lotes) y aquí queda todo pendiente.
- 58,310 cobros con TC en 2026 ($1.27 M).

## 7. Defectos y aciertos
- ✅ Liquidación de tarjeta modela exactamente el problema real (lote → depósito neto → comisión → retenciones del banco): vale copiar. Los lotes ya existen en Contífico con cobrado vs liquidado; el trabajo que FOODIX hace afuera podría cerrarse adentro (⏳ evaluar por qué no se usa: ¿carga del estado de cuenta del adquirente?).
- ✅ Anticipos y caja chica integrados con contabilidad.
- ❌ Sin importación automática de estados de cuenta (⏳ verificar si existe carga de archivo en conciliación).
- ⚠ El espejo `trx_bancos_movimientos` termina en 2025: hay que revisar el sync antes de usarlo.

## 8. Qué necesitaríamos para reemplazarlo
⏳ Cuentas, movimientos, conciliación con importación de estados de cuenta, anticipos, caja chica, liquidación de tarjetas por lote.

## 9. Fuentes
`evidencia/pages/banco_*.json`, `tarjeta_credito_*.json`, `rrhh_movimientos_consultar_movimientos.json`, OpenAPI v1 banco, `evidencia/uso-real.txt`.
