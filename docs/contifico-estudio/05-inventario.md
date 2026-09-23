# 05 · Inventario

Estado: 🔄 primera versión (22-sep-2026). Faltan: lista de movimientos, toma física, unidades, categorías, bodegas (barrido en curso) y el plan de reemplazo.

## 1. Qué hace
Catálogo de productos y servicios, con hasta 4 precios, contabilidad por producto, fórmulas (composición) y configuración de POS; movimientos de inventario (ingreso, egreso, traslado, ajuste de costo) por bodega; producción (transformar insumos en producto terminado con fórmula, proyectado vs producido, desecho); toma física; unidades con factores de conversión; categorías en árbol; 12 bodegas; lotes y series; importaciones.

## 2. Entidades y campos

### Producto (`inventario/producto/registrar2/` y `consultar/{pk}/`)
| Campo web | API v2 (`/producto/`) | Supabase | Notas |
|---|---|---|---|
| `codigo`, `codigo_auxiliar`, `nombre`, `descripcion`, `categoria_id` | `codigo`, `codigo_auxiliar`, `codigo_barra`, `nombre`, `categoria_id` | `contifico_raw.cat_productos` | Código libre (FOODIX usa prefijos: ALA, COMB, PROU, BEB…) |
| `tipo` PRO/SER | `tipo` | `tipo` | Producto o Servicio |
| `tipo_producto` **SIM / COM / PRO / COP** | `tipo_producto` "SIM:simple, COM:combo, COP:compuesto, PRO:produccion" | `tipo_producto` | El select de alta solo ofrece SIM/PRO/COP; **COM existe** en el filtro de la lista, en la API y como sección "Combo" del form (ver §7). FOODIX: 611 COP, 561 SIM, 167 PRO, 0 COM. |
| `unidad_id` + `factor2..5`/`unidad2..5_id` | `unidad` | `unidad_id` | Unidad base y hasta 4 unidades alternativas con factor |
| `pvp1, pvp2, pvp3, pvp_distribuidor`, `maneja_pvpmanual`, `bloquear_descuento` | `pvp1..pvp4`, `pvp_manual` | `pvp1..pvp4` | Sin IVA, 6 decimales. `pvp_distribuidor` = `pvp4` de la API |
| `iva` 15/5/0/-1, `tipo_ice` NAP/PICE/VICE, `porcentaje_servicio` | `porcentaje_iva` | | ICE por % o valor fijo; servicio 10 % |
| `para_venta`+`cuenta_venta_id`, `para_compra`+`cuenta_compra_id`, `inventariable`+`cuenta_costo_id`, `minimo` | — (la API no expone cuentas) | `cuenta_venta_id`, `cuenta_compra_id`, `cuenta_costo_id` (raw) | Cuentas contables por producto: venta (ingreso), compra (costo) e inventario |
| `variante1..3`, `_es_principal`, `_es_compartida` | `variantes[]`, `producto_base_id` | `cat_variantes` (0 filas) | Variantes tipo talla/color; FOODIX no las usa |
| `para_pos`, `todos_pos`, `pos_input` (ids de cajas) | `para_pos` | `para_pos` | Ej. ALA001 vendible en cajas `8732,8822,8917,8918` |
| `maneja_control_stock`, `maneja_balanza`, `costo_maximo`, `dias_plazo`, `para_ordencompra`, `para_importacion`, `gasto_personal` | — | | `gasto_personal` = clasificación SRI para deducción de gastos personales |
| `combo_N-*` (producto_detalle_id, cantidad, pvp1..3, pvp_distribuidor, cuenta_venta_id) | — | — | Sección **Combo**: componentes = productos terminados con precio y cuenta de venta propios |
| `formula_N-*` (producto_detalle_id, cantidad, unidad) | — | `costos.receta_base` (carga manual) | Sección **Fórmula** para `PRO` (de producción) |
| `tipo_formula_N-nombre`, `tipo_formula_N-seleccion` NE/UN/VA, `tipo_formula_N_M-*` | — | `costos.receta_base.grupo_seleccion` (NULL en 682 de 701) | Sección **Fórmula** para `COP`: grupo 0 = fijos (`FORMULA`/`NE`), grupos 1..n = opciones variables (`UN` sólo uno, `VA` varios o ninguno) |

Evidencia: `evidencia/producto_ALA001.json` (mixto: 1 fijo + 2 grupos UN de 9 salsas), `producto_COMB001.json` (sin fijos; ACOMPAÑANTE VA ×3, BEBIDA UN ×12), `producto_COMB003.json` (BEBIDA UN ×11, ACOMPAÑANTE UN ×3), `producto_PROU020.json` (9 fijos, entre ellos `10460001` = ALA001 ×0.5).

