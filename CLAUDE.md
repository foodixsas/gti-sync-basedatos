# contifico-supabase-sync — Reglas críticas del proyecto

## ⚠️ PedidosYa scraping — método correcto (probado 9-may-2026)

### Regla #1: Para `ListOrders` SIEMPRE usar `gqlFetch()` (fetch nativo de Node.js)

`page.request.post()` de Playwright **es bloqueado por PerimeterX con 403** (appId `PX24c5Soup`). El cron de prod tiene 2 helpers:

```ts
// ❌ INCORRECTO para ListOrders — devuelve 403 PerimeterX
async function gql(page: Page, t: Template, variables: any) {
  return await page.request.post(t.url, { headers, data: body });
}

// ✅ CORRECTO para ListOrders — pasa PerimeterX
async function gqlFetch(t: Template, variables: any) {
  return await fetch(t.url, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
```

**Por qué:** Playwright agrega fingerprints de browser (sec-ch-ua, viewport hints, etc.) que PerimeterX detecta. `fetch()` nativo manda solo los headers que le pongas.

**Aplica a:** `ListOrders` (fase 3 del cron).
**NO aplica a:** `ListPayouts`, `getInvoiceDetails` (esos sí pasan con `page.request.post()`).

### Regla #2: Pipeline correcto = template + replay

Una sola sesión browser hace login + captura templates. Después usar `fetch()` directo con los headers del template:

```
1. bootstrap-and-capture (browser, 1 vez/día)  → pedidosya-templates.json + pedidosya-auth.json
2. Replay con fetch() nativo                    → invoice_lines, deals, reviews
```

NO hacer múltiples logins en el día — PerimeterX detecta y bloquea.

### Regla #3: Si IP local está blacklisted → usar GH Actions

BrightData puede blacklistear IPs de Ecuador (`190.63.114.0/24`) por exceso de uso. Síntoma:
```
407 Auth Failed (ip_blacklisted: 190.63.114.0/24)
```

**Fix:** disparar el workflow desde GitHub Actions (IP limpia):
```bash
gh workflow run pedidosya-daily.yml --field phase=orders --field from=YYYY-MM-DD --field to=YYYY-MM-DD
```

GH Actions tiene los mismos secrets (BRIGHTDATA_BROWSER_WSS, etc.) y corre desde IP de GitHub no blacklisted.

### Regla #4: ListOrders solo tiene datos recientes (~última semana)

`ListOrders` es **histórico limitado**. Devuelve órdenes solo desde **2026-05-01 en adelante**. Cualquier rango anterior devuelve 0.

Para histórico antes de mayo 2026:
- Existe en `payouts`/`invoices` (resumen semanal vía `getInvoiceDetails`)
- NO existe a nivel de orden individual vía portal
- Única alternativa: descargas Excel históricas del portal (vía botón Finance → Descargar)

### Regla #5: CapSolver NO sirve para PedidosYa

PedidosYa usa **PerimeterX HUMAN press-and-hold**. CapSolver no lo resuelve confiablemente.

**Quien sí lo resuelve:** BrightData zona `pedidosya_browser` automáticamente durante el login.

NO intentar integrar CapSolver al bootstrap. Está documentado en `.env.local`: `# CapSolver — captcha solver (NO soporta HUMAN/PerimeterX, queda para Uber/Rappi)`.

### Regla #6: Módulo de Créditos NO está activado para FOODIX

URLs `/credits/*` redirigen a `/login` (mientras `/finance` sí funciona). La feature no está habilitada para esta cuenta.

NO incluir endpoints de créditos en backfill ni en schema. Si Daniel quiere acceso → decisión comercial con account manager PYA.

### Regla #7: Querystring `?vendor=PY_EC;X` NO autoriza

URLs como `/live-orders?vendor=PY_EC;238962` redirigen a `/login`. Para multi-vendor:
- Las queries GraphQL aceptan `globalVendorCodes` array en variables (todos los vendors a la vez)
- Si necesitas UN vendor específico, navegar SIN querystring y la sesión usa el "actual"

### Regla #8: NUNCA tocar el cron sin probar primero el approach

`backfill-pedidosya.ts` está en producción. Antes de modificarlo:
1. Probar el cambio en un script aislado (test-replay.ts, etc.)
2. Validar con datos reales que el approach funciona
3. Solo entonces editar backfill-pedidosya.ts y commit

Cambios destructivos al cron rompen ingesta diaria.

---

## Stack técnico
- Node.js 20 (GH Actions) / 22 (local) + tsx
- Playwright + BrightData (zona `pedidosya_browser`) para login con captcha
- Supabase (schema `pedidosya_raw`)
- Cron: GitHub Actions diario 6 AM EC (`pedidosya-daily.yml`)

## Tablas relevantes (`pedidosya_raw`)
- `payouts` (62 rows) — pagos semanales
- `invoices` (62 rows) — facturas semanales
- `invoice_lines` (453 rows desde 2026-05-01) — órdenes individuales
- `ratings_summary` (2 rows) — calificación por local
- `reviews` (9 rows sample) — reviews individuales
- `ratings_history` (62 rows) — serie de tiempo del rating
- `scrape_runs` — log de cada corrida

## Vendors / grids FOODIX
| grid_code | vendor_id | nombre |
|---|---|---|
| HZUU1Y | 238962 | Chios Floreana |
| 4F3TTD | 210361 | Chios Real Audiencia |
| 4F3SJT | 210792 | Chios Portugal |
| HRE4HC | 528672 | Santo Cachón |
| HPQKWK | 587373 | Santo Cachón Portugal |
| HAJUYT | 480041 | Simón Bolón |
