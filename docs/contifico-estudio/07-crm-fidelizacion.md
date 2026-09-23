# 07 · CRM / Fidelización (y proformas)

Estado: 🔄 primera versión (22-sep-2026). Falta: contenido real de segmentos/niveles/promociones en FOODIX (filas de las listas).

## 1. Qué hace
Contífico no tiene un "CRM" de oportunidades. Lo que llama CRM (permisos `crm`, `fid_*`, `reg_giftcard_*`) es el módulo **Fidelización**: segmentos de clientes, niveles por puntos, reglas de consumo (puntos por comprar), promociones (descuentos y reglas de puntos) con público objetivo, vigencia por fecha/día/hora y puntos de venta, dashboard de puntos por cliente y reporte de promociones canjeadas. Además, gift cards (permiso de modificar saldo) y el ciclo comercial **Cotización → Prefactura → Orden de compra/venta (OCV) → Factura** en Transacciones › Proformas.

## 2. Entidades y campos
| Entidad | Campos |
|---|---|
| Segmento (`fidelizacion/segmentos/crear/`) | `nombre`, `descripcion`, `activo`, `tipo`: aniversario (cumpleaños / registro, `dias`), valor total de compra (`desde_cantidad`, `hasta_cantidad`), cantidad de transacciones (`min/max_transaccion`), última compra hace n días (`dias_ultima_compra`), compra en período (`desde_fecha`, `hasta_fecha`) |
| Nivel (`fidelizacion/niveles/crear/`) | `nombre`, `descripcion`, `activo`, `puntos_necesarios`, `foto`; lista muestra cantidad de usuarios por nivel |
| Regla de consumo (`reglas_consumo/crear/`) | `nombre`, `descripcion`, `activo`, `puntos`, vigencia (`activo_todo_tiempo` o `desde/hasta_fecha`), `target` ALL/SEG/LEV (+ `segmentos`, `niveles`), `productos`, `foto` |
| Promoción / regla de puntos (`promociones/crear/`) | `tipo`: EVEN regla evento (`tipo_evento` primera compra / login / cuenta creada), EPER evento personalizado (`nombre_evento_pers`), PNGR regla general de puntos (`valor_minimo_orden`, `puntos`), CMPR regla compra producto, MLPT multiplicar puntos (`multiplicador`), PROM promoción (`tipo_promocion` COM combo / PRO producto, `descuento`, `seleccion_combo` toda la factura / productos seleccionados / último producto, `cantidad_productos`); vigencia por fechas, días de semana y horas; `target` ALL/SEG/LEV; `todos_pos` o lista de `pos`; `productos`; `foto` |
| Dashboard (`fidelizacion/dashboard/`) | tabla persona, identificación, tipo GAN/PIE (gana/pierde), regla, puntos, fecha; alta manual de puntos (`tipo`, `cliente`, `puntos`) |
| Reporte (`promociones/reporte/`) | por fechas, centro de costo y promoción: valor recaudado y cantidad canjeada |
| Proformas (`registro/documento/?proforma=1`) | COT cotización, PRE prefactura, OCV orden compra/contrato; campos extra `proyecto_proforma`, `forma_pago_proforma`, `atencion_proforma`, `garantia_proforma`, `proveedor_desconocido`; envío por correo (`enviar_proforma/`); aprobación de prefactura/orden por permiso |

API: nada de fidelización en v1/v2.

## 3. Flujos y estados
Cliente identificado en el POS → reglas de consumo acumulan puntos (GAN) → niveles por puntos → promociones aplican descuento o multiplican puntos según target/POS/horario → canje (PIE) → reporte por centro de costo. ⏳ Cómo se identifica el cliente en el POS (cédula) y si el POS de FOODIX tiene activado el módulo.

## 4. Reglas de negocio
Puntos por compra, eventos, multiplicadores; promociones por combo o producto con descuento porcentual; segmentación RFM básica (recencia = última compra, frecuencia = transacciones, monto = valor de compra) y aniversarios.

## 5. Cómo se accede
Solo web; listas con `excel`/`pdf` en segmentos, niveles y promociones.

## 6. Uso real en FOODIX
⏳ Filas de las listas (segmentos, niveles, promociones, reglas). Hipótesis: no se usa; FOODIX construyó **Simón Puntos** (`gmkt_crm_puntos_mov`, 1 $ = 1 punto, activación por WhatsApp) y las encuestas/CRM en `gmkt_marketing`. Reportar si hay datos.

## 7. Defectos y aciertos
- ✅ Vale copiar: segmentación por recencia/frecuencia/monto/aniversario, reglas de puntos por evento y multiplicador, promociones acotadas por POS, día y hora, reporte de canjes por centro de costo. Es una lista de requisitos lista para el programa de fidelidad propio.
- ❌ Sin API: no se integra con WhatsApp ni con la app; sin historial exportable de puntos por cliente más allá del dashboard.
- ❌ Sin CRM real (seguimiento, tareas, oportunidades) ni cotizaciones con versiones.

## 8. Qué necesitaríamos para reemplazarlo
Ya existe en FOODIX el programa de puntos propio; el sistema propio debería absorber promociones por POS/horario y el canje como factura con descuento (ver decisión Millas 21-sep-2026).

## 9. Fuentes
`evidencia/pages/fidelizacion_*.json`, `registro_documento_registrar_proforma_1.json`, `empresa_configuracion_usuario_registrar.json` (permisos `fid_*`, `reg_giftcard_mod_saldo`).
