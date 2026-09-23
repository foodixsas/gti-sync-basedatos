# 21 · Catálogo del sistema web de Contífico

Base: `https://1793168604001.contifico.com/sistema/`. Django + jQuery. Auth por cookie `sessionid` (HttpOnly). Listados y exports: GET con la cookie; formularios de alta: POST con `csrfmiddlewaretoken`.

**Fuente:** menú completo extraído del HTML de `/sistema/` el 2026-09-22 con la cuenta de servicio (evidencia: `evidencia/menu-links.tsv`). Un menú depende de los permisos del usuario: lo que no aparece aquí puede existir para otro rol (`⚠ NO VERIFICADO`).

## Mapa del menú (16 secciones, 128 URLs distintas)

### Empresa / Configurar Facturación — `/sistema/empresa/` (4)

| URL | Etiqueta en el menú |
|---|---|
| `empresa/configuracion/` | (botón + / registrar) |
| `empresa/configuracion/usuario/registrar/` | Usuario |
| `empresa/solicitudes/` | (botón + / registrar) |
| `empresa/configurar_facturacion_wizard/` | Configurar Facturación |

### Contabilidad — `/sistema/contabilidad/` (5)

| URL | Etiqueta en el menú |
|---|---|
| `contabilidad/libro_diario/asiento/registrar/` | Asiento |
| `contabilidad/libro_diario/` | Asientos |
| `contabilidad/ejercicio_contable/` | Ejercicios Contables |
| `contabilidad/cuenta/` | Plan de Cuentas |
| `contabilidad/centro_costo/` | Centros de Costos |

### Transacciones (registro) — `/sistema/registro/` (27)

| URL | Etiqueta en el menú |
|---|---|
| `registro/documento/registrar/?proforma=1` | Proforma |
| `registro/documento/registrar/?cotizacion=1` | Cotización |
| `registro/documento/registrar/?prefactura=1` | Prefactura |
| `registro/documento/registrar/?de=1` | Documento Electrónico |
| `registro/documento/registrar/` | Documento Físico |
| `registro/transaccion/registrar/` | Cobro/Pago |
| `registro/transaccion/registrar/?masivo=1` | Pago Masivo |
| `registro/transaccion/cruzar_documentos/` | Cruce |
| `registro/deposito/registrar/` | Depósito |
| `registro/documento/guiaremision/registrar/` | Guía de Remisión |
| `registro/documento/guiaremision/` | Guía de Remisión |
| `registro/electronicos/importar/retenciones/` | Carga de Retenciones |
| `registro/electronicos/importar/facturas/` | Carga de Compras |
| `registro/documento/?proforma=1` | Proformas |
| `registro/documento/?proforma=1&tipo_documento=COT` | Cotizaciones |
| `registro/documento/?proforma=1&tipo_documento=PRE` | Prefacturas |
| `registro/documento/` | Documentos |
| `registro/documento/?tipo_registro=CLI` | Clientes |
| `registro/documento/?tipo_registro=PRO` | Proveedores |
| `registro/documento/registrar/?proveedor=1` | (botón + / registrar) |
| `registro/documento/?emision=FI` | Físicos y Otros |
| `registro/documento_anulado/` | Anulaciones |
| `registro/transaccion/` | Cobros/Pagos |
| `registro/transaccion/?tipo=CPM` | Cobros/Pagos Masivos |
| `registro/transaccion/?tipo=R` | Pagos con Cruce |
| `registro/deposito/` | Depósitos |
| `registro/transaccion/?tipo=P&forma_pago=CAJA CHICA` | Rep. Caja Chica |

### Bancos — `/sistema/banco/` (15)

| URL | Etiqueta en el menú |
|---|---|
| `banco/movimiento/registrar/` | Movimiento |
| `banco/movimiento/registrar/?tipo_registro=I&tipo_movimiento=D` | Depósito |
| `banco/movimiento/registrar/?tipo_registro=E&tipo_movimiento=T` | Transferencia |
| `banco/anticipo/registrar/` | Anticipo |
| `banco/reposicion/registrar/` | Rep. Caja Chica |
| `banco/conciliacion/registrar/` | Conciliación |
| `banco/cheque_protestado/registrar/` | Cheque Protestado |
| `banco/consultar_movimientos/` | Estado de Cuenta |
| `banco/movimientos/` | Movimientos |
| `banco/movimientos/?tipo_movimiento=D` | Depósitos |
| `banco/movimientos/?tipo_movimiento=T` | Transferencias |
| `banco/movimientos/?generado=ANT` | Anticipos |
| `banco/conciliacion/` | Conciliación Bancaria |
| `banco/cheque_protestado/` | Cheques Protestados |
| `banco/cuentas_bancarias/` | Configuraciones |

### Tarjeta de crédito — `/sistema/tarjeta_credito/` (4)

| URL | Etiqueta en el menú |
|---|---|
| `tarjeta_credito/liquidacion/registrar/` | Liquidación TC |
| `tarjeta_credito/liquidacion/` | Liquidaciones |
| `tarjeta_credito/lote/` | Lotes |
| `tarjeta_credito/comercio/` | Configuraciones |

### Personas — `/sistema/persona/` (2)

| URL | Etiqueta en el menú |
|---|---|
| `persona/registrar/` | Persona |
| `persona/` | Personas |

### RRHH / Nómina — `/sistema/rrhh/` (9)

| URL | Etiqueta en el menú |
|---|---|
| `rrhh/pago/agregar_descuento/?tipo_conf=RPM` | Préstamo |
| `rrhh/periodo_pagos_beneficios/` | Pago Beneficio |
| `rrhh/pago/registrar_pago/?tipo_rol=RPM` | Pagos Mensuales |
| `rrhh/pago/registrar_pago/?tipo_rol=RPQ` | Pagos Quincenales |
| `rrhh/periodos/` | Roles |
| `rrhh/prestamos/` | Préstamos |
| `rrhh/consultar_periodos_beneficios/` | Plantillas Décimos |
| `rrhh/movimientos/consultar_movimientos/` | Pagos |
| `rrhh/configuraciones/` | Configuraciones |

### Inventario — `/sistema/inventario/` (11)

| URL | Etiqueta en el menú |
|---|---|
| `inventario/producto/registrar2/` | Producto |
| `inventario/movimiento/registrar/` | Movimiento |
| `inventario/tomafisica/registrar/` | Toma Física |
| `inventario/produccion/registrar/` | Producción |
| `inventario/producto/` | Productos |
| `inventario/movimiento/` | Movimientos |
| `inventario/tomafisica/` | Toma Física |
| `inventario/produccion/` | Producciones |
| `inventario/unidad/` | Unidades |
| `inventario/producto/categoria/` | Categorías |
| `inventario/bodega/` | Bodegas |

### Activos fijos — `/sistema/activo_fijo/` (3)

| URL | Etiqueta en el menú |
|---|---|
| `activo_fijo/activo/registrar/` | Activo Fijo |
| `activo_fijo/activo/` | Activos Fijos |
| `activo_fijo/configuraciones/` | Activos Fijos |

### Fidelización (CRM) — `/sistema/fidelizacion/` (10)

| URL | Etiqueta en el menú |
|---|---|
| `fidelizacion/segmentos/crear/` | Segmento |
| `fidelizacion/niveles/crear/` | Nivel |
| `fidelizacion/promociones/crear/` | Promoción |
| `fidelizacion/reglas_consumo/crear/` | Regla Consumo |
| `fidelizacion/segmentos/` | Segmentos |
| `fidelizacion/niveles/` | Niveles |
| `fidelizacion/promociones/` | Promociones |
| `fidelizacion/promociones/reporte/` | Reporte |
| `fidelizacion/reglas_consumo/` | Reglas Consumos |
| `fidelizacion/dashboard/` | Dashboard |

### Mi perfil — `/sistema/administracion/` (1)

| URL | Etiqueta en el menú |
|---|---|
| `administracion/perfil/` | Mi perfil |

### Mi cuenta / contrato — `/sistema/contrato/` (1)

| URL | Etiqueta en el menú |
|---|---|
| `contrato/mi_cuenta/` | Mi cuenta |

### Sesión — `/sistema/accounts/` (1)

| URL | Etiqueta en el menú |
|---|---|
| `accounts/logout/` | Salir |

### Reportes — `/sistema/reportes/` (29)

| URL | Etiqueta en el menú |
|---|---|
| `reportes/resumen/` | Inicio |
| `reportes/panel/` | Panel de Control |
| `reportes/estado_perdidas_ganancias/` | Estado de Resultados |
| `reportes/balance_general/` | Balance General |
| `reportes/balance_comprobacion/` | Balance de Comprobación |
| `reportes/flujo_caja/` | Flujo de caja |
| `reportes/ventas_gerencial/` | Resumen Gerencial |
| `reportes/ventas_nuevo/` | Ventas |
| `reportes/ventas_semanal/` | Semanal |
| `reportes/ventas_gerencial_detalle/` | Por Productos/Servicios |
| `reportes/ventas_vendedor/` | Por Vendedor |
| `reportes/margen_bruto/` | Costos de Venta |
| `reportes/gastos_no_deducibles/` | Gastos no Deducibles |
| `reportes/control_cartera_op/` | Control de Cartera |
| `reportes/control_anticipos/` | Control de Anticipos |
| `reportes/saldos_inventario/` | Saldos |
| `reportes/saldos_disponible/` | Saldos Disponibles |
| `reportes/movimientos_inventario/` | Kardex |
| `reportes/bitacora_importacion/` | Bitácora Importación |
| `reportes/comparativo_asientos/` | Inventario vs. Asientos |
| `reportes/cuentas/` | Consulta Cuentas/Mayor |
| `reportes/ats/` | ATS |
| `reportes/formularios103/` | Formulario 103 |
| `reportes/formularios104/` | Formulario 104 |
| `reportes/compras_ventas/` | Compras y Ventas |
| `reportes/dinardap/` | Reporte Dinardap |
| `reportes/personalizados_comprasventas/` | Compras/Ventas (Personalizado) |
| `reportes/log_extendido/` | Log de Actividades |
| `reportes/reporte_cartera_contabilidad/` | Cartera vs. Contabilidad |

### Importaciones — `/sistema/importacion/` (1)

| URL | Etiqueta en el menú |
|---|---|
| `importacion/configuraciones/` | Importaciones |

### POS — `/sistema/pos/` (3)

| URL | Etiqueta en el menú |
|---|---|
| `pos/consultar_pos/` | POS |
| `pos/xml/` | Generar archivos |
| `pos/importar_ventas/` | Subir Ventas |

### Firmas electrónicas — `/sistema/firmador/` (2)

| URL | Etiqueta en el menú |
|---|---|
| `firmador/firmar_documento/` | Firmar Documento |
| `firmador/documentos_firmados/` | Documentos firmados |

## Pantalla por pantalla (formularios, filtros, exports)

Generado automáticamente desde `evidencia/pages/*.json` (barrido GET del 22-sep-2026, 128 URLs + reintentos). Por cada pantalla: formularios con método, campos (`nombre<tipo>`; `[n]` = número de opciones del select, con las primeras), columnas de tablas y exports detectados. Los campos `*_template-*` son plantillas de formsets (líneas repetibles).

### Activos fijos (lista)

#### `activo/fijo/activo/` — Consultar Activos Fijos
Secciones: Consultar Activos Fijos · Búsqueda · Generar Reporte
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `fdepreciacion`<hidden>; `fasiento`<hidden>; `filtro`; `fecha_corte`; `estado`<select>[5: Todos, A=Activo, I=Inactivo, D=Depreciado, V=Vendido]; `categoria`<hidden>; `tipo`<hidden>; `ubicacion`<hidden>
- Form `(fuera de form)` : `fecha_iniciodepreciacion`; `fecha`
- Tabla: Fecha | Código | Nombre | Valor Inicial | Valor Depreciado | Valor Actual | Acciones

### Activos fijos

#### `activo_fijo/activo/registrar/` — Registrar Activo Fijo
Secciones: Registrar Activo Fijo · Dar de Baja Activo Fijo · Datos Generales · Datos de Compra · Ubicación
- Form `form_registrar_activo` POST · exports: excel, pdf: `fecha_baja`; `id`<hidden>; `baja`<hidden>; `estado`<select>[4: A=Activo, I=Inactivo, D=Depreciado, V=Vendido]; `codigo`; `nombre`; `categoria`<hidden>; `tipo`<hidden>; `porcentaje_depreciacion`<select>[4: 5.00=5%, 10.00=10%, 20.00=20%, 33.00=33%]; `porcentaje_residual`; `adicional1`; `adicional2`; `descripcion`<textarea>; `fecha_registro`; `valor_inicial`; `fecha_inicio_depreciacion`; `generar_asiento_depreciacion`<checkbox>; `depreciacion_curso`<checkbox>; `ubicacion`<hidden>

#### `activo_fijo/configuraciones/` — Categorías
Secciones: Categorías · Búsqueda · Registrar Categoría · Registrar Ubicación · Categoría
- Form `(sin id)` GET · exports: excel, pdf: `filtro`; `tipo_filtro`<select>[4: Todos, GTO=Costos, ADM=Gastos Administrativos, VTA=Gastos Ventas]
- Form `form_categoria` POST: `objeto`<hidden>; `id`<hidden>; `nombre`; `tipo`<select>[3: GTO=Costos, ADM=Gastos Administrativos, VTA=Gastos Ventas]; `cuenta_activo`<hidden>; `cuenta_ingreso`<hidden>; `cuenta_depreciacion_acumulada`<hidden>; `cuenta_depreciacion`<hidden>; `cuenta_activo_deterioro`<hidden>; `cuenta_costo`<hidden>; `cuenta_gastoadm`<hidden>; `cuenta_gastovta`<hidden>; `cuenta_costo_venta`<hidden>; `porcentaje_depreciacion`<select>[4: 5=5%, 10=10%, 20=20%, 33=33%]; `porcentaje_residual`; `depreciar`<checkbox>
- Form `formTipo` POST: `categoria_id`<hidden>; `padre_id`<hidden>; `id`<hidden>; `nombre`
- Form `form_ubicacion` POST: `objeto`<hidden>; `id`<hidden>; `codigo`; `nombre`
- Tabla: Nombre | Tipo | % Dep. anual | Acciones
- Tabla:  | Tipos de Activo
- Tabla: Codigo | Nombre | Acciones

### Mi perfil

#### `administracion/perfil/` — Mi perfil
Secciones: Mi perfil · Actualizar · Verificación dos pasos · Datos Personales · Daniel Chamorro
- Form `actualizarForm` POST: `form_name`<hidden>; `tipo`<hidden>; `correo`; `celular`; `clave_actual`<password>; `clave_nueva`<password>; `confirmar_clave_nueva`<password>
- Form `Verificar2FAForm` POST: `form_name`<hidden>; `otp-tipo`<hidden>; `otp-tiempo`<hidden>; `otp-correo_alternativo`; `otp-codigo`<password>
- Form `fotoForm` POST: `form_name`<hidden>; `foto`<file>

### Bancos

#### `banco/anticipo/registrar/` — Registrar Anticipo
Secciones: Registrar Anticipo · Datos Generales
- Form `anticipoForm` POST: `id`<hidden>; `duplicar`<hidden>; `tipo_registro_anticipo`<select>[2: PRO=Proveedor, CLI=Cliente]; `tipo_movimiento`<select>[5: D=Depósito, N=Transferencia/NC, X=Tarjeta Crédito, C=Cheque, T=Transferencia/ND]; `fecha_emision`; `numero_comprobante`; `cuenta_tarjeta_id`<hidden>; `lote_id`<hidden>; `cuenta_bancaria_id`<hidden>; `persona_id`<hidden>; `nombre_persona`; `numero_cheque`; `fecha_cheque`; `descripcion`<textarea>; `1-cuenta_id`<hidden>; `1-monto`; `1-centro_costo_id`<hidden>; `1-proyecto_id`<hidden>
- Tabla: Cuenta | Monto | Centro de Costo | Proyecto

#### `banco/cheque_protestado/` — Consultar Cheques Protestados
Secciones: Consultar Cheques Protestados · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `persona_id`<hidden>; `fecha_inicio`; `cuenta_bancaria_id`<hidden>; `fecha_fin`; `numero_cheque`
- Tabla: Emisión | Persona | Cuenta Bancaria | # Cheque | Valor Cheque | Valor Multa | Total | Acciones

#### `banco/cheque_protestado/registrar/` — Registrar Cheque Protestado
Secciones: Registrar Cheque Protestado · Datos Generales
- Form `id_chequeprotestado_form` POST: `id`<hidden>; `fecha_emision`; `persona_id`<hidden>; `cuenta_bancaria_id`<hidden>; `numero_cheque`; `fecha_cheque`; `valor_cheque`; `valor_multa`; `numero_comprobante`; `descripcion`<textarea>

#### `banco/conciliacion/` — Consultar Conciliaciones
Secciones: Consultar Conciliaciones · Búsqueda
- Form `(sin id)` GET: `pagina`<hidden>; `banco`<hidden>; `fecha_inicio`; `fecha_fin`; `filtro`
- Form `(fuera de form)` : `con_644297`<checkbox>; `con_644301`<checkbox>; `con_641801`<checkbox>; `con_641805`<checkbox>; `con_639302`<checkbox>; `con_639303`<checkbox>; `con_639304`<checkbox>; `con_639295`<checkbox>; `con_639298`<checkbox>; `con_639299`<checkbox>; `con_634825`<checkbox>; `con_635252`<checkbox>; `con_635344`<checkbox>; `con_639305`<checkbox>; `con_634824`<checkbox>; `con_635053`<checkbox>; `con_635251`<checkbox>; `con_639301`<checkbox>; `con_634246`<checkbox>; `con_634400`<checkbox>; `con_634768`<checkbox>; `con_635250`<checkbox>; `con_635337`<checkbox>; `con_632637`<checkbox>; `con_634258`<checkbox>
- Form `(sin id)` POST → /sistema/banco/conciliacion_excel/: `conc_ids`<hidden>
- Tabla:  | Fecha | Banco | Estado | Saldo Final | Acciones

#### `banco/conciliacion/registrar/` — Registrar Conciliación
Secciones: Registrar Conciliación · Información de la Conciliación
- Form `(sin id)` POST: `id`<hidden>; `fecha_corte`; `saldo_final_estado_cuenta`; `saldo_inicial`<hidden>; `saldo_final`<hidden>; `total`<hidden>; `banco`<hidden>; `descripcion`<textarea>; `detalle_template-seleccionar`<checkbox>; `detalle_template-movimiento_id`<hidden>
- Tabla:  | Fecha | Detalle | Referencia | Tipo | Monto

#### `banco/consultar_movimientos/` — Consultar Movimientos Bancarios
Secciones: Consultar Movimientos Bancarios · Búsqueda
- Form `(sin id)` POST · exports: excel: `pagina`<hidden>; `banco`<hidden>; `fecha_inicio`; `fecha_fin`; `tipo`<select>[6: Todos, 1=Cheque, 2=Depósito, 3=Nota de Crédito, 4=Nota de Débito, 5=Transferencia]; `estado_cheque`<select>[3: Todos, 1=Anulados, 0=No Anulados]
- Tabla: Fecha | Detalle | Persona | Referencia | Tipo | Monto | Saldo

#### `banco/cuentas_bancarias/` — Consultar Cuentas Bancarias
Secciones: Consultar Cuentas Bancarias · Búsqueda
- Form `(sin id)` GET: `pagina`<hidden>; `filtro`
- Tabla: Cuenta Bancaria | Número | Tipo | Ciudad | Cuenta Contable | Banco | Acciones

#### `banco/movimiento/registrar/` — Registrar Movimiento Bancario
Secciones: Registrar Movimiento Bancario · Datos Generales
- Form `chequeForm` POST: `id`<hidden>; `duplicar`<hidden>; `tipo_registro_movimiento`<select>[2: E=Egreso, I=Ingreso]; `tipo_movimiento`<select>[5: D=Depósito, N=Transferencia/NC, X=Tarjeta Crédito, C=Cheque, T=Transferencia/ND]; `anulado`<checkbox>; `fecha_emision`; `numero_comprobante`; `cuenta_bancaria_id`<hidden>; `persona_id`<hidden>; `nombre_persona`; `numero_cheque`; `fecha_cheque`; `descripcion`<textarea>; `1-cuenta_id`<hidden>; `1-monto`; `1-centro_costo_id`<hidden>; `1-proyecto_id`<hidden>; `template-cuenta_id`<hidden>; `template-monto`; `template-centro_costo_id`<hidden>; `template-proyecto_id`<hidden>
- Tabla:  | Cuenta | Monto | Centro de Costo | Proyecto

#### `banco/movimiento/registrar/?tipo_registro=E&tipo_movimiento=T` — Registrar Movimiento Bancario
Secciones: Registrar Movimiento Bancario · Datos Generales
- Form `chequeForm` POST: `id`<hidden>; `duplicar`<hidden>; `tipo_registro_movimiento`<select>[2: E=Egreso, I=Ingreso]; `tipo_movimiento`<select>[5: D=Depósito, N=Transferencia/NC, X=Tarjeta Crédito, C=Cheque, T=Transferencia/ND]; `anulado`<checkbox>; `fecha_emision`; `numero_comprobante`; `cuenta_bancaria_id`<hidden>; `persona_id`<hidden>; `nombre_persona`; `numero_cheque`; `fecha_cheque`; `descripcion`<textarea>; `1-cuenta_id`<hidden>; `1-monto`; `1-centro_costo_id`<hidden>; `1-proyecto_id`<hidden>; `template-cuenta_id`<hidden>; `template-monto`; `template-centro_costo_id`<hidden>; `template-proyecto_id`<hidden>
- Tabla:  | Cuenta | Monto | Centro de Costo | Proyecto

#### `banco/movimientos/` — Consultar Movimientos
Secciones: Consultar Movimientos · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf, excel_detallado: `numero_comprobante`; `fecha_inicio`; `numero_cheque`; `fecha_fin`; `persona_id`<hidden>; `persona`<hidden>; `origen`<select>[3: Todos, mov=Movimientos, trans=Transacciones]; `cuenta_bancaria_id`<hidden>; `cuenta_bancaria`<hidden>; `tipo_registro_movimiento`<select>[3: Todos, E=Egreso, I=Ingreso]; `centro_costo`<hidden>; `centro_costo_filter`<hidden>; `tipo_movimiento`<select>[6: Todos, D=Depósito, N=Transferencia/NC, X=Tarjeta Crédito, C=Cheque, T=Transferencia/ND]; `tipo_movimiento`<select>[1: Todos]; `numero_documento`; `estado_cheque`<select>[3: Todos, 1=Anulados, 0=No Anulados]; `tipo_plantilla`<select>[4: Todos, ANT=Anticipo, REP=Reposicion de caja, RRHH]; `tipo_plantilla`<select>[1: Todos]
- Tabla:  | Emisión | # Comprobante | Persona | Transacción | Cuenta | Total | Acciones

#### `banco/movimientos/?generado=ANT` — Consultar Movimientos
Secciones: Consultar Movimientos · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf, excel_detallado: `numero_comprobante`; `fecha_inicio`; `numero_cheque`; `fecha_fin`; `persona_id`<hidden>; `persona`<hidden>; `origen`<select>[3: Todos, mov=Movimientos, trans=Transacciones]; `cuenta_bancaria_id`<hidden>; `cuenta_bancaria`<hidden>; `tipo_registro_movimiento`<select>[3: Todos, E=Egreso, I=Ingreso]; `centro_costo`<hidden>; `centro_costo_filter`<hidden>; `tipo_movimiento`<select>[6: Todos, D=Depósito, N=Transferencia/NC, X=Tarjeta Crédito, C=Cheque, T=Transferencia/ND]; `tipo_movimiento`<select>[1: Todos]; `numero_documento`; `estado_cheque`<select>[3: Todos, 1=Anulados, 0=No Anulados]; `tipo_plantilla`<select>[4: Todos, ANT=Anticipo, REP=Reposicion de caja, RRHH]; `tipo_plantilla`<select>[1: Todos]
- Tabla:  | Emisión | # Comprobante | Persona | Transacción | Cuenta | Total | Acciones

#### `banco/movimientos/?tipo_movimiento=T` — Consultar Movimientos
Secciones: Consultar Movimientos · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf, excel_detallado: `numero_comprobante`; `fecha_inicio`; `numero_cheque`; `fecha_fin`; `persona_id`<hidden>; `persona`<hidden>; `origen`<select>[3: Todos, mov=Movimientos, trans=Transacciones]; `cuenta_bancaria_id`<hidden>; `cuenta_bancaria`<hidden>; `tipo_registro_movimiento`<select>[3: Todos, E=Egreso, I=Ingreso]; `centro_costo`<hidden>; `centro_costo_filter`<hidden>; `tipo_movimiento`<select>[6: Todos, D=Depósito, N=Transferencia/NC, X=Tarjeta Crédito, C=Cheque, T=Transferencia/ND]; `tipo_movimiento`<select>[1: Todos]; `numero_documento`; `estado_cheque`<select>[3: Todos, 1=Anulados, 0=No Anulados]; `tipo_plantilla`<select>[4: Todos, ANT=Anticipo, REP=Reposicion de caja, RRHH]; `tipo_plantilla`<select>[1: Todos]
- Tabla:  | Emisión | # Comprobante | Persona | Transacción | Cuenta | Total | Acciones

#### `banco/reposicion/registrar/` — Registrar Reposición Caja Chica
Secciones: Registrar Reposición Caja Chica · Información de la Reposicion
- Form `reposicion_form` POST: `id`<hidden>; `fecha_corte`; `cuenta_caja_chica_id`<hidden>; `tipo_movimiento`<select>[2: C=Cheque, T=Transferencia/ND]; `fecha_emision`; `cuenta_bancaria_id`<hidden>; `numero_comprobante`; `persona_id`<hidden>; `nombre_persona`; `numero_cheque`; `fecha_cheque`; `descripcion`<textarea>
- Tabla:  | Transacción | Persona | F. Emisión | Valor

