# 10 · Reportes

Estado: 🔄 primera versión (22-sep-2026): las 29 pantallas del menú Reportes con sus filtros (barrido). Exports probados y tiempos: ver tabla de `reference_contifico_web_exports` (ago-2026), aquí resumida.

## Inventario completo (URL · filtros · salida)
| Grupo | Pantalla `reportes/…` | Filtros | Salida / notas |
|---|---|---|---|
| Inicio | `resumen/`, `panel/` | cuentas base (activo corriente 9830120, pasivo circulante 9830233, pasivo 9830238, activo 9830132) | tablero con KPIs contables (liquidez, cartera) |
| Financieros | `estado_perdidas_ganancias/` | `filtro` AC/AP/MA/MP/PF (período), `fecha_inicio/fin`, `tipo` N/D/ND/T (deducible), `vista` GE/SE/TR/ME (general, semestral, trimestral, mensual), `filtro-nivel` 1–5, `centro_costo`, `proyecto` | Estado de resultados por nivel de cuenta y centro de costo |
| | `balance_general/` | `filtro`, `fecha_corte`, `vista`, `filtro-nivel`, `centro_costo` | Estado de situación financiera |
| | `balance_comprobacion/` | `cuenta`, `fecha_inicio/fin`; `excel`, `pdf` | |
| | `flujo_caja/` | `filtro` M/A/F, fechas, `anio`, `mes`, `vista` N/E, `centro_costo`, `proyecto` | |
| Ventas | `ventas_gerencial/` | `vista_grafico` AC/MC/SC/RF, `formato` unidad/moneda, fechas, categoría, producto, centro de costo, cuenta, cliente, proyecto | Resumen gerencial |
| | `ventas_nuevo/` | `tipo` F/C/O, `caja_id`, `caja_online_id`, fechas, categoría, producto, CC, cliente, `tipo_grafico` P/C; `excel`, `pdf` | Ventas por caja (POS) |
| | `ventas_semanal/` | categoría, producto, `formato`, `semana` SC/SA/DD, `fecha`; `excel` | Bodega × Lun…Dom, total, transacciones, ticket promedio |
| | `ventas_gerencial_detalle/` | `visualizacion` por producto/categoría, `agrupacion` DF/TR/ME/DI, `orden`, filtros; `excel` | Producto/cuenta, moneda, unidad, % |
| | `ventas_vendedor/` | fechas, producto, cliente, categoría, CC, `perfil`; `excel` | facturas, promedio, artículos por factura |
| | `margen_bruto/` "Costos de venta" | `mes`, `anio`, categoría, bodega, producto; `excel`, `pdf` | PVP prom, costo prom, margen (vino vacío jul-2026) |
| Gestión | `gastos_no_deducibles/` | `filtro` AC/AP | |
| | `control_cartera_op/` | `vista` G/M, `fecha_corte`, categoría, CC, `tipo` ctasxc/ctasxp, consumidor final, vendedor; `excel_cobrar/pagar(_detallado)` | antigüedad 30/60/90/120 |
| | `control_anticipos/` | `fecha_corte`, categoría; 4 exports | antigüedad de anticipos |
| | `reporte_cartera_contabilidad/` | `tipo`, fechas, cuenta; `excel` | cartera vs contabilidad |
| Inventario | `saldos_inventario/` | categoría, `fecha_corte`, producto, bodega, `mostrar_serie`, `mostrar_inactivos`; `excel`, `excel_personalizado`, `excel_saldos_por_bodega` | 6–7 min por corrida; 13 columnas de bodega |
| | `saldos_disponible/` | + `fecha_inicio`, `mostrar_cero` | saldos disponibles (comprometidos) |
| | `movimientos_inventario/` "Kardex" | `producto_id` obligatorio, fechas, bodega, `codigo_movimiento`, `tipo`; `excel`, `pdf` | 1 producto por request |
| | `bitacora_importacion/` | producto, fechas, importación, código, `tipo` | |
| | `comparativo_asientos/` "Movimientos vs asientos" | categoría, cuenta, `anio`, `mes`, `tipo_mov` ING/EGR, `origen_asi` M/G; `excel` | cruza inventario con contabilidad |
| Contabilidad | `cuentas/` "Consulta cuentas/mayor" | `cuenta` obligatoria, fechas, CC, proyecto; `excel`, `pdf` | mayor por cuenta |
| SRI | `ats/` | `tipo` M/S, `mes`, `periodo` 6/12, `anio`, `excluir_332`, email | genera el XML del ATS y lo envía por correo |
| | `formularios103/`, `formularios104/` | `anio`, `tipo` M/S, `mes`, `semestre`, `tipo_declaracion` O/S, sustitutiva | año, período, tipo, forma de pago, banco, valor a pagar |
| | `compras_ventas/` | `tipo` M/S, `mes`, `semestre`, `anio`; `excel`, `excel_detallado` (POST) | reporte tributario |
| | `dinardap/` | `fecha_corte`; `excel` | reporte DINARDAP |
| Personalizados | `personalizados_comprasventas/` (+ `registrar/<id>/`) | 63 columnas elegibles, agrupación, POST | 3 reportes guardados |
| Auditoría | `log_extendido/` "Log de actividades" | `usuario`, fechas, `pantalla` (24), `actividad`, `rol` A/S/D/V/L/T/C, `tipoActividad`; `excel`, imprimir | Fecha, usuario, actividad |

Reportes que existen como permiso pero no en el menú de esta cuenta: `rep_repg_ventasPos`, `rep_ticketsProducto`, `rep_repg_controlDeImpuestosSobreUtilidades`, `rep_inv_egresoscc` (egresos por centro de costo), `rep_inv_estimados`, `rep_sri_anexoice`, `rep_cobros_pagos`, `rep_repg_ventas_cobros`.

## Qué usa FOODIX y qué ya reemplazó el dashboard
- Contabilidad usa: estados financieros, balance de comprobación, mayor, ATS, 103/104, compras/ventas, cartera, log (⏳ confirmar con Contabilidad).
- Ya reemplazado por `foodix-dashboard` con datos del espejo: ventas por local/día/hora/canal, ventas por producto y categoría, ticket promedio, márgenes (con las salvedades del costo), cartera de plataformas, conciliaciones.
- Nunca reemplazado: kardex y saldos valorizados a fecha de corte (la API solo da stock actual), comparativo inventario vs asientos, reportes SRI.

## Defectos y aciertos
- ✅ Todos los reportes exportan por GET con sesión (salvo SRI y personalizados, POST): automatizables.
- ❌ Tiempos: saldos 6–7 min, libro diario sin tipo >25 min/día, kardex y mayor 1 request por entidad.
- ❌ Costos de venta vacío en la prueba de julio: el margen de Contífico no es confiable para FOODIX.

## Fuentes
`evidencia/pages/reportes_*.json`, memoria `reference_contifico_web_exports`, vault `Estudio-2026-08-17-Fuentes-Contifico-API-vs-Sistema-Web.md`.
