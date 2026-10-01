# 20 · API REST de Contífico — catálogo y límites medidos

Armado desde material existente (sin llamadas nuevas): OpenAPI oficial v1 (33 rutas) y v2 (23 rutas) descargadas el 22-sep-2026 de `contificostatics.azureedge.net/static/shell/media/docs/openapi.yaml?v=4` y `openapiv2.yaml?v=4`; pruebas en vivo del 17-ago-2026 (15 llamadas) y de jul-2026 (30+ endpoints, `~/test_contifico_*.py`); `MANUAL_CONTIFICO_SYNC.md` §2; columnas reales de `contifico_raw`.

## Acceso
- Base: `https://api.contifico.com/sistema/api/v1` y `/v2`. Header `Authorization: <API_KEY>` (sin "Bearer"); la clave es "API_KEY del POS" (`empresa/configuracion/apis/`: `api_key` + `api_token`). Docs: `/sistema/api/v1/documentacion/`, `/v2/documentacion/` (ReDoc).
- v1: respuestas como **array plano, ignora `page`** (688 productos de golpe). v2: `{count, next, previous, results}`, `page` y `page_size` ≤ 100. Fechas `DD/MM/YYYY` (salvo `fecha_modificacion` de documentos: `YYYY-MM-DD`). Sin rate limit documentado; sin 429 en las pruebas; latencia 0.6–11 s por página.
- Los `id` son de integración (`DGe7644jMtn21dn2`), distintos del `pk` numérico de la web; ver `21-web-catalogo.md` (selector `producto/seleccionar/?filtro=`) para mapear.

## Rutas
| Recurso | v1 | v2 | Filtros útiles (verificados) |
|---|---|---|---|
| Documentos | GET/POST/PUT `/documento/`, PUT `/documento/{id}/sri/`, GET `/documento/{id}/estado/`, GET/POST `/documento/{id}/cobro/`, POST `/cruce/`, POST `/cruce_cuenta/` | GET/POST `/documento/`, PUT `/documento/{id}`, GET `/documento/estado/{id}`, GET/POST `/documento/{id}/cobro/`, GET `/documento/{id}/forma_pago` | `tipo_registro` CLI/PRO, `tipo` (FAC, LQC, PRE, NCT, COT, OCV, NVE, DNA), `fecha_inicial`/`fecha_final` (emisión), `fecha_emision`, `fecha_vencimiento`, `fecha_creacion`, `fecha_modificacion` (YYYY-MM-DD), `persona_id`, `persona_identificacion`, `bodega_id`, `result_size`/`result_page` (v1) |
| Movimientos de inventario | GET/POST `/movimiento-inventario/`, GET `/{id}` | igual | v2: `fecha_inicial`/`fecha_final` **semiabierto** (un día = `[D, D+1)`; parece aplicar sobre fecha de registro, no concluyente), `tipo` ING/EGR/TRA/AJU, `estado` G/P, `bodega_id` (origen). v1: solo `estado` y `tipo` (sin fecha) |
| Productos | GET/POST `/producto/`, GET/PATCH `/{id}`, GET `/{id}/stock/` | GET/POST `/producto/`, GET/PUT `/{id}`, GET `/{id}/stock/` | `modificados_desde_fecha`, `fecha_inicial/final` (último cambio), `filtro` (nombre/código), `codigo`, `codigo_barra`, `estado` A/I, `categoria_id`; stock por bodega en `/stock/` |
| Personas | GET/POST/PUT `/persona/`, GET `/{id}/` | GET/POST `/persona/`, GET/PUT `/{id}/` | `search`, `identificacion`, `modificados_desde_fecha`, `estado`, `es_proveedor`, `es_cliente`, `tipo`, `categoria_id`, `adicional_1..4` |
| Categorías, bodegas, unidades, marcas, variantes | GET/POST `/categoria/`, GET `/bodega/`, GET `/variante/`, GET `/marca/` | GET/POST/PUT `/categoria/`, GET `/bodega/`, GET `/unidad/` | `tipo`, `search_exact`, `modificados_desde_fecha`, `fecha_inicial/final` |
| Contabilidad | GET `/contabilidad/asiento/{id}`, POST `/asiento/`, GET `/cuenta-contable/`, GET/POST `/centro-costo/` | GET `/contabilidad/asiento/` (listado), GET `/{id}`, GET `/cuenta-contable/`, GET `/centro-costo/` | asientos v2: `page`, `fecha_inicial/final`, `centro_costo`; cuentas `tipo` G/C; centros `tipo` T/G |
| Bancos | GET `/banco/cuenta/`, GET `/banco/movimiento_bancario/`, GET `/banco/movimiento/{id}` | GET `/banco/cuenta/` | movimientos: `fecha_emision`, `fecha_inicial/final` |
| Guías | GET/POST `/inventario/guia/` | — | — |
| RRHH | GET `/rrhh/rol-pago/` | — | `cedula`, `periodo`, `anio`, `mes` (⏳ nunca probado) |
| Empresa | — | GET `/empresa/parametros` | (⏳ nunca probado) |