### Contabilidad

#### `contabilidad/centro_costo/` — Centros de Costos
Secciones: Centros de Costos · Modificar Nombre Centro de Costo
- Form `(sin id)` GET: `estado`<select>[3: Todos, A=Activo, I=Inactivo]
- Form `formCentro` POST: `padre_id`<hidden>; `id`<hidden>; `nombre`; `estado`<select>[2: A=Activo, I=Inactivo]
- Form `formProyecto` POST: `padre_proyecto_id`<hidden>; `id_proyecto`<hidden>; `nombre_proyecto`; `estado_proyecto`<select>[2: AC=Activo, FI=Inactivo]
- Form `formNombreCentro` POST: `label_centro`
- Tabla:  | 

#### `contabilidad/cuenta/` — Plan de Cuentas
Secciones: Plan de Cuentas · Cuenta Contable
- Form `formCuenta` POST: `padre_id`<hidden>; `tipo`<hidden>; `id`<hidden>; `nombre`; `tipo_cuenta_id`<hidden>
- Tabla:  | Cuenta | Saldo

#### `contabilidad/ejercicio_contable/` — Ejercicio Contable
Secciones: Ejercicio Contable · Agregar período contable
- Form `formPeriodo` POST: `id`<hidden>; `fecha_inicio`; `fecha_fin`; `cierre_mensual`<checkbox>; `dia_cierre`
- Tabla: Fecha Inicio | Fecha Fin | Estado | Día de cierre mensual | Acciones

#### `contabilidad/libro_diario/` — Libro Diario
Secciones: Libro Diario · Búsqueda
- Form `(sin id)` GET · exports: excel: `pagina`<hidden>; `cuenta`<hidden>; `fecha_inicio`; `centro_costo`<hidden>; `fecha_fin`; `filtro`; `tipo`<select>[13: Todos, Compra, Venta, Depósito, Inventario, Retención, Asiento, Ingreso, …]; `mes`<select>[13: Todos, 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, …]; `anio`; `proyecto_id`<hidden>

#### `contabilidad/libro_diario/asiento/registrar/` — Registrar Asiento
Secciones: Registrar Asiento · Información del Asiento
- Form `frm_asiento` POST: `duplicar`<hidden>; `fecha`; `glosa`<textarea>; `gasto_no_deducible`<checkbox>; `1-hidden_data_cuenta_id`<hidden>; `1-cuenta_id`<hidden>; `1-debe`; `1-haber`; `1-centro_costo_id`<hidden>; `1-proyecto_id`<hidden>; `2-hidden_data_cuenta_id`<hidden>; `2-cuenta_id`<hidden>; `2-debe`; `2-haber`; `2-centro_costo_id`<hidden>; `2-proyecto_id`<hidden>; `template-cuenta_id`<hidden>; `template-hidden_data_cuenta_id`<hidden>; `template-debe`; `template-haber`; `template-centro_costo_id`<hidden>; `template-proyecto_id`<hidden>
- Tabla:  | Cuenta | Debe | Haber | Centro de Costo | Proyecto

### Mi cuenta / contrato

#### `contrato/mi_cuenta/` — (sin título)
Secciones: Datos de mi cuenta · Servicios · Política de tratamiento de datos · Términos y servicios · Registrar Comprobante
- Tabla: Configuración | Descripción

### Empresa / Configurar Facturación

#### `empresa/configuracion/` — Mi compañía
Secciones: Mi compañía · Guardando Configuración · Eliminar usuario · Reenvío de invitación

#### `empresa/configuracion/usuario/registrar/` — Registrar usuario
Secciones: Registrar usuario · Información de usuario · Permisos de accesos · Contabilidad · Bancos · CRM · Personas · Recursos Humanos · Importaciones · Activo Fijo
- Form `form_usuario` POST: `id`<hidden>; `nombre`; `perfil`<select>[7: A=Administrador, S=Asistente Contable, D=Digitador, V=Vendedor, L=Cliente, T=Agente, C=Contador]; `email`; `conf`<checkbox>; `reg_asiento_con`<checkbox>; `reg_asiento_agr`<checkbox>; `reg_asiento_mod`<checkbox>; `reg_asiento_eli`<checkbox>; `conf_ejerciciosContables_con`<checkbox>; `conf_ejerciciosContables_agr`<checkbox>; `conf_ejerciciosContables_mod`<checkbox>; `conf_ejerciciosContables_cerrar`<checkbox>; `conf_ejerciciosContables_cierre_mensual`<checkbox>; `conf_planDeCuentas_con`<checkbox>; `conf_planDeCuentas_agr`<checkbox>; `conf_planDeCuentas_mod`<checkbox>; `conf_planDeCuentas_eli`<checkbox>; `conf_centroDeCostos_con`<checkbox>; `conf_centroDeCostos_agr`<checkbox>; `conf_centroDeCostos_mod`<checkbox>; `conf_centroDeCostos_eli`<checkbox>; `banc`<checkbox>; `reg_banc_cheque_con`<checkbox>; `reg_banc_cheque_agr`<checkbox>; `reg_banc_cheque_mod`<checkbox>; `reg_banc_cheque_eli`<checkbox>; `reg_banc_consultarMovimientos`<checkbox>; `reg_banc_anticipo_con`<checkbox>; `reg_banc_anticipo_agr`<checkbox>; `reg_banc_anticipo_mod`<checkbox>; `reg_banc_anticipo_eli`<checkbox>; `reg_banc_reposicion_con`<checkbox>; `reg_banc_reposicion_agr`<checkbox>; `reg_banc_reposicion_mod`<checkbox>; `reg_banc_reposicion_eli`<checkbox>; `reg_banc_otros_con`<checkbox>; `reg_banc_otros_agr`<checkbox>; `reg_banc_otros_mod`<checkbox>; `reg_banc_otros_eli`<checkbox>; `reg_banc_conciliacion_con`<checkbox>; `reg_banc_conciliacion_agr`<checkbox>; `reg_banc_conciliacion_mod`<checkbox>; `reg_banc_conciliacion_eli`<checkbox>; `reg_banc_chequeprotestado_con`<checkbox>; `reg_banc_chequeprotestado_agr`<checkbox>; `reg_banc_chequeprotestado_mod`<checkbox>; `reg_banc_chequeprotestado_eli`<checkbox>; `conf_redesCobro_con`<checkbox>; `conf_redesCobro_agr`<checkbox>; `conf_redesCobro_mod`<checkbox>; `conf_redesCobro_eli`<checkbox>; `reg_tarj_liquidacion_con`<checkbox>; `reg_tarj_liquidacion_agr`<checkbox>; `reg_tarj_liquidacion_mod`<checkbox>; `reg_tarj_liquidacion_eli`<checkbox>; `reg_tarj_lote_con`<checkbox>; `reg_tarj_lote_agr`<checkbox>; `reg_tarj_lote_mod`<checkbox>; `reg_tarj_lote_eli`<checkbox>; `crm`<checkbox>; `fid_niv_con`<checkbox>; `fid_niv_agr`<checkbox>; `fid_niv_mod`<checkbox>; `fid_niv_eli`<checkbox>; `fid_seg_con`<checkbox>; `fid_seg_agr`<checkbox>; `fid_seg_mod`<checkbox>; `fid_seg_eli`<checkbox>; `fid_gan_con`<checkbox>; `fid_gan_agr`<checkbox>; `fid_gan_mod`<checkbox>; `fid_gan_eli`<checkbox>; `fid_reporte_promo`<checkbox>; `fid_gas_con`<checkbox>; `fid_gas_agr`<checkbox>; `fid_gas_mod`<checkbox>; `fid_gas_eli`<checkbox>; `pers`<checkbox>; `pers_persona_con`<checkbox>; `pers_persona_agr`<checkbox>; `pers_persona_mod`<checkbox>; `pers_persona_eli`<checkbox>; `pers_guia_mod`<checkbox>; `rrhh`<checkbox>; `conf_rrhh_cargo_con`<checkbox>; `conf_rrhh_cargo_agr`<checkbox>; `conf_rrhh_cargo_mod`<checkbox>; `conf_rrhh_cargo_eli`<checkbox>; `conf_rrhh_dpto_con`<checkbox>; `conf_rrhh_dpto_agr`<checkbox>; `conf_rrhh_dpto_mod`<checkbox>; `conf_rrhh_dpto_eli`<checkbox>; `conf_rrhh_cod_con`<checkbox>; `conf_rrhh_cod_agr`<checkbox>; `conf_rrhh_cod_mod`<checkbox>; `conf_rrhh_cod_eli`<checkbox>; `pers_rrhh_pre_con`<checkbox>; `pers_rrhh_pre_agr`<checkbox>; `pers_rrhh_pre_mod`<checkbox>; `pers_rrhh_pre_eli`<checkbox>; `pers_rrhh_qui_con`<checkbox>; `pers_rrhh_qui_agr`<checkbox>; `pers_rrhh_qui_mod`<checkbox>; `pers_rrhh_qui_eli`<checkbox>; `pers_rrhh_qui_ap`<checkbox>; `pers_rrhh_qui_gen`<checkbox>; `pers_rrhh_sem_agr`<checkbox>; `pers_rrhh_sem_mod`<checkbox>; `pers_rrhh_sem_eli`<checkbox>; `pers_rrhh_sem_gen`<checkbox>; `pers_rrhh_proy_control_asis`<checkbox>; `pers_rrhh_apli_rub_control_asis`<checkbox>; `pers_rrhh_ben_con`<checkbox>; `pers_rrhh_ben_agr`<checkbox>; `pers_rrhh_ben_mod`<checkbox>; `pers_rrhh_ben_eli`<checkbox>; `pers_rrhh_ben_gen`<checkbox>; `impor`<checkbox>; `impor_importacion_con`<checkbox>; `impor_importacion_agr`<checkbox>; `impor_importacion_mod`<checkbox>; `impor_importacion_eli`<checkbox>; `impor_liquidacion_con`<checkbox>; `impor_liquidacion_agr`<checkbox>; `impor_liquidacion_mod`<checkbox>; `impor_liquidacion_eli`<checkbox>; `act`<checkbox>; `act_activo_con`<checkbox>; `act_activo_agr`<checkbox>; `act_activo_mod`<checkbox>; `act_activo_eli`<checkbox>; `act_config_mod`<checkbox>; `act_categoria_con`<checkbox>; `act_categoria_agr`<checkbox>; `act_categoria_mod`<checkbox>; `act_categoria_eli`<checkbox>; `act_tipo_con`<checkbox>; `act_tipo_agr`<checkbox>; `act_tipo_mod`<checkbox>; `act_tipo_eli`<checkbox>; `act_ubicacion_con`<checkbox>; `act_ubicacion_agr`<checkbox>; `act_ubicacion_mod`<checkbox>; `act_ubicacion_eli`<checkbox>; `reg_inv`<checkbox>; `reg_inv_movimiento_con`<checkbox>; `reg_inv_movimiento_agr`<checkbox>; `reg_inv_movimiento_mod`<checkbox>; `reg_inv_movimiento_eli`<checkbox>; `reg_inv_tomafisica_con`<checkbox>; `reg_inv_tomafisica_agr`<checkbox>; `reg_inv_tomafisica_mod`<checkbox>; `reg_inv_tomafisica_eli`<checkbox>; `reg_inv_tomafisica_gen`<checkbox>; `reg_inv_series`<checkbox>; `conf_inv_unidades_con`<checkbox>; `conf_inv_unidades_agr`<checkbox>; `conf_inv_unidades_mod`<checkbox>; `conf_inv_unidades_eli`<checkbox>; `conf_inv_categorias_con`<checkbox>; `conf_inv_categorias_agr`<checkbox>; `conf_inv_categorias_mod`<checkbox>; `conf_inv_categorias_eli`<checkbox>; `conf_inv_productos_con`<checkbox>; `conf_inv_productos_agr`<checkbox>; `conf_inv_productos_mod`<checkbox>; `conf_inv_productos_eli`<checkbox>; `conf_inv_bodegas_con`<checkbox>; `conf_inv_bodegas_agr`<checkbox>; `conf_inv_bodegas_mod`<checkbox>; `conf_inv_bodegas_eli`<checkbox>; `reg_inv_produccion_con`<checkbox>; `reg_inv_produccion_agr`<checkbox>; `reg_inv_produccion_mod`<checkbox>; `reg_inv_produccion_eli`<checkbox>; `inv_prod_formula_mod`<checkbox>; `reg_guia_con`<checkbox>; `reg_guia_agr`<checkbox>; `reg_guia_mod`<checkbox>; `reg_guia_eli`<checkbox>; `reg`<checkbox>; `reg_impret_con`<checkbox>; `reg_impret_agr`<checkbox>; `reg_impret_eli`<checkbox>; `reg_impfac_con`<checkbox>; `reg_impfac_agr`<checkbox>; `conf_bandeja_compras`<checkbox>; `reg_compraventa_con_pro`<checkbox>; `reg_compraventa_agr_pro`<checkbox>; `reg_compraventa_mod_pro`<checkbox>; `reg_compraventa_eli_pro`<checkbox>; `reg_compraventa_con_cot`<checkbox>; `reg_compraventa_agr_cot`<checkbox>; `reg_compraventa_mod_cot`<checkbox>; `reg_compraventa_prod_cot`<checkbox>; `reg_proforma_con_pref`<checkbox>; `reg_proforma_agr_pref`<checkbox>; `reg_proforma_mod_pref`<checkbox>; `reg_proforma_aprob_pref`<checkbox>; `reg_proforma_con_orden`<checkbox>; `reg_proforma_agr_orden`<checkbox>; `reg_proforma_mod_orden`<checkbox>; `reg_proforma_aprob_orden`<checkbox>; `reg_compraventa_con`<checkbox>; `reg_compraventa_agr`<checkbox>; `reg_compraventa_mod`<checkbox>; `reg_compraventa_eli`<checkbox>; `reg_caja_con`<checkbox>; `reg_caja_agr`<checkbox>; `reg_caja_mod`<checkbox>; `reg_anulaciones_con`<checkbox>; `reg_anulaciones_agr`<checkbox>; `reg_cobrospagos_con`<checkbox>; `reg_cobrospagos_agr`<checkbox>; `reg_cobrospagos_mod`<checkbox>; `reg_cobrospagos_eli`<checkbox>; `reg_deposito_con`<checkbox>; `reg_deposito_agr`<checkbox>; `reg_deposito_mod`<checkbox>; `reg_deposito_eli`<checkbox>; `rep`<checkbox>; `rep_resumenGeneral`<checkbox>; `rep_repf_estadoDeResultados`<checkbox>; `rep_repf_balanceGeneral`<checkbox>; `rep_repf_balanceComprobacion`<checkbox>; `rep_repf_flujoDeCaja`<checkbox>; `rep_repg_ventas`<checkbox>; `rep_repg_ventas_cobros`<checkbox>; `rep_repg_ventas_detallado`<checkbox>; `rep_repg_ventasPorVendedor`<checkbox>; `rep_repg_ventasCostos`<checkbox>; `rep_repg_ventasPos`<checkbox>; `rep_ticketsProducto`<checkbox>; `rep_repg_gastosNoDeducibles`<checkbox>; `rep_repg_controlDeCartera`<checkbox>; `rep_repg_controlDeCartera_clientes`<checkbox>; `rep_repg_controlDeCartera_proveedores`<checkbox>; `rep_repg_ventasSemanal`<checkbox>; `rep_repg_controlDeAnticipos`<checkbox>; `rep_repg_controlDeImpuestosSobreUtilidades`<checkbox>; `rep_inv_saldos`<checkbox>; `rep_inv_disponible`<checkbox>; `rep_inv_movimientos`<checkbox>; `rep_inv_bitacoraimportacion`<checkbox>; `rep_inv_egresoscc`<checkbox>; `rep_inv_estimados`<checkbox>; `rep_inv_comp_mov_asi`<checkbox>; `rep_consultaCuentas`<checkbox>; `rep_sri_ats`<checkbox>; `rep_sri_formulario104`<checkbox>; `rep_sri_formulario103`<checkbox>; `rep_sri_anexoice`<checkbox>; `rep_sri_comprasVentas`<checkbox>; `rep_dinardap`<checkbox>; `rep_cobros_pagos`<checkbox>; `rep_logActividades`<checkbox>; `rep_per`<checkbox>; `rep_per_compraventa_con`<checkbox>; `rep_per_compraventa_agr`<checkbox>; `rep_per_compraventa_mod`<checkbox>; `rep_per_compraventa_eli`<checkbox>; `conf_pos_generarArchivos`<checkbox>; `conf_pos_subirVentas`<checkbox>; `conf_firmador`<checkbox>; `conf_firmador_firmar`<checkbox>; `conf_firmador_documentos`<checkbox>; `tiene_restriccion_horario`<checkbox>; `horario_inicio`; `horario_fin`; `es_lunes`<checkbox>; `es_martes`<checkbox>; `es_miercoles`<checkbox>; `es_jueves`<checkbox>; `es_viernes`<checkbox>; `es_sabado`<checkbox>; `es_domingo`<checkbox>; `res_reg`<checkbox>; `reg_compraventa_soloretencion`<checkbox>; `tiene_porc_desc_max`<checkbox>; `porcentaje_maximo`; `reg_compraventa_desaprobar_ocv`<checkbox>; `reg_compraventa_anular_retencion`<checkbox>; `reg_compraventa_anular_documento`<checkbox>; `reg_compraventa_editar_iva`<checkbox>; `res_hist`<checkbox>; `reg_compraventa_historial_documento`<checkbox>; `inv_producto_historial`<checkbox>; `inv_lote_producto_bloq`<checkbox>; `pers_restriccion_pestanias_rrhh`<checkbox>; `pers_restriccion_estado_cuenta`<checkbox>; `res_rep`<checkbox>; `pers_restriccion_reporte_saldos`<checkbox>; `rep_inv_bloq_stock0`<checkbox>; `reg_crm`<checkbox>; `reg_giftcard_mod_saldo`<checkbox>
- Tabla: Seleccionar Todo | Consultar | Agregar | Modificar | Eliminar
- Tabla: Seleccionar Todos | Consultar | Agregar | Modificar | Eliminar
- Tabla: Seleccionar Todos | Consultar | Agregar | Modificar | Eliminar
- Tabla: Seleccionar Todos | Consultar | Agregar | Modificar | Eliminar | Entregar | Generar

#### `empresa/configurar_facturacion_wizard/` — (sin título)
Secciones: Guardando la configuración

#### `empresa/solicitudes/` — Mis tickets
Secciones: Mis tickets
- Tabla: Fecha de solicitud | Servicio | Asesor | Tipo | Estado | Acciones
- Tabla: Fecha de solicitud | Servicio | Asesor | Tipo | Estado | Acciones

### Fidelización (CRM)

#### `fidelizacion/dashboard/` — Dashboard
Secciones: Dashboard · Añadir Registro
- Form `(sin id)` POST: `tipo`<select>[3: ---------, GAN=Gana, PIE=Pierde]; `cliente`<select>; `puntos`<number>
- Tabla: Nombre Persona | Identificación | Tipo | Regla | Puntos | Fecha de creación

#### `fidelizacion/niveles/` — Niveles
Secciones: Niveles · Búsqueda
- Form `nivelForm` GET · exports: excel, pdf: `nombre`; `activo`<select>[3: ---------, 1=Activo, 0=Inactivo]; `puntos_necesarios`<number>
- Tabla: Nombre | Descripcion | Cantidad usuarios | Puntos Necesarios | Acciones

#### `fidelizacion/niveles/crear/` — Nivel
Secciones: Nivel · Datos Generales · Imagen
- Form `(sin id)` POST: `nombre`; `descripcion`<textarea>; `activo`<select>[2: True=Activo, False=Inactivo]; `puntos_necesarios`<number>; `foto`<file>

#### `fidelizacion/promociones/` — Puntos/Promociones
Secciones: Puntos/Promociones · Búsqueda
- Form `reglafilter` GET · exports: excel, pdf: `nombre`; `activo`<select>[3: Todos, 1=Activo, 0=Inactivo]; `tipo_promocion`<select>[3: Todos, COM=Combo, PRO=Producto]
- Tabla: Nombre | Descripción | Target | Tiempo de Actividad | Tipo | Acciones

#### `fidelizacion/promociones/crear/` — Puntos/Promociones
Secciones: Puntos/Promociones · Datos Generales · Público Objetivo · Puntos de Venta
- Form `(sin id)` POST: `pun_promo`<select>[1: PROMO=Promociones]; `nombre`; `descripcion`<textarea>; `activo`<select>[2: True=Activo, False=Inactivo]; `tipo`<select>[7: ---------, EVEN=Regla Evento, EPER=Regla Evento Personaliz, PNGR=Regla General Puntos, CMPR=Regla Compra Producto, MLPT=Regla Multiplicar Punto, PROM=Promocion]; `tipo_promocion`<select>[3: ---------, COM=Combo, PRO=Producto]; `descuento`<number>; `seleccion_combo`<select>[3: 1=En toda la factura, 2=En los productos seleccion, 3=Ultimo producto]; `cantidad_productos`<select>[10: 1, 2, 3, 4, 5, 6, 7, 8, …]; `descuento`<number>; `cantidad_productos`<select>[10: 1, 2, 3, 4, 5, 6, 7, 8, …]; `puntos`<number>; `tipo_evento`<select>[3: primer_compra=Primera Compra, usuario_login=Comprador inic, cuenta_creada=Cuenta Creada]; `nombre_evento_pers`; `valor_minimo_orden`; `multiplicador`<number>; `activo_todo_tiempo`<checkbox>; `desde_fecha`<date>; `hasta_fecha`<date>; `todos_dias`<checkbox>; `lun`<checkbox>; `mar`<checkbox>; `vie`<checkbox>; `mie`<checkbox>; `sab`<checkbox>; `jue`<checkbox>; `dom`<checkbox>; `horas_esp`<checkbox>; `hora_inicio`<time>; `hora_fin`<time>; `target`<select>[4: ---------, ALL=Todos, SEG=Segmento, LEV=Nivel]; `niveles`; `segmentos`; `todos_pos`<checkbox>; `pos`; `foto`<file>; `productos`<hidden>

#### `fidelizacion/promociones/reporte/` — Reporte Venta Promociones
Secciones: Reporte Venta Promociones · Búsqueda
- Form `promoReporte` GET: `fecha_inicio`; `fecha_fin`; `centro_costo_id`<hidden>; `centro_costo`<hidden>; `promocion_id`<hidden>; `promocion`<hidden>
- Tabla: Centro Costo Promoción | Valor Recaudado | Cantidad canjeadas

#### `fidelizacion/reglas_consumo/` — Reglas de Consumo
Secciones: Reglas de Consumo · Búsqueda
- Form `reglaConsumoForm` GET: `nombre`; `activo`<select>[3: ---------, 1=Activo, 0=Inactivo]; `puntos`<number>
- Tabla: Nombre | Descripción | Puntos | Target | Tiempo de Actividad | Acciones

#### `fidelizacion/reglas_consumo/crear/` — Reglas de Consumo
Secciones: Reglas de Consumo · Datos Generales · Público Objetivo · Imagen
- Form `(sin id)` POST: `nombre`; `descripcion`<textarea>; `activo`<select>[2: True=Activo, False=Inactivo]; `puntos`<number>; `activo_todo_tiempo`<checkbox>; `desde_fecha`<date>; `hasta_fecha`<date>; `target`<select>[4: ---------, ALL=Todos, SEG=Segmento, LEV=Nivel]; `niveles`; `segmentos`; `foto`<file>; `productos`<hidden>

#### `fidelizacion/segmentos/` — Segmentos
Secciones: Segmentos · Búsqueda
- Form `segmentoForm` GET · exports: excel, pdf: `nombre`; `activo`<select>[3: ---------, 1=Activo, 0=Inactivo]; `tipo`<select>[6: ---------, aniversario=Aniversario, valor_compra=Valor total de , conteo_transac=Cantidad de t, ultima_compra=Ultima compra , compra_perido=Compra en peri]
- Tabla: Nombre | Descripcion | Tipo | Acciones

#### `fidelizacion/segmentos/crear/` — Segmento
Secciones: Segmento · Datos Generales · Tipo Segmento
- Form `(sin id)` POST: `nombre`; `descripcion`<textarea>; `activo`<select>[2: True=Activo, False=Inactivo]; `tipo`<select>[6: ---------, aniversario=Aniversario, valor_compra=Valor total de , conteo_transac=Cantidad de t, ultima_compra=Ultima compra , compra_perido=Compra en peri]; `tipo_aniversario`<select>[2: CUM=Cumpleanos, REG=Registro]; `dias`<number>; `desde_cantidad`; `hasta_cantidad`; `min_transaccion`<number>; `max_transaccion`<number>; `dias_ultima_compra`<number>; `desde_fecha`<date>; `hasta_fecha`<date>

### Firmas electrónicas

#### `firmador/documentos_firmados/` — Documentos firmados
Secciones: Documentos firmados · Búsqueda
- Form `(sin id)` GET · exports: pdf: `pagina`<hidden>; `documento`; `fecha_desde`; `fecha_hasta`
- Tabla: Fecha y hora | Usuario | Documento | Ubicación | Acciones

#### `firmador/firmar/documento/` — Firmar documentos
Secciones: Firmar documentos · Subir documento · Datos del documento
- Form `form_procesar_pdf` POST: `archivo`<file>

### Importaciones

