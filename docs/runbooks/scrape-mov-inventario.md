# Runbook — Scraper "Detalle Movimientos Inventario" (Contifico web → `contifico_web.mov_inventario_detalle`)

**Cuándo usar:** el dashboard de costos muestra datos viejos; `contifico_web.sync_log` no tiene filas de hoy; hay que re-bajar un rango (edición retroactiva, producción registrada tarde, cambio de reglas); o el workflow apareció en rojo.

## Qué es
- Tabla plana (sin particiones) — decisión de Daniel 18-ago-2026.
- Fuente única de movimientos de inventario **con costo real por línea** (6 decimales), bodega, centro de costo y documento origen (`Referencia`): compras, producción (insumos ↔ PT), traslados, egresos directos a costo, consumo por venta (POS), bajas, toma física.
- Script: `src/scripts/scrape-mov-inventario.ts`. Workflow: `.github/workflows/scrape-mov-inventario.yml` (schedule 09:10 UTC = 04:10 EC, ayer+hoy; `workflow_dispatch` para rangos).
- Login Playwright con secrets GH `CONTIFICO_EMAIL/CONTIFICO_PASSWORD` → `GET inventario/movimiento/?excel=2&fecha_inicio&fecha_fin&tipo&origen` con la cookie de sesión → RPC `fn_web_mov_stage` / `fn_web_mov_commit` (reemplazo por documento, cabeceras en `mov_inventario_doc`, fantasmas `deleted_at`, latido en `sync_log`).
- Slices: `EGR` "Todos" **por día** (ventas POS = 98 % del volumen), `ING/TRA/AJU` "Todos" por semana, y `MAN/IMP/API/AUT/ORP/MED/LIQ` por semana. El origen de las filas "Todos" lo resuelve el RPC (Referencia FAC/NVE/DNA/LQR → DOC, PRO → PRO, si no el ya visto, si no NULL = sin origen en Contifico, p.ej. toma física).
- Vista clasificada: `contifico_clean.v_mov_inventario_clasificado` (`clase_costo`, `subclase`, `es_anomalia_proceso`, `marca_cc`).

## Medir producción (no pulso)
```sql
select created_at::date d, count(*) requests, count(*) filter (where ok) ok, sum(filas) filas, sum(docs) docs, sum(docs_borrados) fantasmas
from contifico_web.sync_log group by 1 order by 1 desc limit 10;
```
Un día sin fila = el workflow no corrió (GitHub apaga crons tras 60 días sin commits → `keepalive.yml`). Filas con `ok=false` traen `error` y `meta.url`.

## Re-bajar un rango
```bash
gh workflow run scrape-mov-inventario.yml -f desde=01/07/2026 -f hasta=31/07/2026 -f modo=backfill
# un solo slice (tipo:origen, origen vacío = Todos)
gh workflow run scrape-mov-inventario.yml -f desde=03/08/2026 -f hasta=09/08/2026 -f modo=manual -f solo="EGR:MAN"
gh workflow run scrape-mov-inventario.yml -f desde=01/08/2026 -f hasta=17/08/2026 -f modo=backfill -f solo="EGR:,ING:,TRA:,AJU:"
gh run watch <run_id>
```
Tiempos medidos (ago-2026): 17 días completos ≈ 27 min; un mes ≈ 45 min. Concurrency group: nunca dos corridas a la vez (GitHub cancela el pendiente más viejo si encolás dos).

## Validar cobertura contra el espejo de la API
```sql
-- docs en la API que no están en el web (candidatos a fantasma de la API)
select count(distinct i.codigo) from contifico_clean.mov_ingresos i
where i.fecha between :d1 and :d2 and not exists (select 1 from contifico_web.mov_inventario_doc d where d.codigo=i.codigo);
```
Si aparecen, comprobar contra `GET https://api.contifico.com/sistema/api/v2/movimiento-inventario/{id}/` (devuelve `[]` si el doc fue borrado). Verificado 18-ago-2026: 76 docs de agosto en la API ya no existen en Contifico → el web es el correcto.

## Fallos conocidos
| Síntoma | Causa | Qué hacer |
|---|---|---|
| `HTML en vez de xls … title="Contifico - Iniciar sesión"` | sesión no asentada / expirada | el script hace relogin y reintenta; si persiste, revisar credenciales (secrets) |
| `page.goto: net::ERR_ABORTED` post-login | redirección post-login en curso | ya mitigado (espera + 3 reintentos) |
| `columnas faltantes en export` (exit 2) | Contifico cambió el encabezado | actualizar `EXPECTED_COLS` y el RPC; NO parchear a ciegas |
| `bloqueo HTTP 403/429` (exit 2) | límite del lado de Contifico | esperar; no relanzar en bucle; avisar |
| Slice pesado > 20 min | día con muchas ventas / Contifico lento | reintenta 1 vez; luego re-lanzar solo ese día con `--solo EGR:` |

## Pendientes
- Alerta WhatsApp en fallo (hoy: exit≠0 + `sync_log`). Corrida semanal (últimos 30 días) y cierre mensual.
- `contifico_clean.mov_ingresos_contif_scrape` (scraper viejo, solo ING) sigue corriendo en paralelo hasta migrar consumidores a la tabla nueva.