## Campos reales vs documentados (lo que importa para modelar)
- `Documento` v2 = las 60 columnas de `contifico_raw.trx_documentos` (ver `08-transacciones.md`): incluye `pos`, `caja_id`, `electronico`, `firmado`, `autorizado_sri`, `url_xml`, `url_ride`, `tipo_domicilio` UB/GL, `orden_domicilio_id`, `numero_cuotas`, `detalles[]`, `cobros[]`, `retenciones[]`. Estados P/C/G/A/E/F. Doc CLI trae `cliente{}`+`vendedor`; doc PRO trae `persona{}` (a menudo vacío → usar `persona_id`).
- `detalles[]` (BienServicioDocumento): `producto_id`, `producto_nombre`, `cuenta_id`, `centro_costo_id`, `cantidad`, `precio` (6 dec), `porcentaje_iva`, `base_*`, `porcentaje_descuento`, `descuento`, `formula[]` (⏳ nunca lo vimos poblado), `nota`, `promocion_integracion_id` (100 % NULL).
- `cobros[]`: `forma_cobro`, `monto`, `monto_propina`, `bin_tarjeta`, `nombre_tarjeta`, `numero_tarjeta`, `lote`, `caja_id`, `cuenta_bancaria_id`, `numero_cheque`, `fecha_cheque`, `tipo_banco`, `tipo_ping`, `numero_comprobante`.
- `retenciones[]`: `codigo_sri`, `tipo` IR/IVA, `base`, `porcentaje`, `valor`, `numero_comprobante`, `autorizacion`, `fecha_emision`, `fecha_registro`, `fecha_periodo_fiscal`, `electronico`, `gasto`, `documento`, `num_recap`, `liquidacion`, `importado`.
- `MovimientoInventario` v2: `bodega_id`, `bodega_destino_id`, `codigo`, `codigo_interno`, `cuenta_id`, `descripcion`, `estado`, `fecha` (YYYY-MM-DD), `generar_asiento`, `maneja_venta`, `pos`, `proyecto`, `tipo`, `total`, `detalles[{producto_id, cantidad, costo_promedio, precio, unidad, serie, edicion}]`. `costo_promedio` y `unidad` no están documentados pero llegan.
- `Producto` v2: `tipo_producto` **SIM/COM/COP/PRO**, `para_pos`, `pvp1..pvp4` (6 dec), `porcentaje_iva`, `minimo`, `cantidad_stock`, `estado`, `pvp_manual`, `imagen[]`, `variantes[]`, `producto_base_id`, `personalizado1/2`, `marca_id`. **Sin fórmula, sin cuentas contables, sin costo, sin factores de unidad.**
- `Persona` v2: identificación, roles booleanos, `pvp_default`, `cupo_credito`, `dias_credito`, `cuenta_por_cobrar_id`, `cuenta_por_pagar_id`, `banco_codigo_id`, `tipo_cuenta`, `numero_tarjeta`, `sueldo`. **Sin la ficha laboral** (contrato, ingresos, IESS…).
- `Asiento` v2: `id`, `fecha`, `glosa`, `detalles[{cuenta_id, centro_costo_id, tipo D/H, valor}]`; `gasto_no_deducible` y `prefijo` NOM/ASI documentados pero no vistos.

## Fallas medidas (la lista que justifica el scraping)
1. ❌ **`costo_promedio` a 2 decimales** en movimientos: 32 % de las líneas en cero; **66 % de los insumos en gramos en cero**. `sum(cantidad × costo_promedio)` da −29 % (EGR), −20 % (ING), −12 % (TRA) frente al `total` del documento. Solo el total por documento es confiable. Por eso el costo por línea sale del export web `inventario/movimiento/?excel=2` (6 decimales, centro de costo, referencia).
2. ❌ **No expone fórmulas** (probado en 7 rutas), ni producción, ni kardex, ni toma física, ni cuentas por producto, ni saldos a fecha de corte (solo stock actual).
3. ❌ **No expone nómina** (salvo `/rrhh/rol-pago/` v1 sin probar), ni fidelización, ni activos fijos, ni liquidaciones de tarjeta, ni conciliación bancaria, ni configuración.
4. ❌ Documentos borrados en Contífico no se notan (sin endpoint de borrados): fantasmas en el espejo (~2 %/mes); hay que rebajar por comparación.
5. ❌ Movimientos: en 2026 el mismo `codigo` aparece con varios `id` (32 % de los ING): el espejo los duplica si no se dedup por código.
6. ⚠ Filtros con nombres distintos entre recursos y versiones; rangos semiabiertos; `fecha_modificacion` con otro formato; v1 sin paginación.
7. ⚠ El `persona{}` embebido en documentos suele venir vacío; `detalles[].formula` nunca poblado; `promocion_integracion_id` siempre NULL.
8. ⚠ Escritura disponible (documentos, cobros, cruces, productos, personas, movimientos con `precio` obligatorio en ING) pero fuera del alcance del estudio.

## Qué sí resuelve bien
- Espejo completo de documentos con cobros y retenciones (762,817 docs), personas, productos, movimientos (cabecera y totales), asientos por rango de fecha, stock actual por bodega. Es la base de `contifico_raw` y de todo el dashboard.
- Aparece 4–25 s después de emitida la factura (medido para Millas): sirve para reaccionar casi en tiempo real.

## Fuentes
OpenAPI v1/v2 (scratchpad `openapiv1.yaml`, `openapiv2.yaml`; resúmenes en `evidencia/openapi*.schemas.txt` ⏳ copiar), vault `Estudio-2026-08-17-Fuentes-Contifico-API-vs-Sistema-Web.md` (Anexos B y C), memorias `contifico_api_rest_endpoints`, `contifico_mov_ingresos_versiones_duplicadas`, `contifico_documentos_fantasma`, `contifico_persona_jsonb_vacio_usar_persona_id`.