#### `importacion/configuraciones/` — Importaciones - Configuraciones
Secciones: Importaciones - Configuraciones · Cuentas Contables · Bodega · Persona
- Form `formGenerales` POST: `cta_impor_merca_id`<hidden>; `bodega_merca_id`<hidden>; `persona_impor_id`<hidden>

### Inventario

#### `inventario/bodega/` — Bodegas
Secciones: Bodegas · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `filtro`
- Tabla: Código | Nombre | Centro de Costo | Acciones

#### `inventario/movimiento/` — Movimientos de Inventario
Secciones: Movimientos de Inventario · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `producto_id`<hidden>; `fecha_inicio`; `bodega_id`<hidden>; `fecha_fin`; `codigo`; `documento`; `tipo`<select>[5: Todos, ING=Ingreso, EGR=Egreso, TRA=Traslado, AJU=Ajuste de Costo]; `produccion`; `tipo_registro`<select>[3: Todos, G=Generados, M=Manuales]; `categoria_id`<hidden>; `asiento_generado`<select>[3: Todos, 1=Sí, 0=No]; `origen`<select>[10: Todos, DOC=Documento, PRO=Producción, MAN=Manual, IMP=Importación, API, AUT=Automático, ORP=Orden Pedido, …]; `importacion`<hidden>; `centro_costo_id`<hidden>; `ordencompraventa`
- Tabla: Fecha | Código | Descripción | Bodega Entrante | Bodega Saliente | Total | Asiento Generado | Acciones

#### `inventario/movimiento/registrar/` — Registrar Movimiento de Inventario
Secciones: Registrar Movimiento de Inventario · Agregar Items de una Producción · Información · Agregar Items de un Movimiento · Agregar Color por Item · Información del Movimiento
- Form `(fuera de form)` : `produccion_id`<hidden>; `movimiento_id`<hidden>
- Form `(sin id)` POST: `id`<hidden>; `fecha`; `tipo`<select>[4: ING=Ingreso, EGR=Egreso, TRA=Traslado, AJU=Ajuste de Costo]; `bodega_origen_id`<hidden>; `bodega_destino_id`<hidden>; `ordencompraventa`<hidden>; `descripcion`<textarea>; `generar_asiento`<checkbox>; `cuenta`<hidden>; `centro_costo`<hidden>; `proyecto`<hidden>; `detalle_template-cantidad`; `detalle_template-producto_id`<hidden>; `detalle_template-hidden_data_producto`<hidden>; `detalle_template-serie`; `detalle_template-edicion`; `detalle_template-color_id`<hidden>; `detalle_template-lote`; `detalle_template-fecha_expiracion`; `detalle_template-lotefield`<hidden>; `detalle_template-unidad`<select>; `detalle_template-hidden_unidad`<hidden>; `detalle_template-precio`; `detalle_template-porcentaje_descuento`<hidden>; `detalle_template-descuento`<hidden>; `detalle_template-subtotal`; `detalle_template-ajuste_costo`; `total`; `archivo`<file>
- Tabla:  | Cantidad | Producto | Unidad | Costo Unitario | Costo Unitario | Costo Total | Ajuste Costo

#### `inventario/produccion/` — Producciones
Secciones: Producciones · Búsqueda
- Form `(sin id)` GET · exports: pdf, excel: `pagina`<hidden>; `producto_id`<hidden>; `fecha_inicio`; `categoria_id`<hidden>; `fecha_fin`; `codigo`; `bodega`<hidden>; `estado`<select>[4: Todos, P=Pendiente, R=Producido, S=Provisional]; `bodega_destino`<hidden>
- Tabla: Fecha | Código | Descripción | Bodega Origen | Bod. Destino | Estado | Acciones

#### `inventario/produccion/registrar/` — Registrar Producción
Secciones: Registrar Producción · Datos Generales · Solicitud Materiales · Agregar Producto Adicional
- Form `(sin id)` POST: `id`<hidden>; `gyp`<hidden>; `grq`<hidden>; `estado`<hidden>; `fecha`; `bodega_id`<hidden>; `bodega_destino_id`<hidden>; `descripcion`<textarea>; `produccion_template-producto_id`<hidden>; `produccion_template-actualizacion_pendiente`<hidden>; `produccion_template-cantidad`<number>; `produccion_template-unidad`<select>; `produccion_template-hidden_unidad`<hidden>; `produccion_template-cantidad_teorica`; `produccion_template-unidad_desc`; `produccion_template-cantidad_liquidacion`<number>; `produccion_template-unidad_desc`; `produccion_template-cantidad_liquidacion_desecho`<number>; `produccion_template-unidad_desc`; `produccion_template-cantidad_total`; `produccion_template-unidad_desc`; `produccion_template-cantidad_diferencia`; `produccion_template-unidad_desc`; `produccion_template-hidden_factor`; `produccion_template-factores`<select>; `produccion_template-id`; `bodega_traslado_id`<hidden>
- Form `(fuera de form)` : `tipo_ingreso`<hidden>
- Tabla: Producto | Fórmulas | Proyectado | Producido | Cant Desecho | Cant Total | Diferencia | Acciones | 
- Tabla: Cantidad | Unidad | Producto | Stock
- Tabla: Indicador | Valor

#### `inventario/producto/` — Productos
Secciones: Productos · Búsqueda · ALITAS · BEBIDAS ALCOHOLICAS · BEBIDAS ALCOHOLICAS MP · ACEITES Y MANTECAS · BEBIDAS · BEBIDAS NO ALCOHOLICAS MP · COCTELES · COMBO
- Form `formularioProductos` GET · exports: excel, pdf: `pagina`<hidden>; `costo`<hidden>; `catalogo`<hidden>; `filtro`; `categoria_id`<hidden>; `estado`<select>[3: Todos, A=Activo, I=Inactivo]; `proposito`<select>[3: Todos, C=Compra, V=Venta]; `tipo`<select>[3: Todos, PRO=Producto, SER=Servicio]; `tipo_producto`<select>[5: Todos, SIM=Simple, COM=Combo, PRO=De producción, COP=Compuesto]; `iva`<select>[5: 1=Todos, 15=IVA 15%, 5=IVA 5%, 0=IVA 0%, -1=No grava]; `gasto_personal`<select>[7: Todos, ALI=Alimentación, EDU=Educación, arte y cultur, SAL=Salud, TUR=Turismo, VES=Vestimenta, VIV=Vivienda]; `consultar_filtros`<hidden>
- Form `(fuera de form)` : `categ-400912`<checkbox>; `categ-400913`<checkbox>; `categ-400914`<checkbox>; `categ-400915`<checkbox>; `categ-400916`<checkbox>; `categ-400917`<checkbox>; `categ-400918`<checkbox>; `categ-400919`<checkbox>; `categ-400920`<checkbox>; `categ-400921`<checkbox>; `categ-400922`<checkbox>; `categ-400923`<checkbox>; `categ-400924`<checkbox>; `categ-400925`<checkbox>; `categ-400926`<checkbox>; `categ-400927`<checkbox>; `categ-400928`<checkbox>; `categ-400929`<checkbox>; `categ-400930`<checkbox>; `categ-400931`<checkbox>; `categ-400932`<checkbox>; `categ-400933`<checkbox>; `categ-400934`<checkbox>; `categ-400935`<checkbox>; `categ-400936`<checkbox>; `categ-400937`<checkbox>; `categ-400938`<checkbox>; `categ-400939`<checkbox>; `categ-400940`<checkbox>; `categ-400941`<checkbox>; `categ-400942`<checkbox>; `categ-400943`<checkbox>; `categ-400944`<checkbox>; `categ-400945`<checkbox>; `categ-400946`<checkbox>; `categ-400947`<checkbox>; `categ-400948`<checkbox>; `categ-400949`<checkbox>; `categ-400950`<checkbox>; `categ-411478`<checkbox>; `categ-416612`<checkbox>; `categ-416613`<checkbox>; `categ-416727`<checkbox>; `categ-417326`<checkbox>; `categ-417329`<checkbox>; `categ-417330`<checkbox>; `categ-417331`<checkbox>; `categ-417504`<checkbox>; `categ-523662`<checkbox>; `categ-526090`<checkbox>; `categ-541968`<checkbox>; `categ-604753`<checkbox>; `categ-604754`<checkbox>; `categ-604786`<checkbox>; `categ-604811`<checkbox>; `categ-604982`<checkbox>; `categ-604983`<checkbox>; `categ-604984`<checkbox>; `categ-604985`<checkbox>; `categ-604992`<checkbox>; `categ-604993`<checkbox>; `categ-605411`<checkbox>; `categ-605566`<checkbox>; `categ-605749`<checkbox>; `categ-605778`<checkbox>; `categ-606578`<checkbox>; `categ-626145`<checkbox>; `categ-638900`<checkbox>; `categ-639919`<checkbox>; `categ-648588`<checkbox>; `categ-654501`<checkbox>; `categ-654783`<checkbox>; `categ-654784`<checkbox>; `categ-654786`<checkbox>; `categ-654787`<checkbox>; `categ-654789`<checkbox>; `categ-654790`<checkbox>; `categ-655371`<checkbox>; `categ-655372`<checkbox>; `categ-655373`<checkbox>; `categ-657661`<checkbox>; `categ-657901`<checkbox>; `categ-658067`<checkbox>; `categ-659478`<checkbox>; `categ-660581`<checkbox>; `categ-660857`<checkbox>; `categ-661154`<checkbox>; `categ-662023`<checkbox>
- Tabla:  | Código | Nombre | Unidad | Stock | PVP1 | IVA | Propósito | Acciones
- Tabla:  | Código | Nombre | Unidad | Stock | PVP1 | IVA | Propósito | Acciones
- Tabla:  | Código | Nombre | Unidad | Stock | PVP1 | IVA | Propósito | Acciones
- Tabla:  | Código | Nombre | Unidad | Stock | PVP1 | IVA | Propósito | Acciones

#### `inventario/producto/categoria/` — Categorías de Productos
Secciones: Categorías de Productos
- Form `formCategoria` POST: `padre_id`<hidden>; `id`<hidden>; `nombre`; `agrupar`<checkbox>; `dias_plazo`; `tipo_producto`<select>[2: SERV=Servicio, PROD=Bien/Producto]; `para_venta`<checkbox>; `cuenta_venta_id`<hidden>; `actualizar_para_venta`<checkbox>; `para_compra`<checkbox>; `cuenta_compra_id`<hidden>; `actualizar_para_compra`<checkbox>; `inventariable`<checkbox>; `cuenta_inventario_id`<hidden>; `actualizar_para_inventario`<checkbox>; `es_comisariato`<hidden>
- Tabla:  | Categoría | Agrupada

#### `inventario/producto/registrar2/` — Producto
Secciones: Producto · Datos Generales · Variantes · Contabilidad · Combo · Fórmula · Configuraciones · Historial de cambios · Fotos de Producto
- Form `(sin id)` POST: `id`<hidden>; `estado`<select>[2: A=Activo, I=Inactivo]; `codigo`; `codigo_auxiliar`; `categoria_id`<hidden>; `nombre`; `maneja_nombremanual`<checkbox>; `tipo`<select>[2: PRO=Producto, SER=Servicio]; `tipo_producto`<select>[3: SIM=Simple, PRO=De producción, COP=Compuesto]; `unidad_id`<hidden>; `gasto_personal`<select>[7: NAP=No aplica, ALI=Alimentación, EDU=Educación, arte y cultur, SAL=Salud, TUR=Turismo, VES=Vestimenta, VIV=Vivienda]; `descripcion`<textarea>; `codigo_proveedor`; `campo_catalogo`<textarea>; `bloquear_descuento`<checkbox>; `pvp1`; `pvp2`; `pvp3`; `pvp_distribuidor`; `maneja_pvpmanual`<checkbox>; `iva`<select>[4: 15=IVA 15%, 5=IVA 5%, 0=IVA 0%, -1=No objeto a IVA]; `tipo_ice`<select>[3: NAP=No aplica, PICE=Por Porcentaje, VICE=Por Valor Fijo]; `porcentaje_ice`; `valor_ice`; `porcentaje_servicio`<checkbox>; `variante1`<hidden>; `variante1_es_principal`<checkbox>; `variante2`<hidden>; `variante2_es_principal`<checkbox>; `variante3`<hidden>; `variante3_es_principal`<checkbox>; `valvariante1`<hidden>; `valvariante2`<hidden>; `valvariante3`<hidden>; `variante1_es_compartida`<checkbox>; `variante2_es_compartida`<checkbox>; `variante3_es_compartida`<checkbox>; `para_venta`<checkbox>; `cuenta_venta_id`<hidden>; `para_compra`<checkbox>; `cuenta_compra_id`<hidden>; `inventariable`<checkbox>; `cuenta_costo_id`<hidden>; `minimo`; `para_importacion`<checkbox>; `combo_template-producto_detalle_id`<hidden>; `combo_template-porcentaje_iva`<hidden>; `combo_template-porcentaje_ice`<hidden>; `combo_template-cuenta_venta_id`<hidden>; `combo_template-cantidad`; `combo_template-pvp1`; `combo_template-base_cero1`<hidden>; `combo_template-base_gravable1`<hidden>; `combo_template-base_no_gravable1`<hidden>; `combo_template-ice1`<hidden>; `combo_template-pvp2`; `combo_template-base_cero2`<hidden>; `combo_template-base_gravable2`<hidden>; `combo_template-base_no_gravable2`<hidden>; `combo_template-ice2`<hidden>; `combo_template-pvp3`; `combo_template-base_cero3`<hidden>; `combo_template-base_gravable3`<hidden>; `combo_template-base_no_gravable3`<hidden>; `combo_template-ice3`<hidden>; `combo_template-pvp_distribuidor`; `combo_template-base_cerodist`<hidden>; `combo_template-base_gravabledist`<hidden>; `combo_template-base_no_gravabledist`<hidden>; `combo_template-icedist`<hidden>; `combo_1-producto_detalle_id`<hidden>; `combo_1-porcentaje_iva`<hidden>; `combo_1-porcentaje_ice`<hidden>; `combo_1-cuenta_venta_id`<hidden>; `combo_1-cantidad`; `combo_1-pvp1`; `combo_1-base_cero1`<hidden>; `combo_1-base_gravable1`<hidden>; `combo_1-base_no_gravable1`<hidden>; `combo_1-ice1`<hidden>; `combo_1-pvp2`; `combo_1-base_cero2`<hidden>; `combo_1-base_gravable2`<hidden>; `combo_1-base_no_gravable2`<hidden>; `combo_1-ice2`<hidden>; `combo_1-pvp3`; `combo_1-base_cero3`<hidden>; `combo_1-base_gravable3`<hidden>; `combo_1-base_no_gravable3`<hidden>; `combo_1-ice3`<hidden>; `combo_1-pvp_distribuidor`; `combo_1-base_cerodist`<hidden>; `combo_1-base_gravabledist`<hidden>; `combo_1-base_no_gravabledist`<hidden>; `combo_1-icedist`<hidden>; `formula_template-producto_detalle_id`<hidden>; `formula_template-cantidad`; `formula_template-unidad`<select>; `formula_template-hidden_unidad`<hidden>; `formula_1-producto_detalle_id`<hidden>; `formula_1-cantidad`; `formula_1-unidad`<select>; `formula_1-hidden_unidad`<hidden>; `tipo_formula_template-nombre`; `tipo_formula_template-seleccion`<select>[3: UN=Sólo Uno, VA=Varios o Ninguno, NE=No Elegible]; `tipo_formula_template_iddetalle-producto_detalle_id`<hidden>; `tipo_formula_template_iddetalle-cantidad`; `tipo_formula_template_iddetalle-unidad`<select>; `tipo_formula_template_iddetalle-hidden_unidad`<hidden>; `tipo_formula_1-nombre`; `tipo_formula_1-seleccion`<select>[3: UN=Sólo Uno, VA=Varios o Ninguno, NE=No Elegible]; `tipo_formula_1_iddetalle-producto_detalle_id`<hidden>; `tipo_formula_1_iddetalle-cantidad`; `tipo_formula_1_iddetalle-unidad`<select>; `tipo_formula_1_iddetalle-hidden_unidad`<hidden>; `para_pos`<checkbox>; `todos_pos`<checkbox>; `pos_input`; `maneja_control_stock`<checkbox>; `maneja_balanza`<checkbox>; `costo_maximo`; `dias_plazo`<number>; `para_ordencompra`<checkbox>; `factor2`; `factor22`; `unidad2_id`<hidden>; `factor3`; `factor33`; `unidad3_id`<hidden>; `factor4`; `factor44`; `unidad4_id`<hidden>; `factor5`; `factor55`; `unidad5_id`<hidden>
- Tabla:  | Producto | Cta Venta | Cantidad | Unidad | PVP 1 | PVP 2 | PVP 3 | PVP Dist
- Tabla:  | Producto | Cantidad | Unidad
- Tabla:  | Producto | Cantidad | Unidad
- Tabla:  | Producto | Cantidad | Unidad

#### `inventario/tomafisica/` — Movimientos de Inventario
Secciones: Movimientos de Inventario · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `producto_id`<hidden>; `fecha_inicio`; `bodega_id`<hidden>; `fecha_fin`; `codigo`; `categoria_id`<hidden>
- Tabla: Fecha | Código | Bodega | Descripción | Acciones

#### `inventario/tomafisica/registrar/` — Registrar Toma Física de Inventario
Secciones: Registrar Toma Física de Inventario · Cargando datos... · Información del Movimiento · Generar Movimientos
- Form `(sin id)` POST: `id`<hidden>; `generar`<hidden>; `fecha`; `bodega`<hidden>; `descripcion`<textarea>; `detalle_template-producto`<hidden>; `detalle_template-generar`<hidden>; `detalle_template-unidad`<select>; `detalle_template-hidden_unidad`<hidden>; `detalle_template-cantidad_sistema`<number>; `detalle_template-cantidad_registrada`<number>; `detalle_template-cantidad_diferencia`<number>; `archivo`<file>; `generar_asiento_ingreso`<checkbox>; `cuenta_ingreso`<hidden>; `generar_asiento_egreso`<checkbox>; `cuenta_egreso`<hidden>
- Tabla:  | Producto | Unidad | Cantidad Sistema | Cantidad Real | Diferencia

#### `inventario/unidad/` — Unidades
Secciones: Unidades · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `filtro`
- Tabla: Nombre | Abreviatura | Acciones

### Personas

#### `persona/` — Consultar Personas
Secciones: Consultar Personas · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `incluir_saldo`<hidden>; `filtro`; `rol`<select>[6: Todos, C=Clientes, P=Proveedores, E=Empleados, D=Doctor, V=Vendedor]; `tipo_persona`<select>[5: Todos, N=Natural, J=Jurídica, I=Sin RUC/CI, P=Placa]; `estado`<select>[3: Todos, A=Activo, I=Inactivo]
- Tabla:  | Identificación | Razón Social | Nombre Comercial | Acciones