### Movimiento de inventario (`inventario/movimiento/registrar/`)
`fecha`, `tipo` ING/EGR/TRA/**AJU = "Ajuste de Costo"**, `bodega_origen_id`, `bodega_destino_id`, `descripcion`, `generar_asiento` (+ `cuenta`, `centro_costo`, `proyecto`), `ordencompraventa`, adjunto; detalle: `cantidad`, `producto_id`, `unidad`, `precio` (costo unitario), `subtotal`, `ajuste_costo`, `serie`, `lote`, `fecha_expiracion`, `color`, `edicion`. Carga masiva por plantilla Excel (`descargar_plantilla/1/` y `/2/`). Se pueden traer ítems de una producción o de otro movimiento. API v2 `/movimiento-inventario/` (ver `20-api-catalogo.md`): `tipo`, `estado` G/P, `bodega_id`, `bodega_destino_id`, `cuenta_id`, `generar_asiento`, `pos`, `detalles[{producto_id, cantidad, costo_promedio (2 dec), precio, unidad}]`.

### Producción (`inventario/produccion/`)
Cabecera: fecha, bodega origen (insumos) y destino (PT), descripción, `estado` **P Pendiente / R Producido / S Provisional**; líneas: producto, fórmula, `cantidad_teorica` (proyectado), `cantidad` (producido), `cantidad_liquidacion`, `cantidad_liquidacion_desecho`, `cantidad_total`, `cantidad_diferencia`, factor/unidad; "Solicitud de materiales" (stock de cada insumo); "Agregar producto adicional". Exports `?excel=1..4` (ver `10-reportes.md`). ⚠ Abrir `produccion/registrar/` crea o abre un borrador provisional (`/produccion/964838/`, `estado=S`); no se listó con filtros de septiembre. Pendiente confirmar el efecto real.

### Lista de productos (`inventario/producto/`)
Filtros: `filtro`, `categoria_id` (árbol de 92 categorías con checkboxes `categ-<id>`), `estado`, `proposito` C/V, `tipo`, `tipo_producto`, `iva`, `gasto_personal`. Exports: `excel=1&costo=1` (con costo), `excel=3` (sin costo), `excel=2` (fórmulas). Enlaces: `inventario/lotes/administrar/`, `inventario/series/administrar/`, `inventario/subir_productos/` (carga masiva).

### Selector de productos
`inventario/producto/seleccionar/?filtro=<texto>` devuelve HTML con `selectObj(<pk>)` por fila → forma barata de resolver **código → pk Django** (COMB001 = 10460049, COMB003 = 10460051, PROU020 = 16092658, ALA001 = 10460001).

## 3. Flujos y estados
- Venta de un COP en POS: la factura lleva una línea con el compuesto; el inventario descuenta los ingredientes de la fórmula (⏳ verificar con un EGR "VENTA PUNTO DE VENTA" y su detalle en `contifico_web.mov_inventario_detalle`).
- Producción: P → R al confirmar; genera EGR de insumos y ING de PT (Movimientos con `origen=PRO`, referencia `PRO 2026…`); costo unitario del PT = suma de insumos / cantidad producida (⏳ verificar en export `excel=3`).
- Movimientos: estado G (generado) / P (pendiente) en la API; `generar_asiento` decide si contabiliza.
- Costeo: promedio ponderado (⏳ documentar cuándo recalcula: al ING con `precio`, al AJU).

## 4. Reglas de negocio y legales
- IVA por producto (15 %, 5 %, 0 %, no objeto) y tarifa 8 % por fecha en la factura (`contabilidad/get_porcentajes_iva/?fecha=`).
- ICE por porcentaje o valor fijo; `gasto_personal` para el anexo de gastos personales del SRI.
- Cuentas contables obligatorias por producto según flags venta/compra/inventario.

## 5. Cómo se accede
- API v2: `GET /producto/`, `/producto/{id}`, `/producto/{id}/stock/` (stock por bodega). No expone fórmulas ni cuentas.
- Web: lista con filtros y 3 exports; `consultar/{pk}/` para leer la fórmula con grupos; `registrar2/` para alta (POST con csrf; el robot `sync-productos.ts` ya lo hace).
- Movimientos: API v2 con filtros de fecha semiabiertos; export web `inventario/movimiento/?excel=2` con costo 6 decimales y centro de costo (scraper diario).

## 6. Uso real en FOODIX (Supabase, 22-sep-2026)
| Dato | Valor |
|---|---|
| Productos | 1,350: 611 COP (365 activos), 561 SIM (395 activos), 167 PRO (128 activos), 11 SER |
| Movimientos de inventario (API) | EGR 769,805 · ING 36,905 · TRA 17,023 · AJU 402 (2021-10 → 2026-09-22) |
| Bodegas / unidades / categorías / marcas | 12 / 30 / 92 / 114 |
| Fórmulas cargadas a mano | `costos.receta_base`: 701 PT, 4,119 líneas (23-jul-2026), 39 cambiaron en el export del 17-ago |

## 7. Defectos y aciertos
- ❌ **FOODIX modela combos como COP con ingredientes**; la venta del compuesto no deja rastro del producto terminado (New York: 190 sueltas vs 8,531 dentro de combos). Contífico tiene el tipo **COM (combo de productos terminados con precio y cuenta por componente)** que resolvería la trazabilidad comercial; no está disponible en el select de alta de esta cuenta (⚠ NO VERIFICADO si es por plan). Documentar en `40-defectos-de-diseno.md` como defecto de uso, no solo de Contífico.
- ❌ El export Excel de fórmulas aplana los grupos: para costear hay que leer `consultar/{pk}/` (1 request por COP, 611 productos).
- ✅ Modelo de fórmula con grupos (`NE/UN/VA`) es correcto y suficiente para costeo esperado por opción.
- ✅ Unidades alternativas con factor por producto; lotes, series y fecha de expiración disponibles aunque FOODIX no los use.
- ⚠ `costo_promedio` de la API viene a 2 decimales: inservible para insumos en gramos (66 % en cero); el costo real solo sale por el export web.

## 8. Qué necesitaríamos para reemplazarlo
⏳ (fase de plano). Mínimo: catálogo con tipos SIM/PRO/COP/COM, fórmulas con grupos, unidades con factores, bodegas, movimientos con costo promedio a 6 decimales y asiento automático, producción con proyectado/producido/desecho, toma física, importación masiva.

## 9. Fuentes
`evidencia/pages/inventario_producto*.json`, `inventario_movimiento_registrar.json`, `inventario_produccion*.json`, `evidencia/producto_*.json`, OpenAPI v2 (`Producto`, `MovimientoInventario`, `DetalleInventario`), memoria `contifico_cop_no_mixta`, `reference_contifico_web_exports`, consultas psql 22-sep (`evidencia/uso-real.txt`).
