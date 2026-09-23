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

_Se completa con el barrido de cada URL (forms, selects, tablas). Ver fichas 02–12._
