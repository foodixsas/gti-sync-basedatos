# Otter Polling — Operación 24/7

## TL;DR

```bash
# Estado en vivo del polling
psql ... -c "SELECT * FROM otter_raw.v_polling_health"

# O desde Supabase MCP / SQL editor
SELECT * FROM otter_raw.v_polling_health;
```

`health_status` posibles:
- **OK** — corriendo, heartbeat reciente, hubo inserts en última hora
- **COLGADO** — proceso vivo pero sin heartbeat hace >3 min (cuelgue silencioso)
- **SIN_PEDIDOS_NUEVOS** — heartbeat OK pero sin inserts >60 min (puede ser normal de madrugada)
- **DETENIDO** — el run de polling no está en `running`

## Arquitectura

```
launchd (com.foodix.otter-polling)
   └─ scripts/run-polling-otter.sh
        └─ caffeinate -i (impide idle sleep)
             └─ npm run polling-otter-live
                  └─ Playwright + Chromium
                       └─ INSERT/UPDATE → otter_raw.otter_pedidos
```

Cada 5 segundos consulta el endpoint `order_performance_cullinan` con `dayRangeFilter=TODAY`,
detecta órdenes nuevas (no presentes en `otter_pedidos`) e inserta + dispara OrderDetails GraphQL.

## Diseño defensivo (post-crash 2026-05-01)

1. **Crash hooks** — `uncaughtException` / `unhandledRejection` / `SIGHUP` cierran el run en BD con
   `status=failed` y exit code `2` para que launchd lo relance.
2. **Heartbeat** — cada ~30s (6 polls) escribe `last_heartbeat_at` y `poll_count` en `otter_scrape_runs`.
3. **Auto-relaunch del browser** — tras `MAX_CONSECUTIVE_ERRORS=10` errores seguidos
   (Mac despertó, JWT roto, page closed), recrea browser + login + templates desde 0.
4. **launchd KeepAlive** — relanza el proceso si muere por cualquier razón (excepto exit 0).
5. **caffeinate -i** — bloquea idle sleep mientras el polling viva. Si cierras la tapa, el Mac
   igual duerme (system sleep) y el polling se detiene hasta despertar.

## Comandos operativos

### Cargar el LaunchAgent (primera vez o tras edición del plist)

```bash
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.foodix.otter-polling.plist
```

### Detener el polling temporalmente

```bash
launchctl bootout gui/$UID/com.foodix.otter-polling
```

### Reiniciar manualmente (sin desinstalar)

```bash
launchctl kickstart -k gui/$UID/com.foodix.otter-polling
```

### Ver estado launchd

```bash
launchctl print gui/$UID/com.foodix.otter-polling | grep -E "state|last exit|pid"
```

### Logs en vivo

```bash
tail -f ~/contifico-supabase-sync/logs/polling-$(date +%Y-%m-%d).log
tail -f ~/contifico-supabase-sync/logs/launchd.err.log   # si launchd no logra ni arrancar el wrapper
```

## Recovery manual de un gap

Si el polling cae y la BD queda sin pedidos por horas/días:

```bash
cd ~/contifico-supabase-sync

# Auto-detect: desde último ts_reference_local en BD hasta ahora
npm run recover-otter-gap

# Rango explícito
npm run recover-otter-gap "2026-05-01T00:00:00Z" "2026-05-08T00:00:00Z"

# Luego enriquecer items + clientes (procesa todo lo que tenga details_fetched_at IS NULL)
npm run backfill-otter-details
```

⚠️ **No correr el recovery con el polling arrancado** — son dos browsers logueados a la
misma cuenta Otter, riesgo de logout cruzado. Detener polling primero:

```bash
launchctl bootout gui/$UID/com.foodix.otter-polling
npm run recover-otter-gap
npm run backfill-otter-details
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.foodix.otter-polling.plist
```

## Limitaciones honestas del setup local

- **Tapa cerrada / desenchufado → Mac duerme → polling detenido.** caffeinate solo bloquea idle
  sleep. Para 24/7 real con tapa cerrada hay que **mover el polling a cloud** (Railway, Fly.io,
  EC2 micro). Costo ~$5/mes.
- **Cuenta Otter única** — si la bloquean por exceso de polling, no hay backup. La política de 5s
  con auto-refresh JWT lleva 6 meses estable, pero es riesgo permanente.
- **Sin notificación push** — la vista `v_polling_health` hay que consultarla manualmente. Próximo
  paso: cron en Supabase que mande email/Slack si `health_status != 'OK'` por >15 min.

## Schema de tablas relevantes

```sql
-- Heartbeat columns añadidas 2026-05-07
ALTER TABLE otter_raw.otter_scrape_runs ADD COLUMN last_heartbeat_at timestamptz;
ALTER TABLE otter_raw.otter_scrape_runs ADD COLUMN poll_count integer DEFAULT 0;
ALTER TABLE otter_raw.otter_scrape_runs ADD COLUMN pedidos_today integer DEFAULT 0;
ALTER TABLE otter_raw.otter_scrape_runs ADD COLUMN process_pid integer;
ALTER TABLE otter_raw.otter_scrape_runs ADD COLUMN host_name text;

-- Vista de monitoreo
CREATE OR REPLACE VIEW otter_raw.v_polling_health AS ...
```

## Historial de incidentes

- **2026-05-01 → 2026-05-07** — Polling murió silenciosamente. Causa raíz: proceso lanzado
  desde terminal interactiva sin daemonización; SIGHUP al cerrar terminal lo mató, sin process
  manager para reiniciar, sin logs persistidos para diagnosticar. **Pérdida: 0** (recovery exitoso
  via API histórica de Otter — los datos seguían disponibles). Tiempo de detección por el
  usuario: 7 días. Tiempo de detección si el setup actual hubiera estado vivo: <30 min.
