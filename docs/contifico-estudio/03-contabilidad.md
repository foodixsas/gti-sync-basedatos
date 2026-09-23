# 03 · Contabilidad (incluye Activos fijos)

Estado: 🔄 primera versión (22-sep-2026). Faltan: plan de cuentas (la página no respondió en 90 s; reintento pendiente), estados financieros y reportes SRI (ver `10-reportes.md`), cruce asiento ↔ documento con montos.

## 1. Qué hace
Plan de cuentas jerárquico, centros de costo en árbol y proyectos como segunda dimensión, ejercicios contables con cierre mensual, libro diario con asientos automáticos por cada módulo y asientos manuales (con importación), activos fijos con depreciación automática, estados financieros, balance de comprobación, flujo de caja, mayor por cuenta y reportes SRI (ATS, 103, 104, anexo ICE).

## 2. Entidades y campos
| Entidad | Web | API | Supabase |
|---|---|---|---|
| Cuenta contable | `contabilidad/cuenta/` (árbol AJAX; selectores `cuenta/seleccionar/?tipocuenta=BIENSERVICIO|Banco|RETENCIONES|ACTIVO|GASTO|INGRESO|INVENTARIABLE|Cuenta por Cobrar|Cuenta por Pagar|ACTIVOGASTO|todas=1|padres=1`) | v1/v2 `/contabilidad/cuenta-contable/` (`tipo` G grupo / C cuenta) | `cat_cuentas_contables` 1,104 filas |
| Centro de costo | `contabilidad/centro_costo/` (`formCentro`: `padre_id`, `nombre`, `estado` A/I; etiqueta configurable `formNombreCentro`) | v1/v2 `/contabilidad/centro-costo/` (`tipo` T transaccional / G grupo) | `cat_centros_costo` 28 |
| Proyecto | misma pantalla, `formProyecto` (`padre_proyecto_id`, `nombre_proyecto`, `estado_proyecto` AC/FI); selector `registro/proyecto/seleccionar/` | — | — |
| Ejercicio contable | `contabilidad/ejercicio_contable/` (`fecha_inicio`, `fecha_fin`, `cierre_mensual`, `dia_cierre`; tabla Estado; exports excel/pdf) | — | — |
| Asiento | `contabilidad/libro_diario/asiento/registrar/` (`fecha`, `glosa`, `gasto_no_deducible`, líneas `N-cuenta_id`, `N-debe`, `N-haber`, `N-centro_costo_id`, `N-proyecto_id`; `duplicar`); importación `libro_diario/asiento/importar` | v2 `GET /contabilidad/asiento/` (`fecha_inicial/final`, `centro_costo`), `/asiento/{id}`; v1 `POST /asiento/` | `trx_asientos_contables` (raw, 2.45 M) y `contifico_clean.trx_asientos_contables` (18.8 M líneas) |
| Libro diario | `contabilidad/libro_diario/` filtros: `cuenta`, `fecha_inicio/fin`, `centro_costo`, `filtro`, **`tipo`** (Compra, Venta, Depósito, Inventario, Retención, Asiento, Ingreso, Egreso, Cierre Automático, Nómina, Importación, Depreciación), `mes`, `anio`, `proyecto_id`; export `excel=1` | — | — |
| Activo fijo | `activo_fijo/activo/registrar/` (`codigo`, `nombre`, `categoria`, `tipo`, `estado` A/I/D depreciado/V vendido, `porcentaje_depreciacion` 5/10/20/33, `porcentaje_residual`, `fecha_registro`, `valor_inicial`, `fecha_inicio_depreciacion`, `generar_asiento_depreciacion`, `depreciacion_curso`, `ubicacion`, baja con `fecha_baja`); configuración: categorías (tipo GTO costos / ADM / VTA con 9 cuentas: activo, ingreso, depreciación acumulada, depreciación, deterioro, costo, gasto adm, gasto vta, costo de venta), tipos, ubicaciones | — | — |

