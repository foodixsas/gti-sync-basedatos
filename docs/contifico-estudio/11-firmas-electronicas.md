# 11 · Firmas electrónicas

Estado: 🔄 primera versión (22-sep-2026).

## 1. Qué hace
Dos cosas distintas: (a) la **firma de comprobantes electrónicos** (facturas, retenciones, guías, notas) con el certificado .p12 de la empresa, integrada en Transacciones; (b) el módulo **Firmador** para firmar PDFs arbitrarios (contratos, actas) con el mismo certificado y llevar registro de documentos firmados.

## 2. Entidades y campos
- Configuración (`empresa/configuracion/factura_electronica/`): `firma_electronica` (archivo), `clave_firma_electronica`, `fecha_exp_firma` = **2028-08-16**, `config_firmado_auto` = true, `es_servidor_externo` = false, `url_server_firma_electr`/`url_server_clave_firma_electr` (servicio de firma de Contífico), `habilitar_solicitud_firma`, `tiene_url_tienda_firma` (venta de firmas por Contífico/Siigo).
- En documentos: `frm_firmar` → `POST registro/documento/firmar/` (`receptor`, `desde_retencion`), `frm_changeDate` (`id_password_firma`: clave del certificado para refirmar al cambiar fecha), botones `guardar_enviar_sri` / `guardar_enviar_sri_retencion`; en la lista de documentos: firma masiva (`chk_todosElectronicos`, `frm_firmar` con `password` y `accion`), "Actualizar estado", "Autorización de documentos"; campos de estado: `firmado`, `enviado_sri`, `autorizado_sri`, `url_xml`, `url_ride`, `estado_electronico` FIN/PEN en el filtro.
- Firmador: `firmador/firmar_documento/` (`form_procesar_pdf`: `archivo` PDF → "Datos del documento" → posición de la firma), `firmador/documentos_firmados/` (fecha y hora, usuario, documento, ubicación; filtros documento/usuario y fechas). Permisos `conf_firmador_firmar`, `conf_firmador_documentos`.
- Guía de remisión y liquidación TC también pasan por `frm_firmar`.

## 3. Flujos y estados
Documento electrónico: guardar → firmar (XAdES-BES con el .p12; automático si `config_firmado_auto`) → enviar al SRI (recepción) → autorización (`autorizado_sri`) → RIDE y XML disponibles → correo al cliente (`correo_enviado`). Si el SRI no responde: `estado_electronico = PEN`, reintento con "Actualizar estado". Documentos no autorizados quedan como DNA (⏳ confirmar que DNA = rechazados/no enviados; hay 23,329 CLI).

## 4. Reglas legales
Certificado emitido por una entidad acreditada (Security Data, BCE, ANF, Uanataca — hay componente `unataca-component.js`), vigencia 1–2 años, formato .p12; firma XAdES-BES sobre el XML del comprobante según la ficha técnica del SRI; el emisor debe renovar el certificado antes del vencimiento o se detiene la facturación.

## 5. Cómo se accede
Solo web. La firma la hace el servidor de Contífico (no expone el certificado). `url_xml`/`url_ride` por API para descargar cada comprobante.

## 6. Uso real en FOODIX
Certificado vigente hasta 2028-08-16; 98 % de las facturas 2026 electrónicas; retenciones electrónicas desde 001; ⏳ cuántos documentos en `firmador/documentos_firmados/`.

## 7. Defectos y aciertos
- ✅ Firmado automático y reintentos integrados; registro de PDFs firmados con usuario y fecha.
- ❌ El certificado y su clave viven en Contífico: para el sistema propio hay que obtener el .p12 y su clave (o emitir uno nuevo) y firmar con una librería XAdES-BES (Java/.NET/Node) o un servicio.
- ⚠ Sin alerta visible de vencimiento; anotar 2028-08-16 en pendientes de Dirección.

## 8. Qué necesitaríamos para reemplazarlo
Módulo de firma: almacenamiento cifrado del .p12, firma XAdES-BES, cliente SOAP de recepción/autorización del SRI (ambientes pruebas/producción), generación de RIDE, cola de reintentos y contingencia, firma de PDFs.

## 9. Fuentes
`evidencia/empresa-configuracion.txt` (factura_electronica), `evidencia/pages/firmador_*.json`, `registro_documento*.json`.
