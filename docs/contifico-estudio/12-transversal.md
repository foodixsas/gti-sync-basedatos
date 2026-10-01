# 12 · Transversal: usuarios y permisos, multiempresa, auditoría, integraciones, cuenta

Estado: 🔄 primera versión (22-sep-2026). Faltan: Mi compañía (`empresa/configuracion/`, se renderiza por JS: leer sus componentes), Log de actividades, Mi cuenta/contrato, plan contratado.

## 1. Usuarios y permisos (`empresa/configuracion/usuario/registrar/`)
- Usuario: `nombre`, `email`, `perfil` **A Administrador, S Asistente Contable, D Digitador, V Vendedor, L Cliente, T Agente, C Contador**. El perfil precarga permisos; luego se ajustan uno a uno.
- **~300 permisos atómicos** con patrón `<área>_<entidad>_<acción>`; acciones: `con` consultar, `agr` agregar, `mod` modificar, `eli` eliminar, más `gen` generar, `aprob`/`ap` aprobar, `cerrar`, `cierre_mensual`, `prod` (producir desde cotización). Áreas: `conf_*` (contabilidad: asientos, ejercicios, plan de cuentas, centros de costo), `reg_banc_*` (cheques, movimientos, anticipos, reposición, otros, conciliación, protestados), `conf_redesCobro_*`, `reg_tarj_*` (liquidación, lote), `fid_*` (niveles, segmentos, ganancia, reporte promo, gasto), `pers_*` (persona, guía), `conf_rrhh_*` (cargo, dpto, código), `pers_rrhh_*` (préstamos, quincenal con `ap`/`gen`, semanal, control de asistencia, beneficios), `impor_*` (importación, liquidación), `act_*` (activo, config, categoría, tipo, ubicación), `reg_inv_*` (movimiento, toma física con `gen`, series, producción, `inv_prod_formula_mod`), `conf_inv_*` (unidades, categorías, productos, bodegas), `reg_guia_*`, `reg_impret_*` / `reg_impfac_*` (bandeja electrónica retenciones/facturas), `conf_bandeja_compras`, `reg_compraventa_*` (documentos; variantes `_pro` proveedor, `_cot` cotización), `reg_proforma_*` (prefactura y orden con `aprob`), `reg_caja_*`, `reg_anulaciones_*`, `reg_cobrospagos_*`, `reg_deposito_*`, `rep_*` (cada reporte es un permiso: resumen general, financieros, ventas (incl. `rep_repg_ventasPos`, `rep_ticketsProducto`, `rep_repg_controlDeImpuestosSobreUtilidades`), inventario (`rep_inv_egresoscc`, `rep_inv_estimados`, `rep_inv_comp_mov_asi`), consulta cuentas, SRI (ATS, 103, 104, anexo ICE, compras/ventas), dinardap, cobros/pagos, log de actividades), `rep_per_*` (personalizados), `conf_pos_*` (generar archivos, subir ventas), `conf_firmador_*`.
- **Restricciones**: horario y días permitidos (`tiene_restriccion_horario`, `horario_inicio/fin`, `es_lunes..es_domingo`), `reg_compraventa_soloretencion`, descuento máximo (`porcentaje_maximo`), desaprobar OCV, anular retención, anular documento, editar IVA, ver historial de documentos/productos, bloquear lotes, bloquear pestañas RRHH de Persona, bloquear estado de cuenta, bloquear costo promedio, bloquear stock 0, modificar saldo gift card.
- Gestión: `empresa/configuracion/` (tab usuarios: eliminar, reenviar invitación); `empresa/configuracion/?tab=plan-contador`.
→ Este formulario es el **catálogo funcional completo** de Contífico: sirve como checklist de funcionalidades para el plano (`60`).

## 2. Multiempresa
Todas las páginas llevan `empresa_buscar_id` y el buscador `empresa/buscar/` (placeholder "FOODIX S.A.S."); login pasa por `/accounts/login/empresa/`. ⏳ Si el usuario de servicio ve más de una empresa (`contrato/reporte_empresas_facturacion/`).

## 3. Auditoría
- `reportes/log_extendido/` "Log de Actividades" (permiso `rep_logActividades`) ⏳ columnas y filtros.
- Historial por documento (`reg_compraventa_historial_documento`) y por producto (`inv_producto_historial`, componente `historial-producto-component.js`; sección "Historial de cambios" en el form de producto).
- `administracion/tratamiento_datos_ajax/` (aceptación de tratamiento de datos), `administracion/api/tos/historial/` (términos de uso de la API).

## 4. Integraciones
- **API REST** con `API_KEY` por POS/empresa (`api-token-component.js`, "API_KEY del POS"); POS `12777` = "API PRODUCCION" (punto 004-003, bodega principal) es el emisor de los documentos creados por API.
- **POS** propio de Contífico: 12 registrados (ver `08-transacciones.md` y `evidencia/pos.txt`), `pos/xml/` genera archivos de productos/personas para el POS, `pos/importar_ventas/` sube ventas por plantilla.
- **Alianza Pronto** (POS `13217`, 999-999, `integracion-pronto.js`) ⚠ integración de delivery/pagos no identificada.
- Bandeja electrónica del SRI (`registro/electronicos/importar/facturas|retenciones/`, configuración `registro/electronicos/configuracion/`): descarga los comprobantes recibidos y los convierte en compras.
- Cash management bancario (archivos para Guayaquil y Bolivariano; `ref_archivo_cobro` en Persona; `cash_management` en la lista de documentos).
- Campos de integración en la API: `id_integracion_proveedor` (⏳), `codigo_sap`, `para_comisariato`, `para_supereasy` (catálogos), `tipo_domicilio` UB/GL + `orden_domicilio_id` (delivery), `promocion_integracion_id`.
- Soporte y cuenta: `empresa/solicitudes/` (tickets), `contrato/mi_cuenta/`, `contrato/reporte_facturacion/`; Contífico es de **Siigo** (portal de clientes `contifico.portaldeclientes.siigo.ec`).

## 5. Modelo de datos (resumen; detalle en `01-modelo-de-datos.md`)
Empresa → Usuarios (perfil + permisos) · Establecimiento/Punto de emisión → POS → Bodega → Centro de costo · Persona (roles) · Producto (tipo, fórmula/combo, cuentas, POS) · Documento (líneas producto/cuenta/activo/reembolso, cobros, retenciones, forma de pago) · Transacción (cobro/pago) · Depósito · Movimiento de inventario · Producción · Toma física · Asiento (líneas cuenta/CC/proyecto) · Movimiento bancario · Liquidación TC (lotes) · Rol de pagos (rubros, préstamos, décimos) · Activo fijo · Segmento/Nivel/Regla/Promoción.

## 6. Fuentes
`evidencia/pages/empresa_*.json`, `pos_*.json`, `administracion_perfil.json`, `contrato_mi_cuenta.json`, `evidencia/ajax-urls.tsv`.
