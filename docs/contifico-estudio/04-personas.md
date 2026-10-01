# 04 · Personas

Estado: 🔄 primera versión (22-sep-2026).

## 1. Qué hace
Una sola entidad **Persona** con roles acumulables: cliente, proveedor, empleado, vendedor, accionista, transportista, relacionada, artesanal, gerente, pasante. Guarda identificación, datos SRI, condiciones comerciales (cupo, crédito, lista de precios), cuentas contables por cobrar/pagar, datos bancarios, autorizaciones de comprobantes físicos y, para empleados, toda la ficha laboral.

## 2. Entidades y campos (`persona/registrar/`)
| Bloque | Campos |
|---|---|
| Identificación | `tipo` N natural / J jurídica / I sin RUC-CI (+ P placa en la lista), `ruc`, `cedula`, `razon_social`, `nombre_comercial`, `es_contribuyente_especial`, `es_extranjero`, `abreviatura_titulo_prof` (60 títulos), `telefonos`, `direccion`, `provincia` (25 + Exterior) → `canton` (AJAX `empresa/provincia/get_cantones/`), `parroquia`, `email`, `sexo`, `estado_civild`, `origen_ingresos`, `personaasociada_id`, `categoria_id`, `estado` A/I |
| Cliente | `es_cliente`, `cuenta_por_cobrar_id` (default 9830132), `saldo_cliente`, `vendedor_id`, `pvp_default` pvp1/pvp2/pvp3/pvp_distribuidor (+ manual), `descuento`, `es_exterior`, `aplicar_cupo`, `cupo_credito`, `dias_credito`, `dias_vencimiento`, `bloquear_cliente`, `centro_costo_cliente` |
| Proveedor | `es_proveedor`, `cuenta_por_pagar_id` (default 9830238), `saldo_proveedor`, `cuenta_recurrente`, `tipo_retencion_ir`, `tipo_retencion_iva` (retenciones por defecto), `centro_costo_proveedor`, `es_relacionada`, `es_artesanal`, `es_transportista` |
| Otros roles | `es_empleado`, `es_gerente`, `gerente_relacion_laboral`, `es_pasante`, `es_accionista` (+ `cuenta_por_pagar_accionista_id`), `es_vendedor` |
| Datos bancarios | `banco_codigo` (catálogo de ~60 bancos), `num_tarjta` (cuenta), `tipo_cuenta` CA/CC, `ref_archivo_cobro` (cash management) |
| Autorizaciones | `autorizacion_template`: autorización, tipo VEN/RET, serie inicio/fin, fechas (comprobantes físicos del proveedor) |
| **RRHH (empleado)** | `departamento`, `cargo`, `fecha_nacimiento_rrhh`, `tipo_contrato_rrhh` (CA indefinido, CT temporal, OC obra cierta, TP tarea período, SO servicios ocasionales, LO LOSEP, EE especial emergente, EM emprendimiento), `grupo_pago` A/V/C/O (administrativo, ventas, costos, otros → decide las cuentas contables del rol), `tipo_pago` cheque/transferencia/pendiente/ventanilla, `rrhh_tipo_rol` RPM mensual / RPQ quincenal, `porcentaje_quincena`, `acumular_fondosreserva` (pagar/acumular desde año/ingreso), `acumular_decimos`, `extension_conyugal`, `horas_reduccion_jornada`, `discapacidad` + `%`, `genero`, `edad`, `codigo_iess`, `cargas_personales`, `nota`; entradas/salidas **empresa** (con acta de finiquito y liquidación), **Ministerio de Trabajo** e **IESS**; vacaciones (salida, entrada, días); **ingresos** (`tipo` S sueldo, A alimentación, T transporte, V vivienda, C comisiones, H horas extra, O otros; `valor_mensual`, `valor_dia`, `es_deducible`, `para_rol` = afecta aportación); centro de costo por porcentaje; contratos con archivo; **saldos iniciales** DTS (décimo tercero), DCS (décimo cuarto), VAC, OTR, ANT (anticipo), PPE (préstamo personal), PHI (hipotecario), PQU (quirografario); archivos: contrato, CV, cédula, récord, acumulación de décimos, otros zip; eventos (fecha, nombre, observaciones) |

API v2 `/persona/`: `id`, `ruc`, `cedula`, `placa`, `razon_social`, `nombre_comercial`, `telefonos`, `direccion`, `email`, `tipo` N/J/I/P, `es_cliente`, `es_proveedor`, `es_empleado`, `es_corporativo`, `es_vendedor`, `es_extranjero`, `aplicar_cupo`, `porcentaje_descuento`, `pvp_default`, `adicional1..4_cliente/proveedor`, `banco_codigo_id`, `tipo_cuenta`, `numero_tarjeta`, `personaasociada_id`, `origen`, `categoria_id`, `cuenta_por_cobrar_id`, `cuenta_por_pagar_id`, `cupo_credito`, `dias_credito`, `sueldo`, `vendedor_asignado`, `fecha_modificacion` = columnas de `contifico_raw.cat_personas`. **La API no expone nada de la pestaña RRHH** salvo `sueldo` (6 personas con valor).

Lista `persona/`: filtros `filtro`, `rol` C/P/E/D (doctor)/V, `tipo_persona`, `estado`; exports `excel`, `pdf`, `incluir_saldo`.

## 3. Flujos y estados
- Alta desde el POS con cédula (consumidor final `9999999999999`); enriquecimiento posterior por `persona/{pk}/`.
- Estado A/I; `bloquear_cliente` impide facturar a crédito.
- Empleado: ingreso (entrada empresa + IESS + MdT) → rol mensual/quincenal → salida con acta de finiquito.

## 4. Reglas de negocio y legales
- Tipo de identificación define comprobantes válidos y retenciones (contribuyente especial, relacionada, artesanal → tarifas).
- Cupo y días de crédito por cliente; lista de precios por cliente.

## 5. Cómo se accede
API v2 `GET /persona/` (`search`, `modificados_desde_fecha`, `es_cliente`, `es_proveedor`, `tipo`, `categoria_id`), `POST/PUT` (escritura, fuera de alcance). Web: `persona/?excel=1`, `persona/consultar/{pk}/`, selector `persona/seleccionar/?tipopersona=PRO|CLI`.

## 6. Uso real en FOODIX
160,113 personas: 158,006 solo clientes, 1,554 solo proveedores, 457 cliente+proveedor, **104 con rol empleado** (72 solo cliente+empleado, 12 también vendedor, 9 solo empleado), 26 vendedores. ⏳ cruzar los 104 empleados con `matriz` (Airtable) y `gth_talento_humano` para saber quién falta en cada lado.

## 7. Defectos y aciertos
- ✅ Una entidad con roles evita duplicar clientes que también son proveedores o empleados.
- ❌ La ficha laboral completa vive dentro de Persona y **no sale por la API**: cualquier sistema propio debe scrapear `persona/{pk}/` o cargar manualmente.
- ❌ Campos "personalizados" (`adicional1..4`) sin nombre: FOODIX no los usa.
- ⚠ `persona` embebido en documentos suele venir vacío: usar `persona_id`.

## 8. Qué necesitaríamos para reemplazarlo
⏳ Persona con roles, validación de cédula/RUC (algoritmo módulo 10/11), catálogos SRI (tipo de contribuyente), condiciones comerciales, ficha laboral (ver `06-rrhh-nomina.md`).

## 9. Fuentes
`evidencia/pages/persona.json`, `persona_registrar.json`, OpenAPI v2 `Persona`, `evidencia/uso-real.txt` (personas_flags), memoria `contifico_persona_jsonb_vacio_usar_persona_id`.