## 3. Flujos y estados
- Cada documento, movimiento de inventario con `generar_asiento`, cobro/pago, depósito, retención, rol de nómina, importación y depreciación genera su asiento con el `tipo` correspondiente del libro diario. Asientos manuales = tipo Asiento.
- Ejercicio: abierto → cierre mensual (día configurable) → cierre anual ("Cierre Automático").
- Activo fijo: alta (desde compra con `activofijo_template` o manual) → depreciación mensual automática → baja/venta.
- Prefijos de asiento en la API: `NOM` (nómina) y `ASI` (⚠ solo documentado; el espejo trae `id, fecha, glosa, detalles`).

## 4. Reglas de negocio y legales
- Plan de cuentas con tipos por uso (banco, retenciones, cuentas por cobrar/pagar, inventariable, ingreso, gasto): los selectores filtran por `tipocuenta`, así el sistema garantiza que cada campo reciba una cuenta del tipo correcto.
- Gasto no deducible por asiento (reporte de gastos no deducibles y conciliación tributaria).
- Depreciación con porcentajes legales (5 % inmuebles, 10 % maquinaria, 20 % vehículos/equipos, 33 % computación) y valor residual.

## 5. Cómo se accede
API v2 asientos por rango de fecha (paginado 100); web: libro diario `excel=1` por `tipo` (rápido con tipo; >25 min/día sin tipo), mayor por cuenta `reportes/cuentas/?excel=1&cuenta=<id>`, estados financieros (⏳ formularios en `10-reportes.md`).

## 6. Uso real en FOODIX
2,451,046 líneas de asiento en el espejo (2021→2026; 522,760 en 2026 al 22-sep); 1,104 cuentas; 28 centros de costo; asientos de nómina por empleado; 6 categorías de activos fijos (equipos de computación 20 %, maquinaria por local 10 %, planta 20 %, vehículo planta 20 %) y 6 ubicaciones (locales, bodega, planta, oficina). Reportes personalizados de auditoría por centro de costo (jun-2026).
- **Un día típico (15-sep-2026): 1,756 asientos, 13,489 líneas** contra 523 facturas de cliente. Patrones de glosa: "VENTA PUNTO DE VENTA" 764 (venta: D caja/cxc, H ingreso por cuenta de venta del producto, H IVA; y cobro en asiento aparte de 2 líneas), "Asiento de descarga de inventario - EGR #" 513 (costo de venta: D costo, H inventario, ~18 líneas por producto), "CRUCE DE CUENTA PEDIDO UBER/PEDIDOSYA/RAPPI" 236 (cobro de plataformas por cruce), "PAGO MASIVO A PROVEEDORES" 44, "Asiento de traslado de inventario - TRA #" 27, "Depósito/Retención de Liquidación de tarjeta de crédito" 25, "CIERRE DE EFECTIVO <local>" (depósitos), "Asiento de Retencion Doc N.", compras con la descripción libre del proveedor como glosa.
- ❌ **El asiento no lleva el id del documento**: la glosa de las ventas POS es solo "VENTA PUNTO DE VENTA" y la de compras es texto libre; el cruce asiento ↔ factura solo es posible por fecha + monto (o por el libro diario web con `tipo=Venta`). Para el sistema propio: todo asiento debe nacer con `documento_id`.

## 7. Defectos y aciertos
- ✅ Asientos automáticos por origen con `tipo` consultable: auditable y reproducible.
- ✅ Dos dimensiones analíticas (centro de costo y proyecto) en cada línea.
- ❌ El plan de cuentas es un árbol AJAX pesado (no cargó en 90 s) y la API v2 no permite listar asientos por documento: cruzar asiento ↔ documento exige parsear la glosa.
- ❌ Libro diario sin tipo = inutilizable por volumen (ventas POS explotan filas).
- ⚠ `contifico_clean.trx_asientos_contables` tiene 18.8 M líneas frente a 2.45 M asientos raw: verificar duplicación en la transformación.

## 8. Qué necesitaríamos para reemplazarlo
⏳ Plan de cuentas NIIF PYMES, motor de asientos automáticos por evento, centros de costo y proyectos, ejercicios y cierres, activos fijos con depreciación, estados financieros y reportes SRI.

## 9. Fuentes
`evidencia/pages/contabilidad_*.json`, `activo_fijo_*.json`, `evidencia/ajax-urls.tsv` (selectores de cuenta), OpenAPI v1/v2 (`Asiento`, `DetalleAsiento`, `CuentaContable`, `CentroCosto`), `evidencia/uso-real.txt`.