#### `persona/registrar/` — Registrar Persona
Secciones: Registrar Persona · Datos de la Persona · Rol de persona en la empresa · Cliente · Datos Bancarios
- Form `registrar_persona` POST: `modo_consulta`<hidden>; `estado`<select>[2: A=Activo, I=Inactivo]; `tipo`<select>[3: N=Natural, J=Jurídica, I=Sin RUC/CI]; `es_contribuyente_especial`<checkbox>; `ruc`; `cedula`; `razon_social`; `nombre_comercial`; `telefonos`; `direccion`; `abreviatura_titulo_prof`<select>[60: -- Seleccionar/Buscar --, Abg.=Abogado, Adm.=Administrador, Alcde.=Alcalde, Almte.=Almirante, Anl.=Analista, Arq.=Arquitecto, Arz.=Arzobispo, …]; `provincia`<select>[26: -, 1=AZUAY, 2=BOLÍVAR, 3=CAÑAR, 4=CARCHI, 5=COTOPAXI, 6=CHIMBORAZO, 7=EL ORO, …]; `canton`<select>[1: -]; `parroquia`; `sexo`<select>[3: -, M=Masculino, F=Femenino]; `estado_civild`<select>[6: -, S=Soltero, C=Casado, D=Divorciado, U=Unión Libre, V=Viudo]; `origen_ingresos`<select>[8: -, B=Empleado Público, V=Empleado Privado, I=Independiente, A=Ama de casa - Estudiante, R=Rentista, H=Jubilado, M=Remesas exterior]; `es_extranjero`<checkbox>; `personaasociada_id`<hidden>; `categoria_id`<hidden>; `dias_vencimiento`; `bloquear_cliente`<checkbox>; ``<select>; `email`; `es_cliente`<checkbox>; `cuenta_por_cobrar_id`<hidden>; `saldo_cliente`; `vendedor_id`<select>[30: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `pvp_default`<select>[5: -, pvp1=PVP 1, pvp2=PVP 2, pvp3=PVP 3, pvp_distribuidor=PVP Distrib]; `es_pvp_default_manual`<checkbox>; `descuento`; `es_exterior`<checkbox>; `aplicar_cupo`<checkbox>; `cupo_credito`; `dias_credito`; `centro_costo_cliente`<hidden>; `es_proveedor`<checkbox>; `cuenta_por_pagar_id`<hidden>; `saldo_proveedor`; `cuenta_recurrente`<hidden>; `tipo_retencion_ir`<hidden>; `tipo_retencion_iva`<hidden>; `centro_costo_proveedor`<hidden>; `es_relacionada`<checkbox>; `es_artesanal`<checkbox>; `es_transportista`<checkbox>; `es_empleado`<checkbox>; `es_gerente`<checkbox>; `gerente_relacion_laboral`<checkbox>; `es_pasante`<checkbox>; `es_accionista`<checkbox>; `cuenta_por_pagar_accionista_id`<hidden>; `es_vendedor`<checkbox>; `id`<hidden>; `banco_codigo`<select>[60: -- Seleccionar/Buscar --, 190=ABANCA CORPORACION CORPO, 199=AUSTROBANK, 109=BAC INTERNATIONAL BANK, 104=BANCO ALIADO, 1=BANCO AMAZONAS, 31=BANCO ASISTENCIA COMUNITA, 113=BANCO AZTECA, …]; `num_tarjta`; `tipo_cuenta`<select>[3: -- Seleccionar --, CA=Cuenta de Ahorros, CC=Cuenta Corriente]; `ref_archivo_cobro`<textarea>; `autorizacion_template-autorizacion`; `autorizacion_template-tipo_documento`<select>[2: VEN=Venta, RET=Retención]; `autorizacion_template-serie_inicio`; `autorizacion_template-serie_fin`; `autorizacion_template-fecha_inicio`; `autorizacion_template-fecha_fin`; `departamento`<hidden>; `fecha_nacimiento_rrhh`; `cargo`<hidden>; `tipo_contrato_rrhh`<select>[8: CA=Indefinido, CT=Temporal, OC=Obra Cierta, TP=Tarea Período, SO=Servicios Ocasionales, LO=LOSEP, EE=Especial Emergente, EM=Emprendimiento]; `grupo_pago`<select>[4: A=Administrativo, V=Ventas, C=Costos, O=Otros]; `tipo_pago`<select>[4: B=Cheque, T=Transferencia, N=Pendiente, V=Ventanilla]; `nota`; `discapacidad`<checkbox>; `porcent_discapacidad`; `genero`<select>[2: M=Masculino, F=Femenino]; `edad`; `cuenta_por_pagar_rrhh`<hidden>; `entradasalidaempresa_template-fecha_entrada`; `entradasalidaempresa_template-fecha_salida`; `entradasalidaempresa_template-tipo`<hidden>; `entradasalidaempresa_template-archivo_acta_finiquito`<file>; `rrhh_tipo_rol`<select>[2: RPM=Mensual, RPQ=Quincenal]; `porcentaje_quincena`; `acumular_fondosreserva`<radio>; `acumular_fondosreserva`<radio>; `acumular_fondosreserva`<radio>; `acumular_fondosreserva`<radio>; `acumular_decimos`<checkbox>; `extension_conyugal`<checkbox>; `horas_reduccion_jornada`; `entradasalidaministeriolab_template-fecha_entrada`; `entradasalidaministeriolab_template-fecha_salida`; `entradasalidaministeriolab_template-tipo`<hidden>; `entradasalidaiess_template-fecha_entrada`; `entradasalidaiess_template-fecha_salida`; `entradasalidaiess_template-tipo`<hidden>; `vacacion_template-fecha_salida`; `vacacion_template-fecha_entrada`; `vacacion_template-dias_tomados`; `codigo_iess`; `cargas_personales`; `archivo_contrato`<file>; `archivo_cv`<file>; `archivo_cedula`<file>; `archivo_record`<file>; `archivo_acumulacion_decimos`<file>; `archivo_otros_zip`<file>; `ingreso_template-id`<hidden>; `ingreso_template-tipo`<select>[7: S=SUELDO, A=ALIMENTACION, T=TRANSPORTE, V=VIVIENDA, C=COMISIONES, H=HORAS EXTRA, O=OTROS]; `ingreso_template-valor_mensual`; `ingreso_template-valor_dia`; `ingreso_template-nombre`; `ingreso_template-es_deducible`<checkbox>; `ingreso_template-para_rol`<checkbox>; `centrocostoproyecto_template-centro_costo`<hidden>; `centrocostoproyecto_template-porcentaje`; `contrato_template-fecha_ini`; `contrato_template-fecha_fin`; `contrato_template-archivo_contrato`<file>; `inicial_1-codigo`<hidden>; `inicial_1-rubro`; `inicial_1-valor`; `inicial_2-codigo`<hidden>; `inicial_2-rubro`; `inicial_2-valor`; `inicial_3-codigo`<hidden>; `inicial_3-rubro`; `inicial_3-valor`; `inicial_4-codigo`<hidden>; `inicial_4-rubro`; `inicial_4-valor`; `inicial_5-codigo`<hidden>; `inicial_5-rubro`; `inicial_5-valor`; `inicial_6-codigo`<hidden>; `inicial_6-rubro`; `inicial_6-valor`; `inicial_7-codigo`<hidden>; `inicial_7-rubro`; `inicial_7-valor`; `inicial_8-codigo`<hidden>; `inicial_8-rubro`; `inicial_8-valor`; `evento_template-fecha`; `evento_template-nombre`; `evento_template-observaciones`<textarea>
- Tabla:  | Autorización | Tipo Comp. | Serie Inicio | Serie Fin | Fecha Inicio | Fecha Fin
- Tabla:  | Entrada | Salida | Acta de Finiquito | Liquidación
- Tabla:  | Entrada | Salida
- Tabla:  | Entrada | Salida

### POS

#### `pos/consultar_pos/` — Pos Registrados
Secciones: Pos Registrados
- Tabla: Establecimiento | Emisión | Bodega Asociada | Direccion Pos

#### `pos/importar_ventas/` — Importación de Ventas
Secciones: Importación de Ventas
- Form `(sin id)` POST: `file_ventas`<file>

#### `pos/xml/` — Generar Archivos XML
Secciones: Generar Archivos XML · Datos Generales
- Form `(sin id)` POST: `tipo_archivo`<select>[2: productos=Productos, personas=Personas]

### Transacciones (registro)

#### `registro/deposito/` — Consultar Depósitos
Secciones: Consultar Depósitos · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `cliente`<hidden>; `fecha_inicio`; `pos`<hidden>; `fecha_fin`; `transaccion2`; `comprobante2`
- Tabla: Emisión | Comprobante | Banco | Valor | Acciones

#### `registro/deposito/registrar/` — Registrar Depósito
Secciones: Registrar Depósito · Información del Depósito
- Form `deposito_form` POST: `id`<hidden>; `hidden_filtro_caja`<hidden>; `fecha_corte`; `pos`<hidden>; `caja`<hidden>; `fecha`; `cuenta_banco`<hidden>; `numero_comprobante`; `descripcion`<textarea>; `filtro_caja`<select>[15: Todos, 9830122=Caja, 10809454=Caja Punto de venta, 10809456=Caja Punto de venta, 10809457=Caja Punto de venta, 10809459=Caja Punto de venta, 11059621=Caja Punto de venta, 14452547=Caja Punto de venta, …]
- Tabla:  | Transacción | Persona | Caja | F. Emisión | F. Cheque | Valor
- Tabla:  | Empleado | Descripcion | Caja | F. Emision | Valor

#### `registro/documento/` — Consultar documentos
Secciones: Consultar documentos · Actualizar estado · Búsqueda · Agrupar Documentos · Importar Documentos · Firmar Documento · Autorización de documentos · Anular Documento
- Form `docForm` GET · exports: excel, excel_por_producto, pdf: `pagina`<hidden>; `pago_masivo_id`<hidden>; `hdn_seleccionar`<hidden>; `de`<hidden>; `cash_management`<hidden>; `param_cash_management_cobro`<hidden>; `fecha_consumo_tc`<hidden>; `param_formato_cobro_bco`<hidden>; `param_forma_cobro`<hidden>; `numero_documento`; `fecha_inicio`; `persona`<hidden>; `persona_id`<hidden>; `fecha_fin`; `tipo_documento`<select>[26: Todos, FAC=Factura, NVE=Nota de Venta, LQC=Liquidación de Compra, LQR=Liquidación de Compra po, LMU=Liquidación de Compra de, EIF=Documentos Emitidos por , IMP=Documentos de Importació, …]; `tipo`<select>[3: Todos, CLI=Cliente, PRO=Proveedor]; `estado`<select>[5: Todos, P=Pendiente, A=Anulado, C=Cobrado, G=Pagado]; `vencimiento`<select>[3: Todos, PV=Por Vencer, VE=Vencido]; `emision`<select>[3: Todos, FI=Fisica, EL=Electronica]; `estado_electronico`<select>[3: Todos, FIN=Finalizado, PEN=Pendiente]; `ordencompraventa`<hidden>; `ordencompraventa_id`<hidden>; `codigo_sustento`<select>[9: Todos, 02=Costo o Gasto Bienes y Se, 05=Gastos de Empleados (Cod., 07=Costo o Gasto Inventario , 08=Reembolso de Gastos por i, 09=Reembolso por siniestros , 10=Distribución de Dividendo, 14=Facturación por socios a , …]; `caja_id`<hidden>; `caja`<hidden>; `centro_costo`<hidden>; `centro_costo_id`<hidden>; `referencia`; `vendedor_id`<select>[30: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `vendedor`<hidden>; `campo_adicional_1`; `proyecto_id`<hidden>; `proyecto`<hidden>; `importacion_id`<hidden>; `importacion`<hidden>; `numero_documento_retencion`; `producto_id`<hidden>; `producto`<hidden>; `serie`; `bodega`<hidden>; `bodega_id`<hidden>; `categoria_persona`<hidden>; `categoria_persona_id`<hidden>
- Form `(fuera de form)` : `chk_todosElectronicos`<checkbox>; `doc_eliminar[]`<checkbox>
- Form `agrupaForm` POST → /sistema/registro/agrupar_documentos/: `persona_agrupar`<hidden>; `tipo_documento`<select>[4: FAC=Factura, FEL=Factura Electrónica, NVE=Nota de Venta, DNA=Documento no autorizado]; `tipo_registro_documento`<hidden>
- Form `frm_firmar` POST: `password`<password>; `accion`<hidden>
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `form_anular` POST: `accion`<hidden>
- Tabla:  |  | Emisión | Persona | Documento |  |  |  |  | Neto | Imp. | Total | Ret. | Saldo | Acciones

#### `registro/documento_anulado/` — Consultar Documentos Anulados
Secciones: Consultar Documentos Anulados · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `numero_documento`; `fecha_inicio`; `autorizacion`; `fecha_fin`; `tipo_documento`<select>[17: Todos, FAC=Factura, RET=Retención, NVE=Nota de Venta, LQC=Liquidación de Compra, LQR=Liquidación de Compra, LMU=Liquidación de Compra de, NDT=Nota de Débito, …]
- Tabla:  | Fecha Anulación | Tipo de Documento | # Documento | Autorización

#### `registro/documento/?emision=FI` — Consultar documentos
Secciones: Consultar documentos · Actualizar estado · Búsqueda · Agrupar Documentos · Importar Documentos · Firmar Documento · Autorización de documentos · Anular Documento
- Form `docForm` GET · exports: excel, excel_por_producto, pdf: `pagina`<hidden>; `pago_masivo_id`<hidden>; `hdn_seleccionar`<hidden>; `de`<hidden>; `cash_management`<hidden>; `param_cash_management_cobro`<hidden>; `fecha_consumo_tc`<hidden>; `param_formato_cobro_bco`<hidden>; `param_forma_cobro`<hidden>; `numero_documento`; `fecha_inicio`; `persona`<hidden>; `persona_id`<hidden>; `fecha_fin`; `tipo_documento`<select>[26: Todos, FAC=Factura, NVE=Nota de Venta, LQC=Liquidación de Compra, LQR=Liquidación de Compra po, LMU=Liquidación de Compra de, EIF=Documentos Emitidos por , IMP=Documentos de Importació, …]; `tipo`<select>[3: Todos, CLI=Cliente, PRO=Proveedor]; `estado`<select>[5: Todos, P=Pendiente, A=Anulado, C=Cobrado, G=Pagado]; `vencimiento`<select>[3: Todos, PV=Por Vencer, VE=Vencido]; `emision`<select>[3: Todos, FI=Fisica, EL=Electronica]; `estado_electronico`<select>[3: Todos, FIN=Finalizado, PEN=Pendiente]; `ordencompraventa`<hidden>; `ordencompraventa_id`<hidden>; `codigo_sustento`<select>[9: Todos, 02=Costo o Gasto Bienes y Se, 05=Gastos de Empleados (Cod., 07=Costo o Gasto Inventario , 08=Reembolso de Gastos por i, 09=Reembolso por siniestros , 10=Distribución de Dividendo, 14=Facturación por socios a , …]; `caja_id`<hidden>; `caja`<hidden>; `centro_costo`<hidden>; `centro_costo_id`<hidden>; `referencia`; `vendedor_id`<select>[30: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `vendedor`<hidden>; `campo_adicional_1`; `proyecto_id`<hidden>; `proyecto`<hidden>; `importacion_id`<hidden>; `importacion`<hidden>; `numero_documento_retencion`; `producto_id`<hidden>; `producto`<hidden>; `serie`; `bodega`<hidden>; `bodega_id`<hidden>; `categoria_persona`<hidden>; `categoria_persona_id`<hidden>
- Form `(fuera de form)` : `chk_todosElectronicos`<checkbox>; `doc_eliminar[]`<checkbox>
- Form `agrupaForm` POST → /sistema/registro/agrupar_documentos/: `persona_agrupar`<hidden>; `tipo_documento`<select>[4: FAC=Factura, FEL=Factura Electrónica, NVE=Nota de Venta, DNA=Documento no autorizado]; `tipo_registro_documento`<hidden>
- Form `frm_firmar` POST: `password`<password>; `accion`<hidden>
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `form_anular` POST: `accion`<hidden>
- Tabla:  |  | Emisión | Persona | Documento |  |  |  |  | Neto | Imp. | Total | Ret. | Saldo | Acciones

#### `registro/documento/guiaremision/` — Consultar Guias de Remisión
Secciones: Consultar Guias de Remisión · Firmar Documento · Autorización de documentos · Búsqueda · Seleccione Destinatario
- Form `frm_firmar` POST: `password`<password>; `accion`<hidden>
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `numero_documento`; `fecha_inicio`; `destinatario`<hidden>; `destinatario_filter`<hidden>; `fecha_fin`; `transportista`<hidden>; `transportista_filter`<hidden>; `bodega`<hidden>; `bodega_filter`<hidden>; `documento`<hidden>; `documento_filter`<hidden>; `facturado`<select>[3: -, 1=Si, 0=No]; `producto`<hidden>; `producto_filter`<hidden>
- Form `(sin id)` POST → /sistema/registro/documento/guiaremision/agrupar_guias/: `persona_agrupar`<hidden>; `tipo_registro_documento`<hidden>
- Tabla:  | Fecha | Número | Destinatario | Documento |  |  |  |  | Transportista | Acciones

#### `registro/documento/guiaremision/registrar/` — Registrar Guía de Remisión
Secciones: Registrar Guía de Remisión · Firmar Documento · Autorización de documentos · Información · Información del Documento
- Form `frm_firmar` POST → /sistema/registro/documento/firmar/: `desde_retencion`<hidden>; `receptor`
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `(sin id)` POST: `id`<hidden>; `fecha_emision`; `electronico`<checkbox>; `anulado`<checkbox>; `establecimiento`<select>[1: 001]; `punto_emision`; `numero_documento`; `autorizacion`; `transportista`<hidden>; `placa`; `fecha_inicio`; `fecha_fin`; `bodega`<hidden>; `direccion_partida`; `descripcion`<textarea>; `generar_traslado`<checkbox>; `bodega_destino`<hidden>; `ordencompraventa`<hidden>; `persona`<hidden>; `documento`<hidden>; `direccion`; `motivo`; `ruta`; `codigo_destino`; `producto_template-cantidad`; `producto_template-producto`<hidden>; `producto_template-lotefield`<hidden>; `producto_template-serie`; `producto_template-lote`<hidden>; `producto_template-fecha_expiracion`<hidden>
- Tabla:  | Cantidad | Producto | Unidad

#### `registro/documento/proforma/1/` — Consultar Proformas
Secciones: Consultar Proformas · Búsqueda · Agrupar Prefacturas. · Agrupar Presupuestos. · Generar documentos
- Form `excelForm` POST → /sistema/registro/comisiones/excel_resumen/: `error_list`<hidden>
- Form `(sin id)` GET · exports: excel, excel_por_producto, pdf: `pagina`<hidden>; `excel_ocv`<hidden>; `excel_pto`<hidden>; `hdn_seleccionar`<hidden>; `proforma`<hidden>; `de`<hidden>; `cash_management`<hidden>; `numero_documento`; `fecha_inicio`; `persona`<hidden>; `fecha_fin`; `producto_id`<hidden>; `tipo`<select>[3: Todos, CLI=Cliente, PRO=Proveedor]; `bodega`<hidden>; `proyecto_id`<hidden>; `centro_costo`<hidden>; `tipo_documento`<select>[4: Todos, COT=Cotización, PRE=Prefactura, OCV=Orden Compra/Contrato]; `vendedor_id`<select>[30: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `campo_adicional_doc1`; `estado`<select>[7: Todos, P=Pendiente, R=Aprobado, F=Facturado, E=Generado, Z=Finalizado, A=Anulado]; `vencimiento`<select>[3: Todos, PV=Por Vencer, VE=Vencido]
- Form `agrupaForm` POST → /sistema/registro/agrupar_proformas/: `persona_agrupar`<hidden>; `proformas_agrupar`<hidden>; `proforma`<hidden>
- Form `agrupaPresupuestoForm` POST → /sistema/registro/agrupar_presupuestos/: `persona_agrupar_presupuesto`<hidden>; `presupuestos_agrupar`<hidden>; `presupuesto`<hidden>
- Tabla: Emisión | Persona | Documento | Neto | Imp. | Total | Facturado | Pendiente | Acciones

#### `registro/documento/?proforma=1&tipo_documento=PRE` — Consultar Proformas
Secciones: Consultar Proformas · Búsqueda · Agrupar Prefacturas. · Agrupar Presupuestos. · Generar documentos
- Form `excelForm` POST → /sistema/registro/comisiones/excel_resumen/: `error_list`<hidden>
- Form `(sin id)` GET · exports: excel, excel_por_producto, pdf: `pagina`<hidden>; `excel_ocv`<hidden>; `excel_pto`<hidden>; `hdn_seleccionar`<hidden>; `proforma`<hidden>; `de`<hidden>; `cash_management`<hidden>; `numero_documento`; `fecha_inicio`; `persona`<hidden>; `fecha_fin`; `producto_id`<hidden>; `tipo`<select>[3: Todos, CLI=Cliente, PRO=Proveedor]; `bodega`<hidden>; `proyecto_id`<hidden>; `centro_costo`<hidden>; `tipo_documento`<select>[4: Todos, COT=Cotización, PRE=Prefactura, OCV=Orden Compra/Contrato]; `vendedor_id`<select>[30: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `campo_adicional_doc1`; `estado`<select>[7: Todos, P=Pendiente, R=Aprobado, F=Facturado, E=Generado, Z=Finalizado, A=Anulado]; `vencimiento`<select>[3: Todos, PV=Por Vencer, VE=Vencido]
- Form `agrupaForm` POST → /sistema/registro/agrupar_proformas/: `persona_agrupar`<hidden>; `proformas_agrupar`<hidden>; `proforma`<hidden>
- Form `agrupaPresupuestoForm` POST → /sistema/registro/agrupar_presupuestos/: `persona_agrupar_presupuesto`<hidden>; `presupuestos_agrupar`<hidden>; `presupuesto`<hidden>
- Tabla: Emisión | Persona | Documento | Neto | Imp. | Total | Facturado | Pendiente | Acciones

#### `registro/documento/registrar/` — Registrar Documento
Secciones: Registrar Documento · Cargando documento... · Documentos Agrupados · Documentos Adjuntos · Agregar Descuentos · Seleccionar Tarifa IVA · Agregar Color por Item · ¡Atención!
- Form `(fuera de form)` : `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>
- Form `(sin id)` POST: `tiene_cuotas_cobradas_pagadas`<hidden>; `es_cuentaservice`<hidden>; `id`<hidden>; `prefactura_rel_id`<hidden>; `electronico`<hidden>; `cotizacion`<hidden>; `pvp_default`<hidden>; `excluir_secuencia_retencion`<hidden>; `guardar_enviar_sri`<hidden>; `guardar_enviar_sri_retencion`<hidden>; `es_agrupar`<hidden>; `duplicar`<hidden>; `persona_maneja_pvpmanual`<hidden>; `confirma_registro_detalle`<hidden>; `fecha_emision`; `aplica_iva_12`<checkbox>; `porcentaje_iva`<select>[1: ]; `valor_iva_porcentaje`<hidden>; `tipo_registro_documento`<select>[2: CLI=Cliente, PRO=Proveedor]; `tipo_documento`<select>[20: FAC=Factura, NVE=Nota de Venta, LQC=Liquidación de Compra, LMU=Liquidación de Compra de, DNA=Documento no autorizado , DAC=Comprobante de Anticipo , EIF=Documentos Emitidos por , NDT=Nota de Débito, …]; `numero_documento`; `autorizacion`; ``<select>; `persona_id`<hidden>; `documento_relacionado_id`<hidden>; `referencia`; `vendedor_id`<select>[26: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `propina`; `vencimiento`; `notificar_vencimiento`<checkbox>; `entregado`<checkbox>; `ordencompraventa`<hidden>; `movimientoProductos_id`<hidden>; `bodega_id`<hidden>; `centro_costo_bodega_default_id`<hidden>; `sin_movimiento`<checkbox>; `tipo_retencion_ir_id`<hidden>; `tipo_retencion_iva_id`<hidden>; `producto_template-cantidad`; `producto_template-producto_id`<hidden>; `producto_template-hidden_data_producto`<hidden>; `producto_template-serie_compra`; `producto_template-serie_venta`; `producto_template-nombre_manual`<textarea>; `producto_template-edicion`; `producto_template-color_id`<hidden>; `producto_template-lote`; `producto_template-fecha_expiracion`; `producto_template-lotefield`<hidden>; `producto_template-centro_costo_id`<hidden>; `producto_template-hidden_data_centro_costo`<hidden>; `producto_template-unidad`<select>; `producto_template-hidden_unidad`<hidden>; `producto_template-precio_compra`; `producto_template-precio_venta`<select>; `producto_template-precio_venta_manual`; `producto_template-hidden_precio_venta`<hidden>; `producto_template-hidden_precio_vendido`<hidden>; `producto_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, No objeto]; `producto_template-tipo_retencion_ir_id`<hidden>; `producto_template-tipo_retencion_iva_id`<hidden>; `producto_template-porcentaje_descuento`; `producto_template-descuento`; `producto_template-subtotal`; `producto_template-base_cero`<hidden>; `producto_template-base_gravable`<hidden>; `producto_template-base_no_gravable`<hidden>; `producto_template-porcentaje_ice`<hidden>; `producto_template-valor_ice`<hidden>; `producto_template-ice`<hidden>; `producto_template-hidden_maneja_serie`<hidden>; `producto_template-hidden_maneja_pvpmanual`<hidden>; `producto_template-hidden_porcentaje_iva_producto`<hidden>; `producto_template-tipo_producto_medical`<hidden>; `producto_template-peso`<hidden>; `producto_template-volumen`<hidden>; `producto_template-proyecto_id`<hidden>; `proyecto_id`<hidden>; `centro_costo_cuenta_id`<hidden>; `proyecto_template-hidden_item`<hidden>; `proyecto_template-proyecto_id`<hidden>; `proyecto_template-centro_costo_id`<hidden>; `tipo_retencion_ir_cuentas_id`<hidden>; `tipo_retencion_iva_cuentas_id`<hidden>; `cuenta_template-cantidad`; `cuenta_template-cuenta_id`<hidden>; `cuenta_template-hidden_data_cuenta_id`<hidden>; `cuenta_template-centro_costo_id`<hidden>; `cuenta_template-hidden_data_centro_costo_id`<hidden>; `cuenta_template-valor`; `cuenta_template-porcentaje_iva`<select>[7: 12=12%, 5=5%, 14=14%, 8=8%, 15=15%, 0=0%, No objeto]; `cuenta_template-porcentaje_ice`; `cuenta_template-ice`<hidden>; `cuenta_template-tipo_retencion_ir_id`<hidden>; `cuenta_template-tipo_retencion_iva_id`<hidden>; `cuenta_template-porcentaje_descuento`; `cuenta_template-descuento`; `cuenta_template-subtotal`; `cuenta_template-base_cero`<hidden>; `cuenta_template-base_gravable`<hidden>; `cuenta_template-base_no_gravable`<hidden>; `cuenta_template-proyecto_id`<hidden>; `docreembolso_template-documento_id`<hidden>; `docreembolsoproveedor_template-tipo_proveedor`<select>[3: C=Cédula, R=RUC, P=Pasaporte]; `docreembolsoproveedor_template-identificacion`; `docreembolsoproveedor_template-tipo_documento_ced`<select>[10: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 09=TIQUETES O VALES EMITIDOS, 08=BOLETOS O ENTRADAS A ESPE, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, 48=NOTAS DE DEBITO POR REEMB, …]; `docreembolsoproveedor_template-tipo_documento_ruc`<select>[17: 01=FACTURA, 02=NOTA DE VENTA, 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 11=PASAJES EMITIDOS POR EMPR, 12=DOCUMENTOS EMITIDOS POR I, …]; `docreembolsoproveedor_template-tipo_documento_pas`<select>[11: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 15=COMPROBANTES DE VENTA EMI, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, …]; `docreembolsoproveedor_template-numero_documento`; `docreembolsoproveedor_template-autorizacion`; `docreembolsoproveedor_template-fecha_emision`; `docreembolsoproveedor_template-base_0`; `docreembolsoproveedor_template-base_iva`; `docreembolsoproveedor_template-base_iva_5`; `docreembolsoproveedor_template-base_no_objeto`; `docreembolsoproveedor_template-base_exento`; `docreembolsoproveedor_template-iva`; `docreembolsoproveedor_template-iva_5`; `docreembolsoproveedor_template-ice`; `docreembolsoproveedor_template-total`; `fecha_emision_retencion`; `fecha_periodo_fiscal_day`<select>[32: ---, 1, 2, 3, 4, 5, 6, 7, …]; `fecha_periodo_fiscal_month`<select>[13: ---, 1=enero, 2=febrero, 3=marzo, 4=abril, 5=mayo, 6=junio, 7=julio, …]; `fecha_periodo_fiscal_year`<select>[3: ---, 2026, 2025]; `tipo_retencion`<select>[2: F=Física, E=Electrónica]; `numero_documento_retencion`; `autorizacion_retencion`; ``<select>; `anio_utilidades`; `monto_pagado_ir`; `retencion_fraccion_basica`; `ingreso_gravado_fraccion_basica`; `regimen_retencion`<select>[4: Elige una opción, 01=Régimen General, 02=Paraíso Fiscal, 03=Régimen Fiscal Preferente]; `pais_pago_realizar_pf`<select>[60: Elige una opción, 1=ANGUILA (Territorio no aut, 2=ANTIGUA Y BARBUDA (Estado , 3=ARCHIPIÉLAGO DE SVALBARD, 4=ARUBA, 5=BARBADOS (Estado independi, 6=BELICE (Estado independien, 7=BERMUDAS (Territorio no au, …]; `pais_pago_realizar_rg`<select>[60: Elige una opción, 16=AMERICAN SAMOA, 52=PRINCIPADO DEL VALLE DE A, 74=BOUVET ISLAND, 101=ARGENTINA, 102=BOLIVIA, 103=BRASIL, 104=CANADA, …]; `denominacion_regimen_preferente`; `pais_pago_efectuar_pf`<select>[60: Elige una opción, 1=ANGUILA, 2=ANTIGUA Y BARBUDA, 3=NORUEGA, 4=ARUBA, 5=BARBADOS, 6=BELICE, 7=BERMUDA, …]; `pais_pago_efectuar_rg`<select>[60: Elige una opción, 16=AMERICAN SAMOA, 52=PRINCIPADO DEL VALLE DE A, 74=BOUVET ISLAND, 101=ARGENTINA, 102=BOLIVIA, 103=BRASIL, 104=CANADA, …]; `pais_pago_efectuar_rg`<hidden>; `pais_pago_efectuar_rp`<select>[60: Elige una opción, 16=AMERICAN SAMOA, 52=PRINCIPADO DEL VALLE DE A, 74=BOUVET ISLAND, 101=ARGENTINA, 102=BOLIVIA, 103=BRASIL, 104=CANADA, …]; `establecimiento_retencion`<select>[1: 001]; `punto_emision_retencion`; `doble_tributacion`<radio>; `doble_tributacion`<radio>; `pago_sujeto_retencion`<radio>; `pago_sujeto_retencion`<radio>; `retencion_iva_template-gasto`<checkbox>; `retencion_iva_template-retencion_id`<hidden>; `retencion_iva_template-tipo_documento_reembolso`<select>[3: ---, 01=Factura, 03=Liquidacion de Compra]; `retencion_iva_template-tipo`<hidden>; `retencion_iva_template-codigo_sri`; `retencion_iva_template-base`; `retencion_iva_template-porcentaje`; `retencion_iva_template-valor`; `retencion_template-gasto`<checkbox>; `retencion_template-retencion_id`<hidden>; `retencion_template-tipo_documento_reembolso`<select>[3: ---, 01=Factura, 03=Liquidacion de Compra]; `retencion_template-tipo`<hidden>; `retencion_template-codigo_sri`; `retencion_template-base`; `retencion_template-porcentaje`; `retencion_template-valor`; `activofijo_template-nombre`; `activofijo_template-activofijo`<hidden>; `activofijo_template-categoriaactivo`<hidden>; `activofijo_template-tipoactivo`<hidden>; `activofijo_template-codigo`; `activofijo_template-porcentaje_depreciacion`<select>[4: 5.00=5%, 10.00=10%, 20.00=20%, 33.00=33%]; `activofijo_template-fecha_registro`; `activofijo_template-valor_inicial`; `activofijo_template-valor_actual`; `activofijo_template-fecha_inicio_depreciacion`; `activofijo_template-precio`; `activofijo_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, NO]; `activofijo_template-subtotal`; `activofijo_template-tipo_retencion_ir_id`<hidden>; `activofijo_template-tipo_retencion_iva_id`<hidden>; `activofijo_template-ubicacion`<hidden>; `activofijo_template-ubicacion_label`; `activofijo_template-centro_costo`<hidden>; `pago_template-forma_pago`<select>[8: 20=Otros con Utilización del, 01=Sin utilización del Siste, 15=Compensación de Deudas, 16=Tarjeta de débito, 17=Dinero Electrónico, 18=Tarjeta Prepago, 19=Tarjeta de crédito, 21=Endoso de títulos]; `pago_template-plazo`; `pago_template-unidad`<select>[2: días, meses]; `pago_template-valor`; `descripcion`<textarea>; `adicional1`; `adicional2`; `subtotal_iva`; `subtotal_iva_5`; `subtotal_0`; `descuento`; `iva`; `iva_calculado`<hidden>; `iva_5`; `iva_5_calculado`<hidden>; `ice`; `total`; `pagado_caja_chica`<checkbox>; `cuenta_caja_chica`<hidden>; `producir`<hidden>; `aprobar`<hidden>
- Form `frm_firmar` POST → /sistema/registro/documento/firmar/: `desde_retencion`<hidden>; `receptor`
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `frm_enviar_proforma` POST → /sistema/registro/documento/enviar_proforma/: `documento_id`<hidden>; `receptorP`
- Tabla: Cant. | Producto | Centro Costo | Unidad | Precio U. | IVA | Ret. IR | Ret. IVA | Desc. | Desc. | Subtotal | 
- Tabla: Cant. | Producto/Cuenta | Subtotal | Proyecto | Centro Costo
- Tabla:  | Producto | Cant. | Precio U. | %Desc. | Subtotal
- Tabla: Cant. | Cuenta | Valor U. | IVA | % ICE | Ret. IR | Ret. IVA | % Desc. | Desc. | Subtotal | 

#### `registro/documento/registrar/?cotizacion=1` — Registrar Cotización
Secciones: Registrar Cotización · Cargando documento... · Documentos Agrupados · Documentos Adjuntos · Agregar Descuentos · Seleccionar Tarifa IVA · Agregar Color por Item · ¡Atención!
- Form `(fuera de form)` : `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>
- Form `(sin id)` POST: `tiene_cuotas_cobradas_pagadas`<hidden>; `es_cuentaservice`<hidden>; `id`<hidden>; `prefactura_rel_id`<hidden>; `electronico`<hidden>; `cotizacion`<hidden>; `pvp_default`<hidden>; `excluir_secuencia_retencion`<hidden>; `guardar_enviar_sri`<hidden>; `guardar_enviar_sri_retencion`<hidden>; `es_agrupar`<hidden>; `duplicar`<hidden>; `persona_maneja_pvpmanual`<hidden>; `confirma_registro_detalle`<hidden>; `fecha_emision`; `aplica_iva_12`<checkbox>; `porcentaje_iva`<select>[1: ]; `valor_iva_porcentaje`<hidden>; `tipo_registro_documento`<select>[2: CLI=Cliente, PRO=Proveedor]; `tipo_documento`<select>[1: COT=Cotización]; `numero_documento`; `autorizacion`; ``<select>; `persona_id`<hidden>; `documento_relacionado_id`<hidden>; `referencia`; `vendedor_id`<select>[26: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `propina`; `vencimiento`; `notificar_vencimiento`<checkbox>; `proyecto_proforma`; `forma_pago_proforma`; `atencion_proforma`; `garantia_proforma`; `entregado`<checkbox>; `ordencompraventa`<hidden>; `movimientoProductos_id`<hidden>; `bodega_id`<hidden>; `centro_costo_bodega_default_id`<hidden>; `sin_movimiento`<checkbox>; `tipo_retencion_ir_id`<hidden>; `tipo_retencion_iva_id`<hidden>; `producto_template-cantidad`; `producto_template-producto_id`<hidden>; `producto_template-hidden_data_producto`<hidden>; `producto_template-serie_compra`; `producto_template-serie_venta`; `producto_template-nombre_manual`<textarea>; `producto_template-edicion`; `producto_template-color_id`<hidden>; `producto_template-lote`; `producto_template-fecha_expiracion`; `producto_template-lotefield`<hidden>; `producto_template-centro_costo_id`<hidden>; `producto_template-hidden_data_centro_costo`<hidden>; `producto_template-unidad`<select>; `producto_template-hidden_unidad`<hidden>; `producto_template-precio_compra`; `producto_template-precio_venta`<select>; `producto_template-precio_venta_manual`; `producto_template-hidden_precio_venta`<hidden>; `producto_template-hidden_precio_vendido`<hidden>; `producto_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, No objeto]; `producto_template-tipo_retencion_ir_id`<hidden>; `producto_template-tipo_retencion_iva_id`<hidden>; `producto_template-porcentaje_descuento`; `producto_template-descuento`; `producto_template-subtotal`; `producto_template-base_cero`<hidden>; `producto_template-base_gravable`<hidden>; `producto_template-base_no_gravable`<hidden>; `producto_template-porcentaje_ice`<hidden>; `producto_template-valor_ice`<hidden>; `producto_template-ice`<hidden>; `producto_template-hidden_maneja_serie`<hidden>; `producto_template-hidden_maneja_pvpmanual`<hidden>; `producto_template-hidden_porcentaje_iva_producto`<hidden>; `producto_template-tipo_producto_medical`<hidden>; `producto_template-peso`<hidden>; `producto_template-volumen`<hidden>; `producto_template-proyecto_id`<hidden>; `proyecto_id`<hidden>; `centro_costo_cuenta_id`<hidden>; `proyecto_template-hidden_item`<hidden>; `proyecto_template-proyecto_id`<hidden>; `proyecto_template-centro_costo_id`<hidden>; `tipo_retencion_ir_cuentas_id`<hidden>; `tipo_retencion_iva_cuentas_id`<hidden>; `cuenta_template-cantidad`; `cuenta_template-cuenta_id`<hidden>; `cuenta_template-hidden_data_cuenta_id`<hidden>; `cuenta_template-centro_costo_id`<hidden>; `cuenta_template-hidden_data_centro_costo_id`<hidden>; `cuenta_template-valor`; `cuenta_template-porcentaje_iva`<select>[7: 12=12%, 15=15%, 8=8%, 5=5%, 14=14%, 0=0%, No objeto]; `cuenta_template-porcentaje_ice`; `cuenta_template-ice`<hidden>; `cuenta_template-tipo_retencion_ir_id`<hidden>; `cuenta_template-tipo_retencion_iva_id`<hidden>; `cuenta_template-porcentaje_descuento`; `cuenta_template-descuento`; `cuenta_template-subtotal`; `cuenta_template-base_cero`<hidden>; `cuenta_template-base_gravable`<hidden>; `cuenta_template-base_no_gravable`<hidden>; `cuenta_template-proyecto_id`<hidden>; `docreembolso_template-documento_id`<hidden>; `docreembolsoproveedor_template-tipo_proveedor`<select>[3: C=Cédula, R=RUC, P=Pasaporte]; `docreembolsoproveedor_template-identificacion`; `docreembolsoproveedor_template-tipo_documento_ced`<select>[10: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 09=TIQUETES O VALES EMITIDOS, 08=BOLETOS O ENTRADAS A ESPE, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, 48=NOTAS DE DEBITO POR REEMB, …]; `docreembolsoproveedor_template-tipo_documento_ruc`<select>[17: 01=FACTURA, 02=NOTA DE VENTA, 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 11=PASAJES EMITIDOS POR EMPR, 12=DOCUMENTOS EMITIDOS POR I, …]; `docreembolsoproveedor_template-tipo_documento_pas`<select>[11: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 15=COMPROBANTES DE VENTA EMI, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, …]; `docreembolsoproveedor_template-numero_documento`; `docreembolsoproveedor_template-autorizacion`; `docreembolsoproveedor_template-fecha_emision`; `docreembolsoproveedor_template-base_0`; `docreembolsoproveedor_template-base_iva`; `docreembolsoproveedor_template-base_iva_5`; `docreembolsoproveedor_template-base_no_objeto`; `docreembolsoproveedor_template-base_exento`; `docreembolsoproveedor_template-iva`; `docreembolsoproveedor_template-iva_5`; `docreembolsoproveedor_template-ice`; `docreembolsoproveedor_template-total`; `activofijo_template-nombre`; `activofijo_template-activofijo`<hidden>; `activofijo_template-categoriaactivo`<hidden>; `activofijo_template-tipoactivo`<hidden>; `activofijo_template-codigo`; `activofijo_template-porcentaje_depreciacion`<select>[4: 5.00=5%, 10.00=10%, 20.00=20%, 33.00=33%]; `activofijo_template-fecha_registro`; `activofijo_template-valor_inicial`; `activofijo_template-valor_actual`; `activofijo_template-fecha_inicio_depreciacion`; `activofijo_template-precio`; `activofijo_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, NO]; `activofijo_template-subtotal`; `activofijo_template-tipo_retencion_ir_id`<hidden>; `activofijo_template-tipo_retencion_iva_id`<hidden>; `activofijo_template-ubicacion`<hidden>; `activofijo_template-ubicacion_label`; `activofijo_template-centro_costo`<hidden>; `pago_template-forma_pago`<select>[8: 20=Otros con Utilización del, 01=Sin utilización del Siste, 15=Compensación de Deudas, 16=Tarjeta de débito, 17=Dinero Electrónico, 18=Tarjeta Prepago, 19=Tarjeta de crédito, 21=Endoso de títulos]; `pago_template-plazo`; `pago_template-unidad`<select>[2: días, meses]; `pago_template-valor`; `descripcion`<textarea>; `adicional1`; `adicional2`; `subtotal_iva`; `subtotal_iva_5`; `subtotal_0`; `descuento`; `iva`; `iva_calculado`<hidden>; `iva_5`; `iva_5_calculado`<hidden>; `ice`; `total`; `pagado_caja_chica`<checkbox>; `cuenta_caja_chica`<hidden>; `producir`<hidden>; `aprobar`<hidden>
- Form `frm_firmar` POST → /sistema/registro/documento/firmar/: `desde_retencion`<hidden>; `receptor`
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `frm_enviar_proforma` POST → /sistema/registro/documento/enviar_proforma/: `documento_id`<hidden>; `receptorP`
- Tabla: Cant. | Producto | Centro Costo | Unidad | Precio U. | IVA | Ret. IR | Ret. IVA | Desc. | Desc. | Subtotal | 
- Tabla: Cant. | Producto/Cuenta | Subtotal | Proyecto | Centro Costo
- Tabla:  | Producto | Cant. | Precio U. | %Desc. | Subtotal
- Tabla: Cant. | Cuenta | Valor U. | IVA | % ICE | Ret. IR | Ret. IVA | % Desc. | Desc. | Subtotal | 

#### `registro/documento/registrar/?de=1` — Registrar Documento Electrónico
Secciones: Registrar Documento Electrónico · Cargando documento... · Documentos Agrupados · Documentos Adjuntos · Agregar Descuentos · Seleccionar Tarifa IVA · Agregar Color por Item · ¡Atención!
- Form `(fuera de form)` : `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>
- Form `(sin id)` POST: `tiene_cuotas_cobradas_pagadas`<hidden>; `es_cuentaservice`<hidden>; `id`<hidden>; `prefactura_rel_id`<hidden>; `electronico`<hidden>; `cotizacion`<hidden>; `pvp_default`<hidden>; `excluir_secuencia_retencion`<hidden>; `guardar_enviar_sri`<hidden>; `guardar_enviar_sri_retencion`<hidden>; `es_agrupar`<hidden>; `duplicar`<hidden>; `persona_maneja_pvpmanual`<hidden>; `confirma_registro_detalle`<hidden>; `fecha_emision`; `aplica_iva_12`<checkbox>; `porcentaje_iva`<select>[1: ]; `valor_iva_porcentaje`<hidden>; `tipo_registro_documento`<select>[2: CLI=Cliente, PRO=Proveedor]; `tipo_documento`<select>[6: FAC=Factura, NDT=Nota de Débito, NCT=Nota de Crédito, REE=Comprobante de venta emi, LQC=Liquidación de Compra, LQR=Liquidación de Compra po]; `establecimiento`<select>[1: 001]; `punto_emision`; `numero_documento`; `autorizacion`; ``<select>; `persona_id`<hidden>; `documento_relacionado_id`<hidden>; `referencia`; `vendedor_id`<select>[26: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `propina`; `vencimiento`; `notificar_vencimiento`<checkbox>; `entregado`<checkbox>; `ordencompraventa`<hidden>; `movimientoProductos_id`<hidden>; `bodega_id`<hidden>; `centro_costo_bodega_default_id`<hidden>; `sin_movimiento`<checkbox>; `tipo_retencion_ir_id`<hidden>; `tipo_retencion_iva_id`<hidden>; `producto_template-cantidad`; `producto_template-producto_id`<hidden>; `producto_template-hidden_data_producto`<hidden>; `producto_template-serie_compra`; `producto_template-serie_venta`; `producto_template-nombre_manual`<textarea>; `producto_template-edicion`; `producto_template-color_id`<hidden>; `producto_template-lote`; `producto_template-fecha_expiracion`; `producto_template-lotefield`<hidden>; `producto_template-centro_costo_id`<hidden>; `producto_template-hidden_data_centro_costo`<hidden>; `producto_template-unidad`<select>; `producto_template-hidden_unidad`<hidden>; `producto_template-precio_compra`; `producto_template-precio_venta`<select>; `producto_template-precio_venta_manual`; `producto_template-hidden_precio_venta`<hidden>; `producto_template-hidden_precio_vendido`<hidden>; `producto_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, No objeto]; `producto_template-tipo_retencion_ir_id`<hidden>; `producto_template-tipo_retencion_iva_id`<hidden>; `producto_template-porcentaje_descuento`; `producto_template-descuento`; `producto_template-subtotal`; `producto_template-base_cero`<hidden>; `producto_template-base_gravable`<hidden>; `producto_template-base_no_gravable`<hidden>; `producto_template-porcentaje_ice`<hidden>; `producto_template-valor_ice`<hidden>; `producto_template-ice`<hidden>; `producto_template-hidden_maneja_serie`<hidden>; `producto_template-hidden_maneja_pvpmanual`<hidden>; `producto_template-hidden_porcentaje_iva_producto`<hidden>; `producto_template-tipo_producto_medical`<hidden>; `producto_template-peso`<hidden>; `producto_template-volumen`<hidden>; `producto_template-proyecto_id`<hidden>; `proyecto_id`<hidden>; `centro_costo_cuenta_id`<hidden>; `proyecto_template-hidden_item`<hidden>; `proyecto_template-proyecto_id`<hidden>; `proyecto_template-centro_costo_id`<hidden>; `tipo_retencion_ir_cuentas_id`<hidden>; `tipo_retencion_iva_cuentas_id`<hidden>; `cuenta_template-cantidad`; `cuenta_template-cuenta_id`<hidden>; `cuenta_template-hidden_data_cuenta_id`<hidden>; `cuenta_template-centro_costo_id`<hidden>; `cuenta_template-hidden_data_centro_costo_id`<hidden>; `cuenta_template-valor`; `cuenta_template-porcentaje_iva`<select>[7: 12=12%, 5=5%, 14=14%, 15=15%, 8=8%, 0=0%, No objeto]; `cuenta_template-porcentaje_ice`; `cuenta_template-ice`<hidden>; `cuenta_template-tipo_retencion_ir_id`<hidden>; `cuenta_template-tipo_retencion_iva_id`<hidden>; `cuenta_template-porcentaje_descuento`; `cuenta_template-descuento`; `cuenta_template-subtotal`; `cuenta_template-base_cero`<hidden>; `cuenta_template-base_gravable`<hidden>; `cuenta_template-base_no_gravable`<hidden>; `cuenta_template-proyecto_id`<hidden>; `docreembolso_template-documento_id`<hidden>; `docreembolsoproveedor_template-tipo_proveedor`<select>[3: C=Cédula, R=RUC, P=Pasaporte]; `docreembolsoproveedor_template-identificacion`; `docreembolsoproveedor_template-tipo_documento_ced`<select>[10: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 09=TIQUETES O VALES EMITIDOS, 08=BOLETOS O ENTRADAS A ESPE, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, 48=NOTAS DE DEBITO POR REEMB, …]; `docreembolsoproveedor_template-tipo_documento_ruc`<select>[17: 01=FACTURA, 02=NOTA DE VENTA, 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 11=PASAJES EMITIDOS POR EMPR, 12=DOCUMENTOS EMITIDOS POR I, …]; `docreembolsoproveedor_template-tipo_documento_pas`<select>[11: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 15=COMPROBANTES DE VENTA EMI, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, …]; `docreembolsoproveedor_template-numero_documento`; `docreembolsoproveedor_template-autorizacion`; `docreembolsoproveedor_template-fecha_emision`; `docreembolsoproveedor_template-base_0`; `docreembolsoproveedor_template-base_iva`; `docreembolsoproveedor_template-base_iva_5`; `docreembolsoproveedor_template-base_no_objeto`; `docreembolsoproveedor_template-base_exento`; `docreembolsoproveedor_template-iva`; `docreembolsoproveedor_template-iva_5`; `docreembolsoproveedor_template-ice`; `docreembolsoproveedor_template-total`; `fecha_emision_retencion`; `fecha_periodo_fiscal_day`<select>[32: ---, 1, 2, 3, 4, 5, 6, 7, …]; `fecha_periodo_fiscal_month`<select>[13: ---, 1=enero, 2=febrero, 3=marzo, 4=abril, 5=mayo, 6=junio, 7=julio, …]; `fecha_periodo_fiscal_year`<select>[3: ---, 2026, 2025]; `tipo_retencion`<select>[2: F=Física, E=Electrónica]; `numero_documento_retencion`; `autorizacion_retencion`; ``<select>; `anio_utilidades`; `monto_pagado_ir`; `retencion_fraccion_basica`; `ingreso_gravado_fraccion_basica`; `regimen_retencion`<select>[4: Elige una opción, 01=Régimen General, 02=Paraíso Fiscal, 03=Régimen Fiscal Preferente]; `pais_pago_realizar_pf`<select>[60: Elige una opción, 1=ANGUILA (Territorio no aut, 2=ANTIGUA Y BARBUDA (Estado , 3=ARCHIPIÉLAGO DE SVALBARD, 4=ARUBA, 5=BARBADOS (Estado independi, 6=BELICE (Estado independien, 7=BERMUDAS (Territorio no au, …]; `pais_pago_realizar_rg`<select>[60: Elige una opción, 16=AMERICAN SAMOA, 52=PRINCIPADO DEL VALLE DE A, 74=BOUVET ISLAND, 101=ARGENTINA, 102=BOLIVIA, 103=BRASIL, 104=CANADA, …]; `denominacion_regimen_preferente`; `pais_pago_efectuar_pf`<select>[60: Elige una opción, 1=ANGUILA, 2=ANTIGUA Y BARBUDA, 3=NORUEGA, 4=ARUBA, 5=BARBADOS, 6=BELICE, 7=BERMUDA, …]; `pais_pago_efectuar_rg`<select>[60: Elige una opción, 16=AMERICAN SAMOA, 52=PRINCIPADO DEL VALLE DE A, 74=BOUVET ISLAND, 101=ARGENTINA, 102=BOLIVIA, 103=BRASIL, 104=CANADA, …]; `pais_pago_efectuar_rg`<hidden>; `pais_pago_efectuar_rp`<select>[60: Elige una opción, 16=AMERICAN SAMOA, 52=PRINCIPADO DEL VALLE DE A, 74=BOUVET ISLAND, 101=ARGENTINA, 102=BOLIVIA, 103=BRASIL, 104=CANADA, …]; `establecimiento_retencion`<select>[1: 001]; `punto_emision_retencion`; `doble_tributacion`<radio>; `doble_tributacion`<radio>; `pago_sujeto_retencion`<radio>; `pago_sujeto_retencion`<radio>; `retencion_iva_template-gasto`<checkbox>; `retencion_iva_template-retencion_id`<hidden>; `retencion_iva_template-tipo_documento_reembolso`<select>[3: ---, 01=Factura, 03=Liquidacion de Compra]; `retencion_iva_template-tipo`<hidden>; `retencion_iva_template-codigo_sri`; `retencion_iva_template-base`; `retencion_iva_template-porcentaje`; `retencion_iva_template-valor`; `retencion_template-gasto`<checkbox>; `retencion_template-retencion_id`<hidden>; `retencion_template-tipo_documento_reembolso`<select>[3: ---, 01=Factura, 03=Liquidacion de Compra]; `retencion_template-tipo`<hidden>; `retencion_template-codigo_sri`; `retencion_template-base`; `retencion_template-porcentaje`; `retencion_template-valor`; `activofijo_template-nombre`; `activofijo_template-activofijo`<hidden>; `activofijo_template-categoriaactivo`<hidden>; `activofijo_template-tipoactivo`<hidden>; `activofijo_template-codigo`; `activofijo_template-porcentaje_depreciacion`<select>[4: 5.00=5%, 10.00=10%, 20.00=20%, 33.00=33%]; `activofijo_template-fecha_registro`; `activofijo_template-valor_inicial`; `activofijo_template-valor_actual`; `activofijo_template-fecha_inicio_depreciacion`; `activofijo_template-precio`; `activofijo_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, NO]; `activofijo_template-subtotal`; `activofijo_template-tipo_retencion_ir_id`<hidden>; `activofijo_template-tipo_retencion_iva_id`<hidden>; `activofijo_template-ubicacion`<hidden>; `activofijo_template-ubicacion_label`; `activofijo_template-centro_costo`<hidden>; `pago_template-forma_pago`<select>[8: 20=Otros con Utilización del, 01=Sin utilización del Siste, 15=Compensación de Deudas, 16=Tarjeta de débito, 17=Dinero Electrónico, 18=Tarjeta Prepago, 19=Tarjeta de crédito, 21=Endoso de títulos]; `pago_template-plazo`; `pago_template-unidad`<select>[2: días, meses]; `pago_template-valor`; `descripcion`<textarea>; `adicional1`; `adicional2`; `subtotal_iva`; `subtotal_iva_5`; `subtotal_0`; `descuento`; `iva`; `iva_calculado`<hidden>; `iva_5`; `iva_5_calculado`<hidden>; `ice`; `total`; `pagado_caja_chica`<checkbox>; `cuenta_caja_chica`<hidden>; `producir`<hidden>; `aprobar`<hidden>
- Form `frm_firmar` POST → /sistema/registro/documento/firmar/: `desde_retencion`<hidden>; `receptor`
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `frm_enviar_proforma` POST → /sistema/registro/documento/enviar_proforma/: `documento_id`<hidden>; `receptorP`
- Tabla: Cant. | Producto | Centro Costo | Unidad | Precio U. | IVA | Ret. IR | Ret. IVA | Desc. | Desc. | Subtotal | 
- Tabla: Cant. | Producto/Cuenta | Subtotal | Proyecto | Centro Costo
- Tabla:  | Producto | Cant. | Precio U. | %Desc. | Subtotal
- Tabla: Cant. | Cuenta | Valor U. | IVA | % ICE | Ret. IR | Ret. IVA | % Desc. | Desc. | Subtotal | 

#### `registro/documento/registrar/?prefactura=1` — Registrar Prefactura
Secciones: Registrar Prefactura · Cargando documento... · Documentos Agrupados · Documentos Adjuntos · Agregar Descuentos · Seleccionar Tarifa IVA · Agregar Color por Item · ¡Atención!
- Form `(fuera de form)` : `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>
- Form `(sin id)` POST: `tiene_cuotas_cobradas_pagadas`<hidden>; `es_cuentaservice`<hidden>; `id`<hidden>; `prefactura_rel_id`<hidden>; `electronico`<hidden>; `cotizacion`<hidden>; `pvp_default`<hidden>; `excluir_secuencia_retencion`<hidden>; `guardar_enviar_sri`<hidden>; `guardar_enviar_sri_retencion`<hidden>; `es_agrupar`<hidden>; `duplicar`<hidden>; `persona_maneja_pvpmanual`<hidden>; `confirma_registro_detalle`<hidden>; `fecha_emision`; `aplica_iva_12`<checkbox>; `porcentaje_iva`<select>[1: ]; `valor_iva_porcentaje`<hidden>; `tipo_registro_documento`<select>[2: CLI=Cliente, PRO=Proveedor]; `tipo_documento`<select>[1: PRE=Prefactura]; `numero_documento`; `autorizacion`; ``<select>; `persona_id`<hidden>; `documento_relacionado_id`<hidden>; `referencia`; `vendedor_id`<select>[26: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `propina`; `vencimiento`; `notificar_vencimiento`<checkbox>; `entregado`<checkbox>; `ordencompraventa`<hidden>; `movimientoProductos_id`<hidden>; `bodega_id`<hidden>; `centro_costo_bodega_default_id`<hidden>; `sin_movimiento`<checkbox>; `tipo_retencion_ir_id`<hidden>; `tipo_retencion_iva_id`<hidden>; `producto_template-cantidad`; `producto_template-producto_id`<hidden>; `producto_template-hidden_data_producto`<hidden>; `producto_template-serie_compra`; `producto_template-serie_venta`; `producto_template-nombre_manual`<textarea>; `producto_template-edicion`; `producto_template-color_id`<hidden>; `producto_template-lote`; `producto_template-fecha_expiracion`; `producto_template-lotefield`<hidden>; `producto_template-centro_costo_id`<hidden>; `producto_template-hidden_data_centro_costo`<hidden>; `producto_template-unidad`<select>; `producto_template-hidden_unidad`<hidden>; `producto_template-precio_compra`; `producto_template-precio_venta`<select>; `producto_template-precio_venta_manual`; `producto_template-hidden_precio_venta`<hidden>; `producto_template-hidden_precio_vendido`<hidden>; `producto_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, No objeto]; `producto_template-tipo_retencion_ir_id`<hidden>; `producto_template-tipo_retencion_iva_id`<hidden>; `producto_template-porcentaje_descuento`; `producto_template-descuento`; `producto_template-subtotal`; `producto_template-base_cero`<hidden>; `producto_template-base_gravable`<hidden>; `producto_template-base_no_gravable`<hidden>; `producto_template-porcentaje_ice`<hidden>; `producto_template-valor_ice`<hidden>; `producto_template-ice`<hidden>; `producto_template-hidden_maneja_serie`<hidden>; `producto_template-hidden_maneja_pvpmanual`<hidden>; `producto_template-hidden_porcentaje_iva_producto`<hidden>; `producto_template-tipo_producto_medical`<hidden>; `producto_template-peso`<hidden>; `producto_template-volumen`<hidden>; `producto_template-proyecto_id`<hidden>; `proyecto_id`<hidden>; `centro_costo_cuenta_id`<hidden>; `proyecto_template-hidden_item`<hidden>; `proyecto_template-proyecto_id`<hidden>; `proyecto_template-centro_costo_id`<hidden>; `tipo_retencion_ir_cuentas_id`<hidden>; `tipo_retencion_iva_cuentas_id`<hidden>; `cuenta_template-cantidad`; `cuenta_template-cuenta_id`<hidden>; `cuenta_template-hidden_data_cuenta_id`<hidden>; `cuenta_template-centro_costo_id`<hidden>; `cuenta_template-hidden_data_centro_costo_id`<hidden>; `cuenta_template-valor`; `cuenta_template-porcentaje_iva`<select>[7: 8=8%, 5=5%, 12=12%, 15=15%, 14=14%, 0=0%, No objeto]; `cuenta_template-porcentaje_ice`; `cuenta_template-ice`<hidden>; `cuenta_template-tipo_retencion_ir_id`<hidden>; `cuenta_template-tipo_retencion_iva_id`<hidden>; `cuenta_template-porcentaje_descuento`; `cuenta_template-descuento`; `cuenta_template-subtotal`; `cuenta_template-base_cero`<hidden>; `cuenta_template-base_gravable`<hidden>; `cuenta_template-base_no_gravable`<hidden>; `cuenta_template-proyecto_id`<hidden>; `docreembolso_template-documento_id`<hidden>; `docreembolsoproveedor_template-tipo_proveedor`<select>[3: C=Cédula, R=RUC, P=Pasaporte]; `docreembolsoproveedor_template-identificacion`; `docreembolsoproveedor_template-tipo_documento_ced`<select>[10: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 09=TIQUETES O VALES EMITIDOS, 08=BOLETOS O ENTRADAS A ESPE, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, 48=NOTAS DE DEBITO POR REEMB, …]; `docreembolsoproveedor_template-tipo_documento_ruc`<select>[17: 01=FACTURA, 02=NOTA DE VENTA, 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 11=PASAJES EMITIDOS POR EMPR, 12=DOCUMENTOS EMITIDOS POR I, …]; `docreembolsoproveedor_template-tipo_documento_pas`<select>[11: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 15=COMPROBANTES DE VENTA EMI, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, …]; `docreembolsoproveedor_template-numero_documento`; `docreembolsoproveedor_template-autorizacion`; `docreembolsoproveedor_template-fecha_emision`; `docreembolsoproveedor_template-base_0`; `docreembolsoproveedor_template-base_iva`; `docreembolsoproveedor_template-base_iva_5`; `docreembolsoproveedor_template-base_no_objeto`; `docreembolsoproveedor_template-base_exento`; `docreembolsoproveedor_template-iva`; `docreembolsoproveedor_template-iva_5`; `docreembolsoproveedor_template-ice`; `docreembolsoproveedor_template-total`; `activofijo_template-nombre`; `activofijo_template-activofijo`<hidden>; `activofijo_template-categoriaactivo`<hidden>; `activofijo_template-tipoactivo`<hidden>; `activofijo_template-codigo`; `activofijo_template-porcentaje_depreciacion`<select>[4: 5.00=5%, 10.00=10%, 20.00=20%, 33.00=33%]; `activofijo_template-fecha_registro`; `activofijo_template-valor_inicial`; `activofijo_template-valor_actual`; `activofijo_template-fecha_inicio_depreciacion`; `activofijo_template-precio`; `activofijo_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, NO]; `activofijo_template-subtotal`; `activofijo_template-tipo_retencion_ir_id`<hidden>; `activofijo_template-tipo_retencion_iva_id`<hidden>; `activofijo_template-ubicacion`<hidden>; `activofijo_template-ubicacion_label`; `activofijo_template-centro_costo`<hidden>; `pago_template-forma_pago`<select>[8: 20=Otros con Utilización del, 01=Sin utilización del Siste, 15=Compensación de Deudas, 16=Tarjeta de débito, 17=Dinero Electrónico, 18=Tarjeta Prepago, 19=Tarjeta de crédito, 21=Endoso de títulos]; `pago_template-plazo`; `pago_template-unidad`<select>[2: días, meses]; `pago_template-valor`; `descripcion`<textarea>; `adicional1`; `adicional2`; `subtotal_iva`; `subtotal_iva_5`; `subtotal_0`; `descuento`; `iva`; `iva_calculado`<hidden>; `iva_5`; `iva_5_calculado`<hidden>; `ice`; `total`; `pagado_caja_chica`<checkbox>; `cuenta_caja_chica`<hidden>; `producir`<hidden>; `aprobar`<hidden>
- Form `frm_firmar` POST → /sistema/registro/documento/firmar/: `desde_retencion`<hidden>; `receptor`
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `frm_enviar_proforma` POST → /sistema/registro/documento/enviar_proforma/: `documento_id`<hidden>; `receptorP`
- Tabla: Cant. | Producto | Centro Costo | Unidad | Precio U. | IVA | Ret. IR | Ret. IVA | Desc. | Desc. | Subtotal | 
- Tabla: Cant. | Producto/Cuenta | Subtotal | Proyecto | Centro Costo
- Tabla:  | Producto | Cant. | Precio U. | %Desc. | Subtotal
- Tabla: Cant. | Cuenta | Valor U. | IVA | % ICE | Ret. IR | Ret. IVA | % Desc. | Desc. | Subtotal | 

#### `registro/documento/registrar/?proforma=1` — Registrar Proforma
Secciones: Registrar Proforma · Cargando documento... · Documentos Agrupados · Documentos Adjuntos · Agregar Descuentos · Seleccionar Tarifa IVA · Agregar Color por Item · ¡Atención!
- Form `(fuera de form)` : `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>
- Form `(sin id)` POST: `tiene_cuotas_cobradas_pagadas`<hidden>; `es_cuentaservice`<hidden>; `id`<hidden>; `prefactura_rel_id`<hidden>; `electronico`<hidden>; `cotizacion`<hidden>; `pvp_default`<hidden>; `excluir_secuencia_retencion`<hidden>; `guardar_enviar_sri`<hidden>; `guardar_enviar_sri_retencion`<hidden>; `es_agrupar`<hidden>; `duplicar`<hidden>; `persona_maneja_pvpmanual`<hidden>; `confirma_registro_detalle`<hidden>; `fecha_emision`; `aplica_iva_12`<checkbox>; `porcentaje_iva`<select>[1: ]; `valor_iva_porcentaje`<hidden>; `tipo_registro_documento`<select>[2: CLI=Cliente, PRO=Proveedor]; `tipo_documento`<select>[3: COT=Cotización, PRE=Prefactura, OCV=Orden Compra/Contrato]; `numero_documento`; `autorizacion`; ``<select>; `proveedor_desconocido`<checkbox>; `persona_id`<hidden>; `documento_relacionado_id`<hidden>; `referencia`; `vendedor_id`<select>[26: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `vencimiento`; `notificar_vencimiento`<checkbox>; `proyecto_proforma`; `forma_pago_proforma`; `atencion_proforma`; `garantia_proforma`; `entregado`<checkbox>; `movimientoProductos_id`<hidden>; `bodega_id`<hidden>; `centro_costo_bodega_default_id`<hidden>; `tipo_retencion_ir_id`<hidden>; `tipo_retencion_iva_id`<hidden>; `producto_template-cantidad`; `producto_template-producto_id`<hidden>; `producto_template-hidden_data_producto`<hidden>; `producto_template-serie_compra`; `producto_template-serie_venta`; `producto_template-nombre_manual`<textarea>; `producto_template-edicion`; `producto_template-color_id`<hidden>; `producto_template-lote`; `producto_template-fecha_expiracion`; `producto_template-lotefield`<hidden>; `producto_template-centro_costo_id`<hidden>; `producto_template-hidden_data_centro_costo`<hidden>; `producto_template-unidad`<select>; `producto_template-hidden_unidad`<hidden>; `producto_template-precio_compra`; `producto_template-precio_venta`<select>; `producto_template-precio_venta_manual`; `producto_template-hidden_precio_venta`<hidden>; `producto_template-hidden_precio_vendido`<hidden>; `producto_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, No objeto]; `producto_template-tipo_retencion_ir_id`<hidden>; `producto_template-tipo_retencion_iva_id`<hidden>; `producto_template-porcentaje_descuento`; `producto_template-descuento`; `producto_template-subtotal`; `producto_template-base_cero`<hidden>; `producto_template-base_gravable`<hidden>; `producto_template-base_no_gravable`<hidden>; `producto_template-porcentaje_ice`<hidden>; `producto_template-valor_ice`<hidden>; `producto_template-ice`<hidden>; `producto_template-hidden_maneja_serie`<hidden>; `producto_template-hidden_maneja_pvpmanual`<hidden>; `producto_template-hidden_porcentaje_iva_producto`<hidden>; `producto_template-tipo_producto_medical`<hidden>; `producto_template-peso`<hidden>; `producto_template-volumen`<hidden>; `producto_template-proyecto_id`<hidden>; `proyecto_id`<hidden>; `centro_costo_cuenta_id`<hidden>; `proyecto_template-hidden_item`<hidden>; `proyecto_template-proyecto_id`<hidden>; `proyecto_template-centro_costo_id`<hidden>; `tipo_retencion_ir_cuentas_id`<hidden>; `tipo_retencion_iva_cuentas_id`<hidden>; `cuenta_template-cantidad`; `cuenta_template-cuenta_id`<hidden>; `cuenta_template-hidden_data_cuenta_id`<hidden>; `cuenta_template-centro_costo_id`<hidden>; `cuenta_template-hidden_data_centro_costo_id`<hidden>; `cuenta_template-valor`; `cuenta_template-porcentaje_iva`<select>[7: 14=14%, 5=5%, 15=15%, 12=12%, 8=8%, 0=0%, No objeto]; `cuenta_template-porcentaje_ice`; `cuenta_template-ice`<hidden>; `cuenta_template-tipo_retencion_ir_id`<hidden>; `cuenta_template-tipo_retencion_iva_id`<hidden>; `cuenta_template-porcentaje_descuento`; `cuenta_template-descuento`; `cuenta_template-subtotal`; `cuenta_template-base_cero`<hidden>; `cuenta_template-base_gravable`<hidden>; `cuenta_template-base_no_gravable`<hidden>; `cuenta_template-proyecto_id`<hidden>; `docreembolso_template-documento_id`<hidden>; `docreembolsoproveedor_template-tipo_proveedor`<select>[3: C=Cédula, R=RUC, P=Pasaporte]; `docreembolsoproveedor_template-identificacion`; `docreembolsoproveedor_template-tipo_documento_ced`<select>[10: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 09=TIQUETES O VALES EMITIDOS, 08=BOLETOS O ENTRADAS A ESPE, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, 48=NOTAS DE DEBITO POR REEMB, …]; `docreembolsoproveedor_template-tipo_documento_ruc`<select>[17: 01=FACTURA, 02=NOTA DE VENTA, 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 11=PASAJES EMITIDOS POR EMPR, 12=DOCUMENTOS EMITIDOS POR I, …]; `docreembolsoproveedor_template-tipo_documento_pas`<select>[11: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 15=COMPROBANTES DE VENTA EMI, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, …]; `docreembolsoproveedor_template-numero_documento`; `docreembolsoproveedor_template-autorizacion`; `docreembolsoproveedor_template-fecha_emision`; `docreembolsoproveedor_template-base_0`; `docreembolsoproveedor_template-base_iva`; `docreembolsoproveedor_template-base_iva_5`; `docreembolsoproveedor_template-base_no_objeto`; `docreembolsoproveedor_template-base_exento`; `docreembolsoproveedor_template-iva`; `docreembolsoproveedor_template-iva_5`; `docreembolsoproveedor_template-ice`; `docreembolsoproveedor_template-total`; `pago_template-forma_pago`<select>[8: 20=Otros con Utilización del, 01=Sin utilización del Siste, 15=Compensación de Deudas, 16=Tarjeta de débito, 17=Dinero Electrónico, 18=Tarjeta Prepago, 19=Tarjeta de crédito, 21=Endoso de títulos]; `pago_template-plazo`; `pago_template-unidad`<select>[2: días, meses]; `pago_template-valor`; `descripcion`<textarea>; `adicional1`; `adicional2`; `subtotal_iva`; `subtotal_iva_5`; `subtotal_0`; `descuento`; `iva`; `iva_calculado`<hidden>; `iva_5`; `iva_5_calculado`<hidden>; `ice`; `total`; `pagado_caja_chica`<checkbox>; `cuenta_caja_chica`<hidden>; `producir`<hidden>; `aprobar`<hidden>
- Form `frm_firmar` POST → /sistema/registro/documento/firmar/: `desde_retencion`<hidden>; `receptor`
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `frm_enviar_proforma` POST → /sistema/registro/documento/enviar_proforma/: `documento_id`<hidden>; `receptorP`
- Tabla: Cant. | Producto | Centro Costo | Unidad | Precio U. | IVA | Ret. IR | Ret. IVA | Desc. | Desc. | Subtotal | 
- Tabla: Cant. | Producto/Cuenta | Subtotal | Proyecto | Centro Costo
- Tabla:  | Producto | Cant. | Precio U. | %Desc. | Subtotal
- Tabla: Cant. | Cuenta | Valor U. | IVA | % ICE | Ret. IR | Ret. IVA | % Desc. | Desc. | Subtotal | 

#### `registro/documento/registrar/?proveedor=1` — Registrar Documento
Secciones: Registrar Documento · Cargando documento... · Documentos Agrupados · Documentos Adjuntos · Agregar Descuentos · Seleccionar Tarifa IVA · Agregar Color por Item · ¡Atención!
- Form `(fuera de form)` : `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>; `lista-iva-producto`<radio>
- Form `(sin id)` POST: `tiene_cuotas_cobradas_pagadas`<hidden>; `es_cuentaservice`<hidden>; `id`<hidden>; `prefactura_rel_id`<hidden>; `electronico`<hidden>; `cotizacion`<hidden>; `pvp_default`<hidden>; `excluir_secuencia_retencion`<hidden>; `guardar_enviar_sri`<hidden>; `guardar_enviar_sri_retencion`<hidden>; `es_agrupar`<hidden>; `duplicar`<hidden>; `persona_maneja_pvpmanual`<hidden>; `confirma_registro_detalle`<hidden>; `fecha_emision`; `aplica_iva_12`<checkbox>; `porcentaje_iva`<select>[1: ]; `valor_iva_porcentaje`<hidden>; `tipo_registro_documento`<select>[2: CLI=Cliente, PRO=Proveedor]; `tipo_documento`<select>[20: FAC=Factura, NVE=Nota de Venta, LQC=Liquidación de Compra, LMU=Liquidación de Compra de, DNA=Documento no autorizado , DAC=Comprobante de Anticipo , EIF=Documentos Emitidos por , NDT=Nota de Débito, …]; `numero_documento`; `autorizacion`; ``<select>; `persona_id`<hidden>; `documento_relacionado_id`<hidden>; `referencia`; `vendedor_id`<select>[26: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `propina`; `vencimiento`; `notificar_vencimiento`<checkbox>; `entregado`<checkbox>; `ordencompraventa`<hidden>; `movimientoProductos_id`<hidden>; `bodega_id`<hidden>; `centro_costo_bodega_default_id`<hidden>; `sin_movimiento`<checkbox>; `tipo_retencion_ir_id`<hidden>; `tipo_retencion_iva_id`<hidden>; `producto_template-cantidad`; `producto_template-producto_id`<hidden>; `producto_template-hidden_data_producto`<hidden>; `producto_template-serie_compra`; `producto_template-serie_venta`; `producto_template-nombre_manual`<textarea>; `producto_template-edicion`; `producto_template-color_id`<hidden>; `producto_template-lote`; `producto_template-fecha_expiracion`; `producto_template-lotefield`<hidden>; `producto_template-centro_costo_id`<hidden>; `producto_template-hidden_data_centro_costo`<hidden>; `producto_template-unidad`<select>; `producto_template-hidden_unidad`<hidden>; `producto_template-precio_compra`; `producto_template-precio_venta`<select>; `producto_template-precio_venta_manual`; `producto_template-hidden_precio_venta`<hidden>; `producto_template-hidden_precio_vendido`<hidden>; `producto_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, No objeto]; `producto_template-tipo_retencion_ir_id`<hidden>; `producto_template-tipo_retencion_iva_id`<hidden>; `producto_template-porcentaje_descuento`; `producto_template-descuento`; `producto_template-subtotal`; `producto_template-base_cero`<hidden>; `producto_template-base_gravable`<hidden>; `producto_template-base_no_gravable`<hidden>; `producto_template-porcentaje_ice`<hidden>; `producto_template-valor_ice`<hidden>; `producto_template-ice`<hidden>; `producto_template-hidden_maneja_serie`<hidden>; `producto_template-hidden_maneja_pvpmanual`<hidden>; `producto_template-hidden_porcentaje_iva_producto`<hidden>; `producto_template-tipo_producto_medical`<hidden>; `producto_template-peso`<hidden>; `producto_template-volumen`<hidden>; `producto_template-proyecto_id`<hidden>; `proyecto_id`<hidden>; `centro_costo_cuenta_id`<hidden>; `proyecto_template-hidden_item`<hidden>; `proyecto_template-proyecto_id`<hidden>; `proyecto_template-centro_costo_id`<hidden>; `tipo_retencion_ir_cuentas_id`<hidden>; `tipo_retencion_iva_cuentas_id`<hidden>; `cuenta_template-cantidad`; `cuenta_template-cuenta_id`<hidden>; `cuenta_template-hidden_data_cuenta_id`<hidden>; `cuenta_template-centro_costo_id`<hidden>; `cuenta_template-hidden_data_centro_costo_id`<hidden>; `cuenta_template-valor`; `cuenta_template-porcentaje_iva`<select>[7: 14=14%, 8=8%, 15=15%, 5=5%, 12=12%, 0=0%, No objeto]; `cuenta_template-porcentaje_ice`; `cuenta_template-ice`<hidden>; `cuenta_template-tipo_retencion_ir_id`<hidden>; `cuenta_template-tipo_retencion_iva_id`<hidden>; `cuenta_template-porcentaje_descuento`; `cuenta_template-descuento`; `cuenta_template-subtotal`; `cuenta_template-base_cero`<hidden>; `cuenta_template-base_gravable`<hidden>; `cuenta_template-base_no_gravable`<hidden>; `cuenta_template-proyecto_id`<hidden>; `docreembolso_template-documento_id`<hidden>; `docreembolsoproveedor_template-tipo_proveedor`<select>[3: C=Cédula, R=RUC, P=Pasaporte]; `docreembolsoproveedor_template-identificacion`; `docreembolsoproveedor_template-tipo_documento_ced`<select>[10: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 09=TIQUETES O VALES EMITIDOS, 08=BOLETOS O ENTRADAS A ESPE, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, 48=NOTAS DE DEBITO POR REEMB, …]; `docreembolsoproveedor_template-tipo_documento_ruc`<select>[17: 01=FACTURA, 02=NOTA DE VENTA, 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 11=PASAJES EMITIDOS POR EMPR, 12=DOCUMENTOS EMITIDOS POR I, …]; `docreembolsoproveedor_template-tipo_documento_pas`<select>[11: 03=LIQUIDACIÓN DE COMPRA DE , 04=NOTAS DE CRÉDITO, 05=NOTAS DE DÉBITO, 08=BOLETOS O ENTRADAS A ESPE, 09=TIQUETES O VALES EMITIDOS, 15=COMPROBANTES DE VENTA EMI, 19=COMPROBANTES DE PAGO DE C, 41=COMPROBANTES DE VENTA EMI, …]; `docreembolsoproveedor_template-numero_documento`; `docreembolsoproveedor_template-autorizacion`; `docreembolsoproveedor_template-fecha_emision`; `docreembolsoproveedor_template-base_0`; `docreembolsoproveedor_template-base_iva`; `docreembolsoproveedor_template-base_iva_5`; `docreembolsoproveedor_template-base_no_objeto`; `docreembolsoproveedor_template-base_exento`; `docreembolsoproveedor_template-iva`; `docreembolsoproveedor_template-iva_5`; `docreembolsoproveedor_template-ice`; `docreembolsoproveedor_template-total`; `fecha_emision_retencion`; `fecha_periodo_fiscal_day`<select>[32: ---, 1, 2, 3, 4, 5, 6, 7, …]; `fecha_periodo_fiscal_month`<select>[13: ---, 1=enero, 2=febrero, 3=marzo, 4=abril, 5=mayo, 6=junio, 7=julio, …]; `fecha_periodo_fiscal_year`<select>[3: ---, 2026, 2025]; `tipo_retencion`<select>[2: F=Física, E=Electrónica]; `numero_documento_retencion`; `autorizacion_retencion`; ``<select>; `anio_utilidades`; `monto_pagado_ir`; `retencion_fraccion_basica`; `ingreso_gravado_fraccion_basica`; `regimen_retencion`<select>[4: Elige una opción, 01=Régimen General, 02=Paraíso Fiscal, 03=Régimen Fiscal Preferente]; `pais_pago_realizar_pf`<select>[60: Elige una opción, 1=ANGUILA (Territorio no aut, 2=ANTIGUA Y BARBUDA (Estado , 3=ARCHIPIÉLAGO DE SVALBARD, 4=ARUBA, 5=BARBADOS (Estado independi, 6=BELICE (Estado independien, 7=BERMUDAS (Territorio no au, …]; `pais_pago_realizar_rg`<select>[60: Elige una opción, 16=AMERICAN SAMOA, 52=PRINCIPADO DEL VALLE DE A, 74=BOUVET ISLAND, 101=ARGENTINA, 102=BOLIVIA, 103=BRASIL, 104=CANADA, …]; `denominacion_regimen_preferente`; `pais_pago_efectuar_pf`<select>[60: Elige una opción, 1=ANGUILA, 2=ANTIGUA Y BARBUDA, 3=NORUEGA, 4=ARUBA, 5=BARBADOS, 6=BELICE, 7=BERMUDA, …]; `pais_pago_efectuar_rg`<select>[60: Elige una opción, 16=AMERICAN SAMOA, 52=PRINCIPADO DEL VALLE DE A, 74=BOUVET ISLAND, 101=ARGENTINA, 102=BOLIVIA, 103=BRASIL, 104=CANADA, …]; `pais_pago_efectuar_rg`<hidden>; `pais_pago_efectuar_rp`<select>[60: Elige una opción, 16=AMERICAN SAMOA, 52=PRINCIPADO DEL VALLE DE A, 74=BOUVET ISLAND, 101=ARGENTINA, 102=BOLIVIA, 103=BRASIL, 104=CANADA, …]; `establecimiento_retencion`<select>[1: 001]; `punto_emision_retencion`; `doble_tributacion`<radio>; `doble_tributacion`<radio>; `pago_sujeto_retencion`<radio>; `pago_sujeto_retencion`<radio>; `retencion_iva_template-gasto`<checkbox>; `retencion_iva_template-retencion_id`<hidden>; `retencion_iva_template-tipo_documento_reembolso`<select>[3: ---, 01=Factura, 03=Liquidacion de Compra]; `retencion_iva_template-tipo`<hidden>; `retencion_iva_template-codigo_sri`; `retencion_iva_template-base`; `retencion_iva_template-porcentaje`; `retencion_iva_template-valor`; `retencion_template-gasto`<checkbox>; `retencion_template-retencion_id`<hidden>; `retencion_template-tipo_documento_reembolso`<select>[3: ---, 01=Factura, 03=Liquidacion de Compra]; `retencion_template-tipo`<hidden>; `retencion_template-codigo_sri`; `retencion_template-base`; `retencion_template-porcentaje`; `retencion_template-valor`; `activofijo_template-nombre`; `activofijo_template-activofijo`<hidden>; `activofijo_template-categoriaactivo`<hidden>; `activofijo_template-tipoactivo`<hidden>; `activofijo_template-codigo`; `activofijo_template-porcentaje_depreciacion`<select>[4: 5.00=5%, 10.00=10%, 20.00=20%, 33.00=33%]; `activofijo_template-fecha_registro`; `activofijo_template-valor_inicial`; `activofijo_template-valor_actual`; `activofijo_template-fecha_inicio_depreciacion`; `activofijo_template-precio`; `activofijo_template-porcentaje_iva`<select>[7: 12=12%, 14=14%, 15=15%, 5=5%, 8=8%, 0=0%, NO]; `activofijo_template-subtotal`; `activofijo_template-tipo_retencion_ir_id`<hidden>; `activofijo_template-tipo_retencion_iva_id`<hidden>; `activofijo_template-ubicacion`<hidden>; `activofijo_template-ubicacion_label`; `activofijo_template-centro_costo`<hidden>; `pago_template-forma_pago`<select>[8: 20=Otros con Utilización del, 01=Sin utilización del Siste, 15=Compensación de Deudas, 16=Tarjeta de débito, 17=Dinero Electrónico, 18=Tarjeta Prepago, 19=Tarjeta de crédito, 21=Endoso de títulos]; `pago_template-plazo`; `pago_template-unidad`<select>[2: días, meses]; `pago_template-valor`; `descripcion`<textarea>; `adicional1`; `adicional2`; `subtotal_iva`; `subtotal_iva_5`; `subtotal_0`; `descuento`; `iva`; `iva_calculado`<hidden>; `iva_5`; `iva_5_calculado`<hidden>; `ice`; `total`; `pagado_caja_chica`<checkbox>; `cuenta_caja_chica`<hidden>; `producir`<hidden>; `aprobar`<hidden>
- Form `frm_firmar` POST → /sistema/registro/documento/firmar/: `desde_retencion`<hidden>; `receptor`
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `frm_enviar_proforma` POST → /sistema/registro/documento/enviar_proforma/: `documento_id`<hidden>; `receptorP`
- Tabla: Cant. | Producto | Centro Costo | Unidad | Precio U. | IVA | Ret. IR | Ret. IVA | Desc. | Desc. | Subtotal | 
- Tabla: Cant. | Producto/Cuenta | Subtotal | Proyecto | Centro Costo
- Tabla:  | Producto | Cant. | Precio U. | %Desc. | Subtotal
- Tabla: Cant. | Cuenta | Valor U. | IVA | % ICE | Ret. IR | Ret. IVA | % Desc. | Desc. | Subtotal | 

#### `registro/documento/?tipo_registro=PRO` — Consultar documentos
Secciones: Consultar documentos · Actualizar estado · Búsqueda · Agrupar Documentos · Importar Documentos · Firmar Documento · Autorización de documentos · Anular Documento
- Form `docForm` GET · exports: excel, excel_por_producto, pdf: `pagina`<hidden>; `pago_masivo_id`<hidden>; `hdn_seleccionar`<hidden>; `de`<hidden>; `cash_management`<hidden>; `param_cash_management_cobro`<hidden>; `fecha_consumo_tc`<hidden>; `param_formato_cobro_bco`<hidden>; `param_forma_cobro`<hidden>; `numero_documento`; `fecha_inicio`; `persona`<hidden>; `persona_id`<hidden>; `fecha_fin`; `tipo_documento`<select>[26: Todos, FAC=Factura, NVE=Nota de Venta, LQC=Liquidación de Compra, LQR=Liquidación de Compra po, LMU=Liquidación de Compra de, EIF=Documentos Emitidos por , IMP=Documentos de Importació, …]; `tipo`<select>[3: Todos, CLI=Cliente, PRO=Proveedor]; `estado`<select>[5: Todos, P=Pendiente, A=Anulado, C=Cobrado, G=Pagado]; `vencimiento`<select>[3: Todos, PV=Por Vencer, VE=Vencido]; `emision`<select>[3: Todos, FI=Fisica, EL=Electronica]; `estado_electronico`<select>[3: Todos, FIN=Finalizado, PEN=Pendiente]; `ordencompraventa`<hidden>; `ordencompraventa_id`<hidden>; `codigo_sustento`<select>[9: Todos, 02=Costo o Gasto Bienes y Se, 05=Gastos de Empleados (Cod., 07=Costo o Gasto Inventario , 08=Reembolso de Gastos por i, 09=Reembolso por siniestros , 10=Distribución de Dividendo, 14=Facturación por socios a , …]; `caja_id`<hidden>; `caja`<hidden>; `centro_costo`<hidden>; `centro_costo_id`<hidden>; `referencia`; `vendedor_id`<select>[30: ---------, 43582601=Administrador, 44048585=Alba Morales Yerman, 44712669=Almeida Diaz Ana Ca, 41273272=Cañar Mendoza Tania, 28516527=Cañas Albornoz Jhoa, 28508870=DIANA CAROLINA VIEL, 44047865=Díaz Araujo Adriana, …]; `vendedor`<hidden>; `campo_adicional_1`; `proyecto_id`<hidden>; `proyecto`<hidden>; `importacion_id`<hidden>; `importacion`<hidden>; `numero_documento_retencion`; `producto_id`<hidden>; `producto`<hidden>; `serie`; `bodega`<hidden>; `bodega_id`<hidden>; `categoria_persona`<hidden>; `categoria_persona_id`<hidden>
- Form `(fuera de form)` : `chk_todosElectronicos`<checkbox>; `doc_eliminar[]`<checkbox>
- Form `agrupaForm` POST → /sistema/registro/agrupar_documentos/: `persona_agrupar`<hidden>; `tipo_documento`<select>[4: FAC=Factura, FEL=Factura Electrónica, NVE=Nota de Venta, DNA=Documento no autorizado]; `tipo_registro_documento`<hidden>
- Form `frm_firmar` POST: `password`<password>; `accion`<hidden>
- Form `frm_changeDate` POST: `change_fecha_retencion`<hidden>; `change_fecha_modulo`<hidden>; `id_password_firma`<password>
- Form `form_anular` POST: `accion`<hidden>
- Tabla:  |  | Emisión | Persona | Documento |  |  |  |  | Neto | Imp. | Total | Ret. | Saldo | Acciones

#### `registro/electronicos/importar/facturas/` — Carga de Compras
Secciones: Carga de Compras · Información del Documento · Cargando Documentos
- Form `cargaComprasForm` GET: `numero_documento`; `fecha_desde`; `proveedor`; `fecha_hasta`
- Form `(fuera de form)` : `check_todos_importados_internos`<checkbox>; `filtro_proveedor`<hidden>; `numero_documento`<hidden>; `fecha_desde`<hidden>; `fecha_hasta`<hidden>; `filtro_proveedor`<hidden>; `numero_documento`<hidden>; `fecha_desde`<hidden>; `fecha_hasta`<hidden>
- Tabla:  | Emisión | Autorización | Proveedor | N° Documento | Acciones
- Tabla:  | F.Emisión | F.Autorización | N° Documento | Proveedor | Documento | Estado | Motivo
- Tabla:  |  | F.Emisión | F.Autorización | N° Documento | Proveedor | Estado | Motivo

#### `registro/electronicos/importar/retenciones/` — Retenciones Electrónicas Recibidas
Secciones: Retenciones Electrónicas Recibidas · Por Registrar ([[count]]) · Registradas ([[count]]) · Importar Documentos
- Form `(fuera de form)` : `buscador`; `n_retencion`<hidden>; `proveedor`<hidden>; `n_retencion`<hidden>; `proveedor`<hidden>
- Tabla:  | F.Emisión | F.Autorización | N° Retención | Proveedor | Estado | Motivo
- Tabla: F.Emisión | F.Autorización | N° Retención | Proveedor | N° Factura/Liquidación | Manual

#### `registro/transaccion/` — Consultar Cobros/Pagos
Secciones: Consultar Cobros/Pagos · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `tipo_forma_cobro_filter`<hidden>; `tipo_forma_pago_filter`<hidden>; `numero_documento`; `fecha_inicio`; `numero_comprobante_generado`; `fecha_fin`; `numero_comprobante_anticipo`; `fecha_cheque`; `persona`<hidden>; `persona_filter`<hidden>; `tipo`<select>[7: Todos, C=Cobro, P=Pago, PM=Pago Masivo, CM=Cobro Masivo, CPM=Cobro/Pago Masivo, R=Cruce]; `numero_cheque`; `otros`<checkbox>; `centro_costo`<hidden>; `centro_costo_filter`<hidden>; `postfechados_fecha_fin`; `reposicionado`<select>[3: Todos, 1=SI, 0=NO]; `depositado`<select>[3: Todos, 1=Si, 0=No]; `cuenta_afectada`<hidden>; `cuenta_filter`<hidden>
- Tabla:  | Emisión | # Comprobante | Persona | Transacción | Cuenta | Total | Acciones

#### `registro/transaccion/cruzar_documentos/` — Cruce de documentos
Secciones: Cruce de documentos · Información de la Transacción
- Form `transaccion_form` POST: `id`<hidden>; `fecha_emision`; `persona_id`<hidden>; `documento_id`<hidden>; `tipo_transaccion`<hidden>; `forma_pago_cruce`<select>[14: 02=Cheque propio, 03=Cheque certificado, 04=Cheque de gerencia, 05=Cheque del exterior, 06=Débito de cuenta, 07=Transferencia propio banc, 08=Transferencia otro banco , 09=Transferencia banco exter, …]; `descripcion`<textarea>; `documento_template-documento_id`<hidden>; `documento_template-valor_pago`; `anticipo_template-persona`<hidden>; `anticipo_template-anticipo_id`<hidden>; `anticipo_template-valor_pago`; `cuenta_template-cuenta`<hidden>; `cuenta_template-persona_id`<hidden>; `cuenta_template-centro_costo`<hidden>; `cuenta_template-valor_pago`
- Tabla:  | Documento | Fecha Emisión | Tipo Documento | Valor | Saldo | Valor a Pagar
- Tabla:  | Persona | Anticipo | Fecha Emisión | Valor | Saldo | Valor a Pagar
- Tabla:  | Cuenta Contable | Persona / Centro Costo | Valor a Pagar

#### `registro/transaccion/registrar/` — Registrar Cobro/Pago
Secciones: Registrar Cobro/Pago · Información · Información de la Transacción · Notificación Pago
- Form `transaccion_form` POST: `id`<hidden>; `tipo_transaccion`<select>[2: C=Cobro, P=Pago]; `anulado`<checkbox>; `forma_cobro`<select>[5: CAJA=Caja, CAJACHEQUE=Cheque, TRANSF=Transferencia, TC=Tarjeta de Crédito, ELEC=Dinero electrónico]; `forma_pago`<select>[5: CHEQUE=Cheque, TRANSF=Transferencia, CAJA CHICA=Caja Chica, TC=Tarjeta de Crédito, ELEC=Dinero electrónico]; `forma_pago_transferencia`<select>[6: 06=Débito de cuenta, 07=Transferencia propio banc, 08=Transferencia otro banco , 09=Transferencia banco exter, 20=Pago Ventanilla - Cheque , 21=Pago Ventanilla - Efectiv]; `forma_pago_tarjeta`<select>[2: 10=Tarjeta de crédito nacion, 11=Tarjeta de crédito intern]; `forma_pago_cheque`<select>[4: 02=Cheque propio, 03=Cheque certificado, 04=Cheque de gerencia, 05=Cheque del exterior]; `fecha_emision`; `persona_id`<hidden>; `nombre_persona`; `cuenta_id`<hidden>; `cuenta_bancaria_id`<hidden>; `numero_comprobante`; `check_efectivo`<checkbox>; `numero_cheque`; `fecha_cheque`; `lote`<hidden>; `monto_propina`; `documento_id`<hidden>; `forma_pago_cruce`<select>[14: 02=Cheque propio, 03=Cheque certificado, 04=Cheque de gerencia, 05=Cheque del exterior, 06=Débito de cuenta, 07=Transferencia propio banc, 08=Transferencia otro banco , 09=Transferencia banco exter, …]; `descripcion`<textarea>; `documento_template-id`<hidden>; `documento_template-documento_id`<hidden>; `documento_template-valor_pago`; `anticipo_template-anticipo_id`<hidden>; `anticipo_template-valor_pago`; `cuenta_template-cuenta`<hidden>; `cuenta_template-persona_id`<hidden>; `cuenta_template-valor_pago`; `notificacion_correo`<checkbox>
- Tabla:  | Documento | Fecha Emisión | Tipo Documento | Valor | Saldo | Valor a Pagar
- Tabla:  | Anticipo | Fecha Emisión | Valor | Saldo | Valor a Pagar
- Tabla:  | Cuenta Contable | Persona | Valor a Pagar

#### `registro/transaccion/registrar/?masivo=1` — Registrar Cobro/Pago Masivo
Secciones: Registrar Cobro/Pago Masivo · Información · Información de la Transacción · Notificación Pagos Masivos
- Form `transaccion_form` POST: `id`<hidden>; `pago_masivo`<hidden>; `documentos`<hidden>; `tipo_transaccion`<select>[2: C=Cobro, P=Pago]; `anulado`<checkbox>; `forma_cobro`<select>[5: CAJA=Caja, CAJACHEQUE=Cheque, TRANSF=Transferencia, TC=Tarjeta de Crédito, ELEC=Dinero electrónico]; `forma_pago`<select>[5: CHEQUE=Cheque, TRANSF=Transferencia, CAJA CHICA=Caja Chica, TC=Tarjeta de Crédito, ELEC=Dinero electrónico]; `forma_pago_transferencia`<select>[6: 06=Débito de cuenta, 07=Transferencia propio banc, 08=Transferencia otro banco , 09=Transferencia banco exter, 20=Pago Ventanilla - Cheque , 21=Pago Ventanilla - Efectiv]; `forma_pago_tarjeta`<select>[2: 10=Tarjeta de crédito nacion, 11=Tarjeta de crédito intern]; `forma_pago_cheque`<select>[4: 02=Cheque propio, 03=Cheque certificado, 04=Cheque de gerencia, 05=Cheque del exterior]; `fecha_emision`; `nombre_persona`; `cuenta_id`<hidden>; `cuenta_bancaria_id`<hidden>; `numero_comprobante`; `check_efectivo`<checkbox>; `numero_cheque`; `fecha_cheque`; `lote`<hidden>; `tipo_tarjeta`<select>[25: ---------, 12=American Débito, 4=American Express, 23=American Guayaquil, 6=CrediTosi, 5=Cuota Facil, 3=Diners Club, 14=Dinners Club Pichincha, …]; `descripcion`<textarea>; `documento_template-persona_id`<hidden>; `documento_template-id`<hidden>; `documento_template-documento_id`<hidden>; `documento_template-valor_pago`; `notificacion_correo`<checkbox>
- Tabla:  | Persona | Documento | Fecha Emisión | Tipo Documento | Valor | Saldo | Valor a Pagar

#### `registro/transaccion/?tipo=R` — Consultar Cobros/Pagos
Secciones: Consultar Cobros/Pagos · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `tipo_forma_cobro_filter`<hidden>; `tipo_forma_pago_filter`<hidden>; `numero_documento`; `fecha_inicio`; `numero_comprobante_generado`; `fecha_fin`; `numero_comprobante_anticipo`; `fecha_cheque`; `persona`<hidden>; `persona_filter`<hidden>; `tipo`<select>[7: Todos, C=Cobro, P=Pago, PM=Pago Masivo, CM=Cobro Masivo, CPM=Cobro/Pago Masivo, R=Cruce]; `numero_cheque`; `otros`<checkbox>; `centro_costo`<hidden>; `centro_costo_filter`<hidden>; `postfechados_fecha_fin`; `reposicionado`<select>[3: Todos, 1=SI, 0=NO]; `depositado`<select>[3: Todos, 1=Si, 0=No]; `cuenta_afectada`<hidden>; `cuenta_filter`<hidden>
- Tabla:  | Emisión | # Comprobante | Persona | Transacción | Cuenta | Total | Acciones

#### `registro/transaccion/?tipo=P&forma_pago=CAJA CHICA` — (sin título)

### Reportes

#### `reportes/ats/` — Generar ATS
Secciones: Generar ATS · Búsqueda · Descargar ATS
- Form `(sin id)` POST: `reporte`<hidden>; `email`<hidden>; `tipo`<select>[2: M=Mensual, S=Semestral]; `mes`<select>[12: 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, 8=Agosto, …]; `periodo`<select>[2: 6=Enero - Junio, 12=Julio - Diciembre]; `anio`; `excluir_332`<checkbox>
- Form `(fuera de form)` : `email_modal`<email>*

#### `reportes/balance_comprobacion/` — Balance de Comprobación
Secciones: Balance de Comprobación · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `cuenta`<hidden>; `fecha_inicio`; `fecha_fin`

#### `reportes/balance_general/` — Estado de Situación Financiera
Secciones: Estado de Situación Financiera · Búsqueda
- Form `(sin id)` POST: `filtro`<select>[4: AC=Año en curso, AP=Año pasado, MP=Mes pasado, PF=Por fecha]; `fecha_corte`; `vista`<select>[4: GE=General, SE=Semestral, TR=Trimestral, ME=Mensual]; `filtro-nivel`<select>[6: 1, 2, 3, 4, 5, -1=Todos]; `centro_costo`<hidden>

#### `reportes/bitacora_importacion/` — Bitácora Importación
Secciones: Bitácora Importación · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `producto_id`<hidden>; `fecha_inicio`; `importacion`<hidden>; `fecha_fin`; `codigo_movimiento`; `tipo`<select>[5: Todos, ING=Ingreso, EGR=Egreso, TRA=Traslado, AJU=Ajuste de Costo]

#### `reportes/comparativo_asientos/` — Movimientos vs. Asientos Contables
Secciones: Movimientos vs. Asientos Contables · Búsqueda
- Form `(sin id)` POST · exports: excel: `categoria_id`<hidden>; `cuenta_id`<hidden>; `anio`; `mes`<select>[12: 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, 8=Agosto, …]; `tipo_mov`<select>[3: Todos, ING=Ingresos, EGR=Egresos]; `origen_asi`<select>[3: Todos, M=Manual, G=Generado]

#### `reportes/compras_ventas/` — Compras y Ventas
Secciones: Compras y Ventas · Búsqueda
- Form `(sin id)` POST · exports: excel, excel_detallado: `tipo`<select>[2: M=Mensual, S=Semestral]; `mes`<select>[13: 0=Todos, 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, …]; `semestre`<select>[2: 1=Primer Semestre, 2=Segundo Semestre]; `anio`

#### `reportes/control_anticipos/` — Control de Anticipos
Secciones: Control de Anticipos · Búsqueda · Anticipos de Clientes · Total: · $0.00
- Form `(sin id)` GET · exports: excel_cobrar, excel_pagar: `excel_cobrar_detallado`<hidden>; `excel_pagar_detallado`<hidden>; `fecha_corte`; `categoria`<hidden>
- Tabla: Cliente | 30 días | 60 días | 90 días | 120 días | > 120 días | Total
- Tabla: Proveedor | 30 días | 60 días | 90 días | 120 días | > 120 días | Total

#### `reportes/control_cartera_op/` — Control de Cartera
Secciones: Control de Cartera · Búsqueda
- Form `(sin id)` GET · exports: excel_cobrar, excel_pagar: `excel_cobrar_detallado`<hidden>; `excel_pagar_detallado`<hidden>; `vista`<select>[2: G=General, M=Mensual]; `fecha_corte`; `categoria`<hidden>; `centro_costo`<hidden>; `tipo`<select>[3: sin_tipo=-- Seleccionar tipo, ctasxc=Cuentas por cobrar, ctasxp=Cuentas por pagar]; `incluir_consumidor_final`<checkbox>; `vendedor`<hidden>; `tipo_consulta`<select>[2: 1=Saldos vencidos, 2=Saldos por vencer]

#### `reportes/cuentas/` — Consulta de Movimientos por Cuenta
Secciones: Consulta de Movimientos por Cuenta · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `cuenta`<hidden>; `fecha_inicio`; `centro_costo`<hidden>; `fecha_fin`; `proyecto`<hidden>

#### `reportes/dinardap/` — Generar Reporte DINARDAP
Secciones: Generar Reporte DINARDAP · Búsqueda
- Form `(sin id)` POST · exports: excel: `reporte`<hidden>; `fecha_corte`

#### `reportes/estado_perdidas_ganancias/` — Estado de Resultados
Secciones: Estado de Resultados · Búsqueda
- Form `(sin id)` POST: `proyecto`<hidden>; `centro_costo`<hidden>; `filtro-nivel`<select>[6: 1, 2, 3, 4, 5, -1=Todos]; `tipo`<select>[4: N=General, D=Gravables/Deducibles, ND=No Gravables/Deducibles, T=General Segmentado]; `vista`<select>[4: GE=General, SE=Semestral, TR=Trimestral, ME=Mensual]; `filtro`<select>[5: AC=Año en curso, AP=Año pasado, MA=Mes actual, MP=Mes pasado, PF=Por fecha]; `fecha_inicio`; `fecha_fin`

#### `reportes/flujo_caja/` — Flujo de Caja
Secciones: Flujo de Caja · Búsqueda
- Form `(sin id)` POST: `filtro`<select>[3: M=Mensual, A=Anual, F=Por fecha]; `fecha_inicio`; `fecha_fin`; `anio`; `mes`<select>[12: 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, 8=Agosto, …]; `vista`<select>[2: N=Normal, E=Extendido]; `centro_costo`<hidden>; `proyecto`<hidden>

#### `reportes/formularios103/` — Consultar Formularios 103
Secciones: Consultar Formularios 103 · Búsqueda
- Form `(sin id)` GET: `pagina`<hidden>; `anio`; `tipo`<select>[2: M=Mensual, S=Semestral]; `mes`<select>[13: Todos, 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, …]; `semestre`<select>[3: Todos, 13=Primer Semestre, 14=Segundo Semestre]; `tipo_declaracion`<select>[3: Todos, O=Original, S=Sustitutiva]; `num_formulario_sustituye`
- Tabla: Año | Periodo | Tipo Declaración | Forma de Pago | Banco | Valor a Pagar

#### `reportes/formularios104/` — Consultar Formularios 104
Secciones: Consultar Formularios 104 · Búsqueda
- Form `(sin id)` GET: `pagina`<hidden>; `anio`; `tipo`<select>[2: M=Mensual, S=Semestral]; `mes`<select>[13: Todos, 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, …]; `semestre`<select>[3: Todos, 13=Primer Semestre, 14=Segundo Semestre]; `tipo_declaracion`<select>[3: Todos, O=Original, S=Sustitutiva]; `num_formulario_sustituye`
- Tabla: Año | Periodo | Tipo Declaración | Forma de Pago | Banco | Valor a Pagar

#### `reportes/gastos_no_deducibles/` — Gastos no Deducibles
Secciones: Gastos no Deducibles · Filtro · Total: · $13,785.90
- Form `(sin id)` GET: `filtro`<select>[2: AC=Año en curso, AP=Año pasado]

#### `reportes/log_extendido/` — Log de Actividades
Secciones: Log de Actividades · Búsqueda
- Form `(sin id)` GET · exports: excel: `pagina`<hidden>; `imprimir`<hidden>; `usuario`<hidden>; `usuario_filtro`<hidden>; `fecha_inicio`; `pantalla`<select>[24: Todas, 17=Ejercicio Contable, 19=Cuenta Contable, 56=Centro de Costo, 16=Persona, 20=Asiento Contable, 22=Documento, 96=Proyecto, …]; `pantalla_filtro`<hidden>; `fecha_fin`; `actividad`; `rol`<select>[8: Todas, A=Administrador, S=Asistente Contable, D=Digitador, V=Vendedor, L=Cliente, T=Agente, C=Contador]; `tipoActividad`<select>[1: [[tipo.value]]]
- Tabla: Fecha | Usuario | Actividad

#### `reportes/margen_bruto/` — Reporte de Costos de Venta
Secciones: Reporte de Costos de Venta · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `consulta`<hidden>; `mes`<select>[12: 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, 8=Agosto, …]; `anio`; `categoria_producto_id`<hidden>; `bodega_id`<hidden>; `producto_id`<hidden>

#### `reportes/movimientos_inventario/` — KARDEX
Secciones: KARDEX · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `producto_id`<hidden>; `fecha_inicio`; `bodega_id`<hidden>; `fecha_fin`; `codigo_movimiento`; `tipo`<select>[5: Todos, ING=Ingreso, EGR=Egreso, TRA=Traslado, AJU=Ajuste de Costo]

#### `reportes/panel/` — (sin título)
Secciones: Cuentas para el cálculo de Liquidez · Cálculo de los Días de Pago · Cálculo de los Días de Cobro
- Form `(fuera de form)` : `cuenta_activo_corriente`<hidden>; `cuenta_pasivo_circulante`<hidden>
- Form `(fuera de form)` : `cuenta_pasivo`<hidden>; `cuenta_activo`<hidden>

#### `reportes/personalizados_comprasventas/` — Compras/Ventas (Personalizado)
Secciones: Compras/Ventas (Personalizado) · Búsqueda
- Form `(sin id)` GET · exports: excel, excel_por_producto, pdf: `pagina`<hidden>; `filtro`
- Tabla: Fecha Creación | Fecha Modificación | Nombre | Agrupado | Acciones

#### `reportes/reporte_cartera_contabilidad/` — Cartera vs. Contabilidad
Secciones: Cartera vs. Contabilidad · Búsqueda
- Form `report_form` GET · exports: excel: `tipo`<select>[3: sin_tipo=-- Seleccionar tipo, ctasxc=Cuentas por cobrar, ctasxp=Cuentas por pagar]; `fecha_inicio`; `cuenta`<hidden>; `fecha_corte`

#### `reportes/resumen/` — (sin título)
Secciones: Cuentas para el cálculo de Liquidez · Cálculo de los Días de Pago · Cálculo de los Días de Cobro
- Form `(fuera de form)` : `cuenta_activo_corriente`<hidden>; `cuenta_pasivo_circulante`<hidden>
- Form `(fuera de form)` : `cuenta_pasivo`<hidden>; `cuenta_activo`<hidden>

#### `reportes/saldos_disponible/` — Reporte de Saldos Disponible
Secciones: Reporte de Saldos Disponible · Búsqueda
- Form `(sin id)` GET · exports: excel, excel_personalizado, excel_saldos_por_bodega, pdf: `pagina`<hidden>; `consulta`<hidden>; `categoria_producto_id`<hidden>; `fecha_inicio`; `producto_id`<hidden>; `fecha_corte`; `bodega_id`<hidden>; `mostrar_cero`<checkbox>

#### `reportes/saldos_inventario/` — Reporte de Saldos de Inventario
Secciones: Reporte de Saldos de Inventario · Búsqueda
- Form `(sin id)` GET · exports: excel, excel_personalizado, excel_saldos_por_bodega, pdf: `pagina`<hidden>; `consulta`<hidden>; `categoria_producto_id`<hidden>; `fecha_corte`; `producto_id`<hidden>; `bodega_id`<hidden>; `mostrar_serie`<checkbox>; `filtro`; `mostrar_inactivos`<checkbox>

#### `reportes/ventas_gerencial/` — (sin título)
Secciones: Búsqueda
- Form `(sin id)` POST: `vista_grafico`<select>[4: AC=Año en curso, MC=Mes en curso, SC=Semana en curso, RF=Rango de Fechas]; `formato`<select>[3: unidad=Unidad, moneda=Moneda, unidadmoneda=Unidad-Moneda]; `fecha_inicio`; `fecha_fin`; `categoria_id`<hidden>; `producto_id`<hidden>; `centro_costo_id`<hidden>; `cuenta_id`<hidden>; `cliente_id`<hidden>; `proyecto_id`<hidden>

#### `reportes/ventas_gerencial_detalle/` — Ventas por Productos/Servicios
Secciones: Ventas por Productos/Servicios · Búsqueda
- Form `(sin id)` POST · exports: excel: `visualizacion`<select>[2: por_producto=Por productos/s, por_categoria=Por categoría]; `vista_grafico`<select>[4: AC=Año en curso, MC=Mes en curso, SC=Semana en curso, RF=Rango de Fechas]; `agrupacion`<select>[4: DF=-, TR=Trimestral, ME=Mensual, DI=Diario]; `formato`<select>[3: unidad=Unidad, moneda=Moneda, unidadmoneda=Unidad-Moneda]; `orden`<select>[2: total_vendido=Total, alfabetico=Nombre de product]; `fecha_inicio`; `fecha_fin`; `categoria_id`<hidden>; `producto_id`<hidden>; `centro_costo_id`<hidden>; `cuenta_id`<hidden>; `cliente_id`<hidden>; `proyecto_id`<hidden>
- Tabla: Producto | Moneda | Unidad | %Moneda | %Unidad
- Tabla: Cuenta | Moneda | Unidad | %Moneda | %Unidad

#### `reportes/ventas_nuevo/` — Reporte de Ventas
Secciones: Reporte de Ventas · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `tipo`<select>[3: F=Fecha, C=Cierre de Caja POS, O=Cierre de Caja Online]; `caja_id`<hidden>; `caja_online_id`<hidden>; `fecha_desde`; `fecha_hasta`; `categoria_id`<hidden>; `producto_id`<hidden>; `centro_costo_id`<hidden>; `cliente_id`<hidden>; `tipo_grafico`<select>[2: P=Producto, C=Categoria Producto]

#### `reportes/ventas_semanal/` — Ventas semanal
Secciones: Ventas semanal · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `categoria_producto_id`<hidden>; `producto_id`<hidden>; `formato`<select>[2: unidad=Unidad, moneda=Moneda]; `semana`<select>[3: SC=Semana Actual, SA=Semana Anterior, DD=Específica]; `fecha`
- Tabla: Bodega | Lun | Mar | Mie | Jue | Vie | Sab | Dom | TOTAL Semanal | # Transacciones | Ticket Promedio

#### `reportes/ventas_vendedor/` — Reporte de Ventas por Vendedor
Secciones: Reporte de Ventas por Vendedor · Búsqueda
- Form `(fuera de form)` : `tipo_reporte`<hidden>
- Form `(sin id)` POST · exports: excel: `desde`; `hasta`; `producto_id`<hidden>; `cliente_id`<hidden>; `categoria_id`<hidden>; `centro_costo_id`<hidden>; `perfil`<select>[2: V=Vendedor, 1=NOTA]
- Form `(fuera de form)` : `tipo_visualizacion`<hidden>; `tipo_filtro`<hidden>
- Tabla: Vendedor | # Facturas | Prom. ventas documento | Cant. artículos vendidos | Cant. articulos por fact | Precio por artículo | Total

### RRHH / Nómina

#### `rrhh/configuraciones/` — Configuración RRHH
Secciones: Configuración RRHH · Guardando la configuración · Sueldo Básico Unificado · Agregar Cuenta Bancaria · Limpiar Configuración de Cuentas · Restablecer Cuentas · Agregar Departamento · Eliminar Departamento · Eliminar Cargo
- Form `formCuentaBancaria` POST: `cuentaBancaria`<hidden>; `tipo_cuenta`<select>[2: CA=Cuenta de Ahorros, CC=Cuenta Corriente]; `nombre`; `numero`; `cuenta_contable_id`<hidden>; `banco_codigo`<select>[60: -- Seleccionar/Buscar --, 190=ABANCA CORPORACION CORPO, 199=AUSTROBANK, 109=BAC INTERNATIONAL BANK, 104=BANCO ALIADO, 1=BANCO AMAZONAS, 31=BANCO ASISTENCIA COMUNITA, 113=BANCO AZTECA, …]; `ciudad_id`<hidden>; `formato`<hidden>; `estado`<select>[2: A=Activa, I=Inactiva]
- Form `formDepartamento` POST: `idDepartamento`<hidden>; `nombre`
- Form `(fuera de form)` : `id_eliminar_departamento`<hidden>; `nombre_eliminar_departamento`<hidden>; `id_eliminar_cargo`<hidden>; `id_eliminar_cargo_dep`<hidden>; `nombre_eliminar_cargo`<hidden>; `id_eliminar_departamento`<hidden>; `nombre_eliminar_departamento`<hidden>
- Form `formDepartamentomod` POST: `id_modificar_departamento`<hidden>; `nombre_modificar_departamento`<hidden>; `nombre`
- Form `formGenerales` POST: `rrhh_formapago_mensual`<checkbox>; `dia_pago`; `rrhh_formapago_quincenal`<checkbox>; `porcentaje_quincena`; `porcentaje_iess`<select>[2: 0.0935=9.35%, 0.0945=9.45%]; `porcentaje_ext_conyugal`; `correo_copia_rol`; `cuenta_bancaria_rrhh`<hidden>; `motivo_bco_guayaquil`; `motivo_bco_bolivariano`; `cta_ingreso_sueldo_adm`<hidden>; `cta_ingreso_alim_adm`<hidden>; `cta_ingreso_tran_adm`<hidden>; `cta_ingreso_viv_adm`<hidden>; `cta_ingreso_com_adm`<hidden>; `cta_ingreso_hor_adm`<hidden>; `cta_ingreso_bon_adm`<hidden>; `cta_ingreso_otr_adm`<hidden>; `cta_ingreso_dev_ben_soc_adm`<hidden>; `cta_ingreso_dev_diaslab_mul_adm`<hidden>; `cta_anticipos_adm`<hidden>; `cta_egreso_desc_adm`<hidden>; `cta_egreso_mul_adm`<hidden>; `cta_egreso_aus_adm`<hidden>; `cta_egreso_com_adm`<hidden>; `cta_egreso_far_adm`<hidden>; `cta_egreso_seg_adm`<hidden>; `cta_egreso_cel_adm`<hidden>; `cta_egreso_diashrs_nolab_adm`<hidden>; `cta_pres_quiro_adm`<hidden>; `cta_pres_hipo_adm`<hidden>; `cta_pres_per_adm`<hidden>; `cta_egreso_otr_adm`<hidden>; `cta_egreso_imp_adm`<hidden>; `cta_sueldos_pagar_adm`<hidden>; `cta_decimo_tercer_pasivo_adm`<hidden>; `cta_decimo_tercer_gasto_adm`<hidden>; `cta_decimo_cuarto_pasivo_adm`<hidden>; `cta_decimo_cuarto_gasto_adm`<hidden>; `cta_ingreso_fre_pasivo_adm`<hidden>; `cta_ingreso_fre_adm`<hidden>; `cta_ingreso_vac_pasivo_adm`<hidden>; `cta_ingreso_vac_adm`<hidden>; `cta_iess_adm`<hidden>; `cta_conyuge_iess_adm`<hidden>; `cta_aportes_pasivo_adm`<hidden>; `cta_aportes_gasto_adm`<hidden>; `cta_secap_pasivo_adm`<hidden>; `cta_secap_gasto_adm`<hidden>; `cta_ingreso_sueldo_vta`<hidden>; `cta_ingreso_alim_vta`<hidden>; `cta_ingreso_tran_vta`<hidden>; `cta_ingreso_viv_vta`<hidden>; `cta_ingreso_com_vta`<hidden>; `cta_ingreso_hor_vta`<hidden>; `cta_ingreso_bon_vta`<hidden>; `cta_ingreso_otr_vta`<hidden>; `cta_ingreso_dev_ben_soc_vta`<hidden>; `cta_ingreso_dev_diaslab_mul_vta`<hidden>; `cta_anticipos_vta`<hidden>; `cta_egreso_desc_vta`<hidden>; `cta_egreso_mul_vta`<hidden>; `cta_egreso_aus_vta`<hidden>; `cta_egreso_com_vta`<hidden>; `cta_egreso_far_vta`<hidden>; `cta_egreso_seg_vta`<hidden>; `cta_egreso_cel_vta`<hidden>; `cta_egreso_diashrs_nolab_vta`<hidden>; `cta_pres_quiro_vta`<hidden>; `cta_pres_hipo_vta`<hidden>; `cta_pres_per_vta`<hidden>; `cta_egreso_otr_vta`<hidden>; `cta_egreso_imp_vta`<hidden>; `cta_sueldos_pagar_vta`<hidden>; `cta_decimo_tercer_pasivo_vta`<hidden>; `cta_decimo_tercer_gasto_vta`<hidden>; `cta_decimo_cuarto_pasivo_vta`<hidden>; `cta_decimo_cuarto_gasto_vta`<hidden>; `cta_ingreso_fre_pasivo_vta`<hidden>; `cta_ingreso_fre_vta`<hidden>; `cta_ingreso_vac_pasivo_vta`<hidden>; `cta_ingreso_vac_vta`<hidden>; `cta_iess_vta`<hidden>; `cta_conyuge_iess_vta`<hidden>; `cta_aportes_pasivo_vta`<hidden>; `cta_aportes_gasto_vta`<hidden>; `cta_secap_pasivo_vta`<hidden>; `cta_secap_gasto_vta`<hidden>; `cta_ingreso_sueldo_cto`<hidden>; `cta_ingreso_alim_cto`<hidden>; `cta_ingreso_tran_cto`<hidden>; `cta_ingreso_viv_cto`<hidden>; `cta_ingreso_com_cto`<hidden>; `cta_ingreso_hor_cto`<hidden>; `cta_ingreso_bon_cto`<hidden>; `cta_ingreso_otr_cto`<hidden>; `cta_ingreso_dev_ben_soc_cto`<hidden>; `cta_ingreso_dev_diaslab_mul_cto`<hidden>; `cta_anticipos_cto`<hidden>; `cta_egreso_desc_cto`<hidden>; `cta_egreso_mul_cto`<hidden>; `cta_egreso_aus_cto`<hidden>; `cta_egreso_com_cto`<hidden>; `cta_egreso_far_cto`<hidden>; `cta_egreso_seg_cto`<hidden>; `cta_egreso_cel_cto`<hidden>; `cta_egreso_diashrs_nolab_cto`<hidden>; `cta_pres_quiro_cto`<hidden>; `cta_pres_hipo_cto`<hidden>; `cta_pres_per_cto`<hidden>; `cta_egreso_otr_cto`<hidden>; `cta_egreso_imp_cto`<hidden>; `cta_sueldos_pagar_cto`<hidden>; `cta_decimo_tercer_pasivo_cto`<hidden>; `cta_decimo_tercer_gasto_cto`<hidden>; `cta_decimo_cuarto_pasivo_cto`<hidden>; `cta_decimo_cuarto_gasto_cto`<hidden>; `cta_ingreso_fre_pasivo_cto`<hidden>; `cta_ingreso_fre_cto`<hidden>; `cta_ingreso_vac_pasivo_cto`<hidden>; `cta_ingreso_vac_cto`<hidden>; `cta_iess_cto`<hidden>; `cta_conyuge_iess_cto`<hidden>; `cta_aportes_pasivo_cto`<hidden>; `cta_aportes_gasto_cto`<hidden>; `cta_secap_pasivo_cto`<hidden>; `cta_secap_gasto_cto`<hidden>; `cta_ingreso_sueldo_otr`<hidden>; `cta_ingreso_alim_otr`<hidden>; `cta_ingreso_tran_otr`<hidden>; `cta_ingreso_viv_otr`<hidden>; `cta_ingreso_com_otr`<hidden>; `cta_ingreso_hor_otr`<hidden>; `cta_ingreso_bon_otr`<hidden>; `cta_ingreso_otr_otr`<hidden>; `cta_ingreso_dev_ben_soc_otr`<hidden>; `cta_ingreso_dev_diaslab_mul_otr`<hidden>; `cta_anticipos_otr`<hidden>; `cta_egreso_desc_otr`<hidden>; `cta_egreso_mul_otr`<hidden>; `cta_egreso_aus_otr`<hidden>; `cta_egreso_com_otr`<hidden>; `cta_egreso_far_otr`<hidden>; `cta_egreso_seg_otr`<hidden>; `cta_egreso_cel_otr`<hidden>; `cta_egreso_diashrs_nolab_otr`<hidden>; `cta_pres_quiro_otr`<hidden>; `cta_pres_hipo_otr`<hidden>; `cta_pres_per_otr`<hidden>; `cta_egreso_otr_otr`<hidden>; `cta_egreso_imp_otr`<hidden>; `cta_sueldos_pagar_otr`<hidden>; `cta_decimo_tercer_pasivo_otr`<hidden>; `cta_decimo_tercer_gasto_otr`<hidden>; `cta_decimo_cuarto_pasivo_otr`<hidden>; `cta_decimo_cuarto_gasto_otr`<hidden>; `cta_ingreso_fre_pasivo_otr`<hidden>; `cta_ingreso_fre_otr`<hidden>; `cta_ingreso_vac_pasivo_otr`<hidden>; `cta_ingreso_vac_otr`<hidden>; `cta_iess_otr`<hidden>; `cta_conyuge_iess_otr`<hidden>; `cta_aportes_pasivo_otr`<hidden>; `cta_aportes_gasto_otr`<hidden>; `cta_secap_pasivo_otr`<hidden>; `cta_secap_gasto_otr`<hidden>; `cargos_mod_agr`<hidden>; `step_actual`<hidden>

#### `rrhh/consultar_periodos_beneficios/` — Consultar Plantillas Décimos
Secciones: Consultar Plantillas Décimos · Búsqueda
- Form `periodospagosbeneficios` GET: `pagina`<hidden>; `tipo_contrato_persona`<hidden>; `id`<hidden>; `tipo_beneficio`<select>[3: -1=-- Seleccionar --, D3=DÉCIMO TERCERO, D4=DÉCIMO CUARTO]; `fecha_ini`; `fecha_fin`

#### `rrhh/movimientos/consultar_movimientos/` — Movimientos RRHH
Secciones: Movimientos RRHH · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `persona_id`<hidden>; `fecha_inicio`; `numero_comprobante`; `fecha_fin`; `cuenta_bancaria`<select>[10: 30463=BANCO PRODUBANCO CC <n, 30925=BANCO PICHINCHA CC <nr, 31178=BANCO PRODUBANCO CC DA, 39526=BANCO GUAYAQUIL CC <nr, 42162=BANCO DEUNA, 42843=Banco Produbanco, 43184=Banco JUSTO, …]; `tipo`<select>[3: Todos, C=Cheque, T=Transferencia]; `mes`<select>[13: Todos, 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, …]; `anio`
- Tabla:  | Emisión | Persona | Período | Tipo | # Comprobante | Valor | 

#### `rrhh/pago/agregar_descuento/?tipo_conf=RPM` — Registrar Préstamo
Secciones: Registrar Préstamo · Datos Generales
- Form `frm_prestamo` POST: `id`<hidden>; `tipo_conf`<hidden>; `empleado_id`<hidden>; `valor_mensual`; `nombre`; `plazo`; `tipo`<select>[11: A=ANTICIPO, H=HIPOTECARIO, Q=QUIROGRAFARIO, P=PERSONAL, I=IMP. RENTA, L=CELULAR, S=SEGURO, C=COMISARIATO, …]; `valor_total`; `fecha_emision`; `tipo_pago`<select>[3: N=NO PAGO, B=CHEQUE, T=TRANSFERENCIA]; `fecha_pago_ini`; `cuenta_bancaria`<select>[7: 30463=BANCO PRODUBANCO CC <n, 30925=BANCO PICHINCHA CC <nr, 42162=BANCO DEUNA, 42843=Banco Produbanco, 43184=Banco JUSTO, 43424=Banco Internacional, 43503=Banco Bolivariano CC <]; `comprobante`; `descripcion`<textarea>

#### `rrhh/pago/registrar_pago/?tipo_rol=RPQ` — Registrar Roles de Pago
Secciones: Registrar Roles de Pago · Período de Pago · Empleados · Datos Electrónicos · Eliminación de Rubros · Tipo de Pago Masivo · Extensión Conyugal
- Form `frm_empleados` POST → /sistema/rrhh/pago/registrar_pago/ · exports: excel: `seleccionar`<hidden>; `guardar`<hidden>; `guardar_rubros_masivos`<hidden>; `id_reg_quincena`<hidden>; `col_mostrar_asistencias`<hidden>; `tipo_rol`<hidden>; `tipo_contrato_persona`<hidden>; `proceso_individual`<hidden>; `preliminar`<hidden>; `generar_sin_ret`<hidden>; `generar_lc_ret_elect`<hidden>; `extras_ext_conyugal`<checkbox>; `tipo_quincena_ps`<hidden>; `anio`; `mes`<select>[12: 1=Enero, 2=Febrero, 3=Marzo, 4=Abril, 5=Mayo, 6=Junio, 7=Julio, 8=Agosto, …]; `quincena`<select>[2: 1Q=Primera Quincena, 2Q=Segunda Quincena]; `fecha`; `chk_seleccionar_todos`<checkbox>
- Form `(fuera de form)` : `tipo_ingreso`<hidden>; `tipo_pago_masivo`<select>[3: B=CHEQUE, T=TRANSFERENCIA, N=PENDIENTE]
- Tabla: # |  | Empleado | Ingresos | Otros Ingresos | Egresos | Otros Egresos | Días Lab. | Total | Tipo de Pago | Cta. Bancaria | Acciones | Estado Proceso

#### `rrhh/periodo_pagos_beneficios/` — Registrar Pagos Beneficio
Secciones: Registrar Pagos Beneficio · Período · Detalle Acumulado
- Form `frm_filtros_beneficios` : `pagina`<hidden>; `id`<hidden>; `tipo_beneficio`<select>[3: -1=-- Seleccionar --, D3=DÉCIMO TERCERO, D4=DÉCIMO CUARTO]; `fecha_ini`; `fecha_fin`; `fecha_emision`

#### `rrhh/periodos/` — Consultar Roles
Secciones: Consultar Roles · Búsqueda · Bloqueada · Configuración RRHH
- Form `(sin id)` GET: `pagina`<hidden>; `tipo_contrato_persona`<hidden>; `fecha_inicio`; `fecha_fin`; `tipo_rol`<select>[2: RPM=Mensual, RPQ=Quincenal]; `estado`<select>[3: -1=Todas, C=Creadas, G=Generadas]

#### `rrhh/prestamos/` — Préstamos
Secciones: Préstamos · Búsqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `persona`<hidden>; `fecha_inicio`; `filtro`; `fecha_fin`; `tipo`<select>[12: Todos, A=ANTICIPO, H=HIPOTECARIO, Q=QUIROGRAFARIO, P=PERSONAL, I=IMP. RENTA, L=CELULAR, S=SEGURO, …]; `tipo_configuracion`<select>[2: RPM=Mensual, RPS=Semanal]; `estado`<select>[3: -1=Todos, P=PENDIENTE, G=PAGADO]
- Tabla: Fecha Emisión | Fecha Inicio Pago | Tipo | Nombre | Persona | V. Mensual | Plazo Meses | Total | Estado | Acciones

### Tarjeta de crédito

#### `tarjeta_credito/comercio/` — Redes de Cobros de Tarjeta de Crédito
Secciones: Redes de Cobros de Tarjeta de Crédito
- Tabla: Código | Red | Descripción | 

#### `tarjeta_credito/liquidacion/` — Consultar Liquidaciones de Tarjetas de Crédito
Secciones: Consultar Liquidaciones de Tarjetas de Crédito · Búsqueda
- Form `(sin id)` GET · exports: excel_detallado: `pagina`<hidden>; `numero_documento`; `fecha_inicio`; `proveedor`<hidden>; `fecha_fin`; `banco`<hidden>; `lote`; `comercio`<select>[44: Todos, 19570=Cuenta por Cobrar (Tar, 20072=Cuenta por Cobrar (Tar, 19564=Cuenta por Cobrar (Tar, 20070=Cuenta por Cobrar (Tar, 19568=Cuenta por Cobrar (Tar, 20071=Cuenta por Cobrar (Tar, 32117=DataExpress - Simon Bo, …]
- Tabla: Fecha | Documento | Proveedor | Banco | Total | Acciones

#### `tarjeta_credito/liquidacion/registrar/` — Registrar Liquidación de Tarjeta de Crédito
Secciones: Registrar Liquidación de Tarjeta de Crédito · Datos Generales · Firmar Documento
- Form `(sin id)` POST: `id`<hidden>; `excluir_secuencia_retencion`<hidden>; `fecha_liquidacion`; `aplica_iva_12`<checkbox>; `porcentaje_iva`<select>[1: ]; `tipo`<select>[4: FAC=Liquidación por Factura, NCT=Liquidación por Nota de , FCO=Factura de Comisión, EIF=Documento Emitido por In]; `enviar_iva_gasto`<checkbox>; `proveedor`<hidden>; `banco`<hidden>; `numero_documento`; `autorizacion`; `cuenta_comision`<hidden>; `centro_costo`<hidden>; `cuenta_comision_porliquidar`<hidden>; `comision`; `comision_0`; `comision_no_objeto`; `comision_iva`; `comision_fija`; `tipo_cuenta_id`<hidden>; `tipo_retencion_ir_id`<hidden>; `tipo_retencion_iva_id`<hidden>; `lote_template-fecha`; `lote_template-num_recap`; `lote_template-cuenta_id`<hidden>; `lote_template-deposito`; `lote_template-comision`; `lote_template-comision_iva`; `lote_template-base_ret_ir`; `lote_template-base_ret_iva`; `lote_template-tipo_retencion_ir_id`<hidden>; `lote_template-tipo_retencion_iva_id`<hidden>; `lote_template-a_pagar`; `fecha_emision_retencion`; `tipo_retencion`<select>[2: F=Física, E=Electrónica]; `numero_documento_retencion`; `establecimiento_retencion`<select>[1: 001]; `punto_emision_retencion`; `retencion_iva_template-num_recap`<hidden>; `retencion_iva_template-fecha_emision_retencion`; `retencion_iva_template-numero_documento_retencion`; `retencion_iva_template-autorizacion_retencion`; `retencion_iva_template-tipo`<hidden>; `retencion_iva_template-codigo_sri`; `retencion_iva_template-base`; `retencion_iva_template-porcentaje`; `retencion_iva_template-valor`; `retencion_template-num_recap`<hidden>; `retencion_template-fecha_emision_retencion`; `retencion_template-numero_documento_retencion`; `retencion_template-autorizacion_retencion`; `retencion_template-tipo`<hidden>; `retencion_template-codigo_sri`; `retencion_template-base`; `retencion_template-porcentaje`; `retencion_template-valor`
- Form `frm_firmar` POST → /sistema/registro/documento/firmar/: `desde_retencion`<hidden>; `receptor`
- Tabla:  | Fecha | # RECAP | Cuenta | Depósito | Comisión | IVA | Base Ret. IR | Base Ret. IVA | Ret. IR | Ret. IVA | A pagar
- Tabla: Fecha Emision | Número Retención | Autorización | Tipo | Cod.SRI | Base | % | Valor

#### `tarjeta_credito/lote/` — Consultar Lotes de Tarjetas de Crédito
Secciones: Consultar Lotes de Tarjetas de Crédito · Busqueda
- Form `(sin id)` GET · exports: excel, pdf: `pagina`<hidden>; `codigo`; `fecha_desde`; `documento`; `fecha_hasta`; `comercio`<select>[44: Todos, 19570=Cuenta por Cobrar (Tar, 20072=Cuenta por Cobrar (Tar, 19564=Cuenta por Cobrar (Tar, 20070=Cuenta por Cobrar (Tar, 19568=Cuenta por Cobrar (Tar, 20071=Cuenta por Cobrar (Tar, 32117=DataExpress - Simon Bo, …]; `estado`<select>[4: T=Todos, L=Liquidado, S=Pendiente (Sobrante), F=Pendiente (Faltante)]; `red`<select>[11: Todos, 1=Datafast, 2=Medianet, 3=Red de Apoyo, 4=DataExpress, 5=Placetopay, 6=Alignet, 7=Paymentez, …]
- Tabla: RECAP | POS | Red | Fecha | No. Vales | Total Cobrado | Total Liquidado | Diferencia | Estado | Acciones


## Endpoints AJAX y selectores

Ver `evidencia/ajax-urls.tsv` (1,349 URLs internas referenciadas por el JS de las pantallas, con las pantallas que las usan). Los selectores `*/seleccionar/` devuelven HTML con `selectObj(<pk>)` por fila y aceptan `?filtro=`; los `json/` devuelven JSON.
