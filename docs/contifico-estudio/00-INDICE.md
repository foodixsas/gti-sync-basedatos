# Estudio profundo de Contífico — índice

**Objetivo (Daniel, 22-sep-2026):** que Claude sea el experto de Contífico dentro de FOODIX: cada módulo entendido y documentado con evidencia, al nivel de poder ejecutar cualquier operación ("registra una retención") sabiendo exactamente qué hacer. Todo entra en alcance (POS, facturación electrónica, nómina, contabilidad, bancos, activos fijos, fidelización). El plano del sistema propio viene después; primero el conocimiento.

**Empresa estudiada:** FOODIX S.A.S. · `https://1793168604001.contifico.com/sistema/` · cuenta de servicio del scraper (sin 2FA). Solo lectura: nada se crea ni modifica en Contífico.

**Método:** (1) GET de cada pantalla del menú con la sesión guardada y extracción de formularios, selects y tablas; (2) contraste con la API REST (OpenAPI v1/v2 + pruebas); (3) contraste con lo que FOODIX tiene sincronizado en Supabase (`contifico_raw`, `contifico_clean`, `contifico_web`, `costos`); (4) cada afirmación con fuente, si no → `⚠ NO VERIFICADO`.

## Estado por módulo

| # | Archivo | Módulo (menú real) | Estado | Última actualización |
|---|---|---|---|---|
| 01 | `01-modelo-de-datos.md` | Entidades, claves, relaciones | ⏳ | — |
| 02 | `02-configurar-facturacion.md` | Empresa › Configurar Facturación (wizard), Usuarios | 🔄 v1 | 2026-09-22 |
| 03 | `03-contabilidad.md` | Contabilidad: Asientos, Ejercicios, Plan de Cuentas, Centros de Costo, Activos Fijos | 🔄 v1 | 2026-09-22 |
| 04 | `04-personas.md` | Personas | 🔄 v1 | 2026-09-22 |
| 05 | `05-inventario.md` | Inventario: Productos, Movimientos, Toma Física, Producción, Unidades, Categorías, Bodegas, Importaciones | 🔄 v1 | 2026-09-22 |
| 06 | `06-rrhh-nomina.md` | RRHH: Roles mensual/quincenal, Préstamos, Décimos, Pagos, Configuraciones | 🔄 v1 | 2026-09-22 |
| 07 | `07-crm-fidelizacion.md` | Fidelización: Segmentos, Niveles, Promociones, Reglas de consumo, Dashboard · Proformas/Cotizaciones | 🔄 v1 | 2026-09-22 |
| 08 | `08-transacciones.md` | Transacciones (registro): Documentos, Cobros/Pagos, Cruce, Depósitos, Guías, Bandeja electrónica, Anulaciones, POS | 🔄 v1 | 2026-09-22 |
| 09 | `09-bancos.md` | Bancos: Movimientos, Conciliación, Cheques, Anticipos, Caja chica · Tarjeta de crédito: Liquidaciones, Lotes | 🔄 v1 | 2026-09-22 |
| 10 | `10-reportes.md` | Reportes (29 pantallas) | 🔄 v1 | 2026-09-22 |
| 11 | `11-firmas-electronicas.md` | Firmador: Firmar documento, Documentos firmados | 🔄 v1 | 2026-09-22 |
| 12 | `12-transversal.md` | Permisos y usuarios, multiempresa, auditoría (Log de Actividades), integraciones, Mi cuenta/contrato | 🔄 v1 | 2026-09-22 |
| 20 | `20-api-catalogo.md` | API REST v1/v2 completa | ⏳ | — |
| 21 | `21-web-catalogo.md` | Todas las URLs del sistema web (menú completo, forms, exports) | ✅ v1 (121 pantallas) | 2026-09-22 |
| 30 | `30-uso-real-foodix.md` | Qué usa FOODIX, cuánto, desde cuándo | 🔄 v1 | 2026-09-22 |
| 40 | `40-defectos-de-diseno.md` | Lo que no se repite | ⏳ | — |
| 41 | `41-lo-que-vale-copiar.md` | Lo que Contífico hace bien | ⏳ | — |
| 50 | `50-requisitos-legales-ec.md` | SRI, IESS, Ministerio de Trabajo | ⏳ | — |
| 60 | `60-plano-sistema-propio.md` | Plano (fase posterior, por pedido de Daniel) | ⏳ | — |

