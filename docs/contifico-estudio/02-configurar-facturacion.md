# 02 · Configurar Facturación / Mi compañía

Estado: 🔄 primera versión (22-sep-2026). Fuente principal: pestañas JSON de `empresa/configuracion/<tab>/` (`evidencia/empresa-configuracion.txt`), POS registrados y cajas.

## 1. Qué hace
Datos del emisor ante el SRI, establecimientos y puntos de emisión, secuenciales, firma electrónica y firmado automático, mensajes del RIDE, cuentas de retención por tipo, aprobadores, parámetros de comportamiento de toda la empresa (decimales, propina, facturar sin stock, campos adicionales, producción, POS), usuarios y límites del plan, API, correos SMTP por módulo, almacenamiento y respaldos.

## 2. Configuración real de FOODIX (22-sep-2026)
| Bloque | Valor |
|---|---|
| Empresa | FOODIX S.A.S., RUC único, actividad "venta de comida y bebidas en cafetería, incluso para llevar", Quito (Sabanilla y Real Audiencia), año de inicio en Contífico **2021**, obligada a llevar contabilidad, **agente de retención** (resolución NAC-DGERCGC26-…), exportador no habitual (⚠ raro para un restaurante), no contribuyente especial, no RIMPE, no microempresa, no gran contribuyente |
| Establecimientos | `numero_establecimientos = 001` en el emisor; en `factura_electronica.establecimientos` hay 1. Pero el POS registra **establecimientos 002…007** (ver `08-transacciones.md`): cada local es un establecimiento del RUC con sus puntos de emisión (POS = punto de emisión con bodega asociada). ⏳ leer `establecimientos[0]` y `est_ptoemi_default` completos |
| Puntos de emisión y cajas | 12 POS: 003-001/002 Floreana · 002-001/002 Real Audiencia · 004-001/002 Portugal · 005-002 Simón Bolón · 006-001 Santo Cachón Real · 007-001 Santo Cachón Portugal · 004-003 "API PRODUCCION" (documentos por API) · 005-001 "Liquidación de tarjetas de crédito" · 999-999 "Integración Alianza Pronto" |
| Facturación electrónica | firma electrónica cargada, **vence 2028-08-16**, firmado automático activo (`config_firmado_auto`), saldo de documentos electrónicos 106,671, límite de facturación 120,000, mensaje RIDE con texto legal, no usa servidor de firma externo, alianzas: 1 |
| Autorizaciones SRI (físicos) | ninguna (todo electrónico) |
| Retenciones | 49 tipos de retención IR + 1 autorretención + 13 tipos de retención IVA con cuenta contable para cliente y para proveedor; `config_retencionesindependientes = true` (la retención se numera aparte del documento) |
| Aprobadores | 8 cupos, ninguno asignado; aprobación de cotización y prefactura desactivada |
| Parámetros (`adicional`) | decimales 6; campo adicional de documento **NOTA** (`adicional1`, el que usa el cajero); guía de remisión habilitada; producción habilitada; conversión de unidades activa; propina activa; facturar sin stock desactivado; costo máximo desactivado; marcas desactivadas; código de barras desactivado; pedidos/sugerencias desactivados; caja online desactivada; DINARDAP activo; cuenta ICE compra 9830471, cuenta retención 9830581, gastos financieros 9830569, comisión no deducible 11185473 |
| Plan y módulos (`plantillas`) | plan **PREMIUM** (`tipo_producto`), acceso a RRHH sí, **fidelización sí**, CRM no, presupuesto no, contratos no, POS habilitado |
| Usuarios | 13 activos de 16 (3 disponibles): 1 administradora (Johanna), contador externo, digitadores (Bryan, Alejandro, Brayan, Janyna…), más la cuenta de servicio del scraper (administrador) |
| API | `api_key` y `api_token` de la empresa (`apis`), sin omitir validación |
| Correos | 1 configuración SMTP (notificación de roles de pago) sin servidor; 6 módulos sin configurar |
| Almacenamiento | **1,047 MB usados de 1,047 MB = 100 %** (`general.espacio_usado_porcentaje`), 31 KB libres → ❌ riesgo operativo: adjuntos, exports y respaldos pueden fallar. `url_aumentar_espacio` disponible |
| Respaldo | `empresa/configuracion/backup/` ⏳ probar qué exporta |

## 3. Flujos
Wizard de configuración (`configurar_facturacion_wizard/`, componentes `empresa-wizard`, `facturacion-wizard`, `firmaDigital-wizard`, `wizard-producto`): datos del emisor → establecimiento y puntos → secuencia inicial → firma (.p12 + clave) → primer producto. Cambios posteriores por pestañas de Mi compañía.

## 4. Reglas legales que implementa
Comprobantes electrónicos (resolución SRI de emisores), agente de retención, contribuyente especial/RIMPE/microempresa como banderas que cambian retenciones e impuestos, mensajes obligatorios del RIDE, gasto personal (anexo), DINARDAP (reporte a la Dirección Nacional de Registro de Datos Públicos).

## 5. Cómo se accede
Solo web. Las pestañas son JSON por GET con sesión (`empresa/configuracion/general/`, `factura_electronica/`, `autoriza_sri/`, `retenciones/`, `plantillas/`, `apis/`, `control/`, `aprobadores/`, `adicional/`, `correo_admin/`, `plan_facturacion/`, `pronto/`, `usuarios/`); escritura por POST a `configuracion/registrar/`, `est_ptoemi_default/`, `secuencia_inicial/`, `mensaje_ride/`, `usuario/registrar/`. API v2 `GET /empresa/parametros` (⏳ probar).

## 6. Defectos y aciertos
- ✅ Configuración expuesta como JSON limpio por pestaña: fácil de auditar y de migrar.
- ✅ Retenciones con cuenta por tipo y lado (cliente/proveedor).
- ❌ Establecimiento "001" en el emisor y 002–007 en los POS: el modelo de establecimiento vive en dos lugares (empresa y POS).
- ❌ Almacenamiento al 100 % sin alerta visible.
- ⚠ 6 usuarios digitadores con acceso amplio; no hay aprobadores configurados.

## 7. Fuentes
`evidencia/empresa-configuracion.txt`, `evidencia/catalogos-web.txt` (POS), `evidencia/pages/empresa_*.json`, `registro_deposito_registrar.json` (cajas).