## Decisiones de Daniel que fijan el alcance (22-sep-2026)
1. Todo entra: POS, facturación electrónica y SRI incluidos.
2. La nómina la hace Talento Humano; Contabilidad supervisa. En Contífico hay asientos de nómina por empleado (1,916 filas en 2026) y FOODIX tiene `gth_nom_*` propio desde ago-2026: el estudio documenta ambos.
3. La historia se importará y el cambio debe sentirse fluido, pero eso es fase posterior. Esta fase: conocimiento total del sistema.
4. Acceso web: credencial en `~/.contifico-web-creds` (22-sep) y sesión Playwright guardada en `~/.foodix-tools/contifico-web-session.json` (la usa el scraper local `com.foodix.contifico-scrape-intradia` cada 5 min). Se reutiliza la sesión, no se hace login nuevo.
5. Sin prioridad por módulo: cobertura total. Posible uso futuro de agentes que operen Contífico → cada ficha incluye "cómo se hace X" con URL, campos y validaciones.

## Reglas de evidencia
- `evidencia/` guarda HTML/JSON/capturas **sin datos personales**: se redactan cédulas, teléfonos, correos, sueldos y credenciales antes de commitear.
- Fechas de Contífico: `DD/MM/YYYY` en API y exports; en `contifico_raw` las columnas de fecha son TEXTO (nunca `min`/`max` directo).

## Alertas operativas encontradas durante el estudio (22-sep-2026)
- ❌ **Almacenamiento de Contífico al 100 %** (1,047 MB de 1,047 MB, 31 KB libres; `empresa/configuracion/general/`). Adjuntos, exports y respaldos pueden fallar. Pedir ampliación (`aumentar_espacio`) o limpiar adjuntos.
- ⚠ **Lotes de tarjeta sin liquidar**: todos los lotes del 19 al 22-sep aparecen "Pendiente (Faltante)" con liquidado $0 (`tarjeta_credito/lote/`). Contífico ya agrupa los cobros TC por lote y espera la liquidación; hoy esa conciliación se hace afuera.
- ⚠ Certificado de firma electrónica vence el **2028-08-16**.
- ✅ Resuelto: al abrir `inventario/produccion/registrar/` por GET, Contífico creó un borrador provisional vacío (id 964838, PRO 202609000138, estado S, sin líneas). Verificado y eliminado el 22-sep (GET `…/964838/eliminar/`; ahora responde 404 y no queda ninguna producción provisional). **Regla:** nunca abrir `produccion/registrar/` por GET; para estudiar el formulario usar una producción existente.
- ⚠ 13 usuarios de 16; 6 digitadores; sin aprobadores configurados.

## Pendientes del estudio (próxima sesión)
1. `20-api-catalogo.md` desde `openapiv1/v2.yaml` (copias en scratchpad; volver a bajar de `contificostatics.azureedge.net/static/shell/media/docs/openapi*.yaml?v=4`) + pruebas en vivo con la API key.
2. `01-modelo-de-datos.md` (Mermaid verificado) y `40`, `41`, `50`, `60`.
3. Segunda pasada por módulo: leer `establecimientos[0]` de `factura_electronica`, listas AJAX (roles de nómina, fidelización, lotes completos), `empresa/configuracion/backup/`, `reportes/log_extendido/` con datos, `pos/consultar_pos/<id>/`, un EGR de venta con su detalle para confirmar el descuento de ingredientes del COP, cruce asiento ↔ factura.
4. Comparación campo a campo nómina Contífico ↔ `gth_nom_*` con TTHH.
5. Espejo en Obsidian `Programación/FOODIX/Proyectos/Contifico-Estudio/` y `/obsidian_sync cierre`; pendientes en `gdi_pendientes`.
