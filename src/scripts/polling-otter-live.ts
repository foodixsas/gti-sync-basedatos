// POLLING EN VIVO — corre 24/7
// Cada N segundos consulta TODAY al endpoint analytics, detecta pedidos nuevos
// (no presentes en otter_pedidos), los inserta + dispara OrderDetails para cada uno.
// Auto-refresh JWT al 401/403.

import { chromium, type Browser, type Page, type BrowserContext, type Response } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as os from 'os';

const OTTER_URL = 'https://manager.tryotter.com/';
const EMAIL = process.env.OTTER_EMAIL!;
const PASSWORD = process.env.OTTER_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const LIST_ENDPOINT = 'https://manager.tryotter.com/api/analytics/table/order_performance_cullinan';
const DETAILS_ENDPOINT = 'https://manager.tryotter.com/api/graphql?operation=OrderDetails';
const POLL_INTERVAL_MS = 5_000;          // 5 seg
const REFRESH_TEMPLATE_EVERY_MS = 9 * 60 * 1000; // refrescar JWT preventivo cada 9 min
const HEALTH_LOG_EVERY_N_POLLS = 60;     // log de salud cada 5 min
const HEARTBEAT_EVERY_MS = 30_000;       // 30 seg — basado en tiempo, no en N polls (un poll puede tardar >30s en colas grandes)
const MAX_CONSECUTIVE_ERRORS = 10;       // tras 10 errores seguidos → relanzar browser
const RELAUNCH_BACKOFF_MS = 15_000;      // espera entre relaunch attempts

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

let templateList: any = null;
let templateDetails: any = null;
let lastTemplateRefreshAt = 0;
let pollCount = 0;
let pedidosNuevosTotal = 0;
let errorsTotal = 0;
let consecutiveErrors = 0;
let currentRunId: string | null = null;
let browserRef: Browser | null = null;
let contextRef: BrowserContext | null = null;
let pageRef: Page | null = null;
let shuttingDown = false;
let lastHeartbeatAt = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────
function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(level: 'info' | 'warn' | 'error', msg: string) {
  console.log(`[${ts()}] ${level.toUpperCase()}: ${msg}`);
}

function money(m: any): number {
  if (!m) return 0;
  return (m.units || 0) + (m.nanos || 0) / 1e9;
}

function toIso(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 1_000_000_000_000) return new Date(n).toISOString();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v;
  return null;
}

async function login(page: Page) {
  await page.goto(OTTER_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Iniciar")').first().click();
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function captureBothTemplates(page: Page) {
  log('info', '🔄 Refrescando templates (list + OrderDetails)...');
  const candidatesList: any[] = [];
  let detailsCaptured: any = null;

  const handler = async (resp: Response) => {
    const url = resp.url();
    if (resp.request().method() !== 'POST') return;
    const post = resp.request().postData();
    if (!post) return;

    if (url.includes('/api/analytics/table/order_performance_cullinan')) {
      try {
        const body = JSON.parse(post);
        candidatesList.push({ requestBody: body, requestHeaders: resp.request().headers() });
      } catch {}
    } else if (url.includes('/api/graphql') && !detailsCaptured) {
      try {
        const body = JSON.parse(post);
        if (body.operationName === 'OrderDetails') {
          detailsCaptured = { requestBody: body, requestHeaders: resp.request().headers() };
        }
      } catch {}
    }
  };

  page.on('response', handler);

  await page.goto('https://manager.tryotter.com/orders?dayRangeFilter=TODAY', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(8000);

  try {
    const noThanks = page.locator('button:has-text("NO, THANKS")').first();
    if (await noThanks.isVisible({ timeout: 2000 })) await noThanks.click();
  } catch {}

  // Click primer pedido para capturar OrderDetails template
  try {
    await page.waitForSelector('table tbody tr', { timeout: 15_000 });
    await page.locator('table tbody tr').first().click();
    await page.waitForTimeout(4000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  } catch (e: any) {
    log('warn', `No pude clickear primera fila: ${e.message.slice(0, 100)}`);
  }

  page.off('response', handler);

  const list = candidatesList.find(c => {
    const cols = c.requestBody?.columns || [];
    return cols.some((col: any) => col.key === 'external_order_display_id') && c.requestBody?.paginate === true;
  });
  if (!list) throw new Error('No template de listado capturado');
  if (!detailsCaptured) throw new Error('No template de OrderDetails capturado');

  templateList = list;
  templateDetails = detailsCaptured;
  lastTemplateRefreshAt = Date.now();
  log('info', '✓ Templates capturados');
}

function buildHeaders(template: any): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const tpl = template.requestHeaders || {};
  for (const k of Object.keys(tpl)) {
    const lk = k.toLowerCase();
    if (lk.startsWith(':') || lk === 'cookie' || lk === 'host' || lk === 'content-length' || lk === 'content-type') continue;
    headers[k] = tpl[k];
  }
  return headers;
}

function rowToObject(row: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const cell of row) obj[cell.key] = cell.value;
  return obj;
}

function parseCustomerNote(note: string | null | undefined) {
  if (!note) return {};
  return {
    cedula_ruc: note.match(/Tax ID:\s*(\d+)/i)?.[1]?.trim()
              || note.match(/Nro\.?:\s*(\d+)/i)?.[1]?.trim()
              || note.match(/CI:\s*(\d+)/i)?.[1]?.trim()
              || null,
    razon_social: note.match(/Facturar a empresa:\s*([^-|]+?)(?:\s*-|$)/i)?.[1]?.trim()
               || note.match(/Legal Entity Name:\s*([^|]+?)(?:\s*\||$)/i)?.[1]?.trim()
               || null,
    email_real: note.match(/Email:\s*([^\s|]+@[^\s|]+)/i)?.[1]?.trim() || null,
    direccion: note.match(/Address:\s*(.+?)(?:\s*\||$)/i)?.[1]?.trim() || null,
    medio_pago: note.match(/Medio de pago:\s*([^|]+?)(?:\s*\||$)/i)?.[1]?.trim()
             || note.match(/Datos de pago:\s*([^.]+)/i)?.[1]?.trim()
             || null,
    prepagado: /Prepagado/i.test(note),
    codigo_check_in: note.match(/Código de check-in:\s*(\d+)/i)?.[1]?.trim() || null,
    codigo_entrega: note.match(/Código de Entrega:\s*(\d+)/i)?.[1]?.trim() || null,
  };
}

async function fetchTodayOrders(page: Page): Promise<any[]> {
  const today = new Date();
  const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
  const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

  const body = JSON.parse(JSON.stringify(templateList.requestBody));
  body.limit = 500;
  body.filterSet = (body.filterSet || []).map((f: any) =>
    f.filterType === 'dateRangeFilter' ? { ...f, minDate, maxDate } : f
  );

  const resp = await page.request.post(LIST_ENDPOINT, {
    headers: buildHeaders(templateList),
    data: body,
    timeout: 20_000,
  });

  if (resp.status() === 401 || resp.status() === 403) {
    log('warn', `🔒 List ${resp.status()} — refrescando templates`);
    await captureBothTemplates(page);
    return fetchTodayOrders(page);
  }
  if (!resp.ok()) {
    throw new Error(`List HTTP ${resp.status()}`);
  }

  const json = await resp.json();
  return (json.rows || []).map(rowToObject);
}

async function fetchOrderDetails(page: Page, orderId: string): Promise<any> {
  const body = { ...templateDetails.requestBody, variables: { input: { enrichData: true, orderId } } };
  const resp = await page.request.post(DETAILS_ENDPOINT, {
    headers: buildHeaders(templateDetails),
    data: body,
    timeout: 20_000,
  });
  if (resp.status() === 401 || resp.status() === 403) {
    await captureBothTemplates(page);
    return fetchOrderDetails(page, orderId);
  }
  if (!resp.ok()) return null;
  const txt = await resp.text();
  return JSON.parse(txt)?.data?.orderDetails;
}

async function getRunId(): Promise<string> {
  // Hay un solo "run de polling" abierto; lo creamos al inicio
  const { data: existing } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_scrape_runs')
    .select('run_id')
    .eq('run_type', 'polling')
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.run_id) return existing.run_id;

  const { data: created } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_scrape_runs')
    .insert({ run_type: 'polling', notes: 'Polling 24/7 cada 5 seg sobre TODAY' })
    .select('run_id')
    .single();
  return created!.run_id;
}

async function processOrder(page: Page, runId: string, listRow: any) {
  const otterId = listRow.order_id;
  if (!otterId) return false;

  // ¿Ya existe?
  const { data: exists } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_pedidos')
    .select('otter_internal_id')
    .eq('otter_internal_id', otterId)
    .maybeSingle();

  // Datos del listado → inserción base
  const tsRefLocalIso = toIso(listRow.reference_time_local_without_tz);
  const tsRefLocal = tsRefLocalIso ? tsRefLocalIso.replace('Z', '') : null;
  const tsRef = toIso(listRow.partition_source_timestamp) || tsRefLocalIso;

  const baseRow = {
    otter_internal_id: otterId,
    display_id: listRow.external_order_display_id || otterId,
    organization_id: listRow.organization_id,
    payout_id: listRow.payout_id || null,
    canal_slug: listRow.ofo_slug,
    ofo_slug: listRow.ofo_slug,
    store_id: listRow.store_id,
    facility_id: listRow.facility_id,
    store_name: listRow.facility_name,
    country_code: 'EC',
    brand_id: listRow.brand_id,
    brand_name: listRow.brand_name,
    is_test: listRow.is_test === 'true' || listRow.is_test === true,
    ts_reference: tsRef,
    ts_reference_local: tsRefLocal,
    data_fidelity: listRow.order_data_fidelity || null,
    order_status: listRow.order_status || null,
    acceptance_status: listRow.acceptance_status || null,
    order_items_quantity: listRow.order_items_quantity || null,
    num_issues: listRow.order_issue_count || 0,
    currency_code: listRow.currency_code || 'USD',
    subtotal: listRow.subtotal || 0,
    tax: listRow.tax || 0,
    tip: listRow.tip || 0,
    adjusted_commission: listRow.adjusted_commission || 0,
    order_error_charges: listRow.order_error_charges || 0,
    restaurant_funded_discount: listRow.restaurant_funded_discount || 0,
    ofo_funded_discount: listRow.ofo_funded_discount || 0,
    discount: (listRow.restaurant_funded_discount || 0) + (listRow.ofo_funded_discount || 0),
    total: listRow.total_with_tip ? (listRow.total_with_tip - (listRow.tip || 0)) : 0,
    total_with_tip: listRow.total_with_tip || 0,
    adjusted_net_or_estimated_payout: listRow.adjusted_net_or_estimated_payout || 0,
    payout: listRow.adjusted_net_or_estimated_payout || 0,
    fulfillment_mode: listRow.fulfillment_mode || null,
    scheduling_type: listRow.scheduling_type || null,
    run_id: runId,
  };

  await (supabase.schema('otter_raw' as any) as any)
    .from('otter_pedidos')
    .upsert(baseRow, { onConflict: 'otter_internal_id' });

  // Si NO existía → fetchar detalles (pedido nuevo)
  if (!exists) {
    const od = await fetchOrderDetails(page, otterId);
    if (od) {
      const det = od.details || {};
      const customerNote = det.fulfillmentInfo?.customerNote || null;

      // UPDATE con detalles + parser cliente
      const parsed = parseCustomerNote(customerNote);
      const customerName = det.customerName || null;

      await (supabase.schema('otter_raw' as any) as any)
        .from('otter_pedidos')
        .update({
          customer_name: customerName,
          customer_note: customerNote,
          subtotal: money(det.subtotal),
          tax: money(det.tax),
          tip: money(det.tip),
          discount: money(det.discount),
          ofo_funded_discount: money(det.ofoFundedDiscount),
          total: money(det.total),
          payout: money(det.payout),
          delivery_provider_slug: det.fulfillmentInfo?.deliveryServiceProviderSlug,
          medio_pago: parsed.medio_pago,
          prepagado: parsed.prepagado,
          codigo_check_in: parsed.codigo_check_in,
          codigo_entrega: parsed.codigo_entrega,
          details_fetched_at: new Date().toISOString(),
        })
        .eq('otter_internal_id', otterId);

      // INSERT items + modificadores en otter_pedido_productos
      const items = od.items || [];
      let lineCounter = 0;
      const productosToInsert: any[] = [];
      const modsTemplates: any[] = [];

      for (const it of items) {
        lineCounter++;
        const itemLine = lineCounter;
        productosToInsert.push({
          pedido_internal_id: otterId,
          line_number: itemLine,
          tipo: 'item',
          parent_producto_id: null,
          sku_id: it.skuId,
          name: it.name,
          quantity: it.quantity,
          price: money(it.price),
        });
        for (const s of (it.subItems || [])) {
          lineCounter++;
          modsTemplates.push({
            tempKey: `${otterId}__${itemLine}`,
            data: {
              pedido_internal_id: otterId,
              line_number: lineCounter,
              tipo: 'modificador',
              sub_header: s.subHeader,
              sku_id: s.skuId,
              name: s.name,
              quantity: s.quantity || 1,
              price: money(s.price),
            },
          });
        }
      }

      if (productosToInsert.length > 0) {
        const { data: insertedItems } = await (supabase.schema('otter_raw' as any) as any)
          .from('otter_pedido_productos')
          .insert(productosToInsert)
          .select('producto_id, pedido_internal_id, line_number');

        if (insertedItems && modsTemplates.length > 0) {
          const idByKey = new Map<string, number>();
          for (const it of insertedItems) {
            idByKey.set(`${it.pedido_internal_id}__${it.line_number}`, it.producto_id);
          }
          const modsToInsert = modsTemplates
            .map(m => ({ ...m.data, parent_producto_id: idByKey.get(m.tempKey) }))
            .filter(m => m.parent_producto_id !== undefined);
          if (modsToInsert.length > 0) {
            await (supabase.schema('otter_raw' as any) as any)
              .from('otter_pedido_productos')
              .insert(modsToInsert);
          }
        }
      }

      log('info', `🆕 Pedido nuevo ${listRow.external_order_display_id} (${listRow.ofo_slug}) — ${customerName || '?'} — $${listRow.total_with_tip}`);
      return true;
    }
  }
  return false;
}

async function heartbeat(runId: string, ordersTodayCount: number) {
  await (supabase.schema('otter_raw' as any) as any)
    .from('otter_scrape_runs')
    .update({
      last_heartbeat_at: new Date().toISOString(),
      poll_count: pollCount,
      pedidos_today: ordersTodayCount,
      pedidos_count: pedidosNuevosTotal,
      error_count: errorsTotal,
    })
    .eq('run_id', runId);
}

async function relaunchBrowser(): Promise<Page> {
  log('warn', '♻️  Relanzando browser desde cero...');
  try { if (browserRef) await browserRef.close(); } catch {}
  browserRef = null; contextRef = null; pageRef = null;
  await new Promise(r => setTimeout(r, RELAUNCH_BACKOFF_MS));

  browserRef = await chromium.launch({ headless: true });
  contextRef = await browserRef.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-EC' });
  pageRef = await contextRef.newPage();
  await login(pageRef);
  await captureBothTemplates(pageRef);
  consecutiveErrors = 0;
  log('info', '✓ Browser relanzado OK');
  return pageRef;
}

// ─── Main loop ──────────────────────────────────────────────────────────────
async function pollLoop(runId: string) {
  while (!shuttingDown) {
    pollCount++;
    const t0 = Date.now();
    let ordersLen = 0;
    try {
      if (!pageRef) throw new Error('pageRef nulo (browser no inicializado)');

      // Refresh preventivo del template cada 9 min (JWT vive ~10 min)
      if (Date.now() - lastTemplateRefreshAt > REFRESH_TEMPLATE_EVERY_MS) {
        await captureBothTemplates(pageRef);
      }

      const orders = await fetchTodayOrders(pageRef);
      ordersLen = orders.length;
      let nuevosEsteciclo = 0;
      for (const o of orders) {
        const fueNuevo = await processOrder(pageRef, runId, o);
        if (fueNuevo) {
          nuevosEsteciclo++;
          pedidosNuevosTotal++;
        }
      }

      consecutiveErrors = 0; // resetea racha al primer poll exitoso

      if (pollCount % HEALTH_LOG_EVERY_N_POLLS === 0) {
        const dt = Date.now() - t0;
        log('info', `💓 polls=${pollCount} nuevos_total=${pedidosNuevosTotal} errors=${errorsTotal} | hoy=${ordersLen} pedidos | latencia=${dt}ms`);
      } else if (nuevosEsteciclo > 0) {
        log('info', `+${nuevosEsteciclo} nuevos en este poll`);
      }
    } catch (e: any) {
      errorsTotal++;
      consecutiveErrors++;
      log('error', `Poll error #${consecutiveErrors}: ${e.message.slice(0, 200)}`);

      // Tras N errores seguidos → relanzar browser entero (Mac despertó, JWT roto, page closed, etc.)
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        try {
          await relaunchBrowser();
        } catch (re: any) {
          log('error', `Relaunch falló: ${re.message.slice(0, 200)}. Saliendo con código 2 para que launchd reinicie.`);
          await closeRun(runId, 'failed', `Relaunch failed after ${consecutiveErrors} consecutive errors: ${re.message.slice(0, 300)}`);
          process.exit(2);
        }
      } else if (consecutiveErrors % 3 === 0 && pageRef) {
        try { await captureBothTemplates(pageRef); } catch (re: any) {
          log('error', `Refresh template falló: ${re.message.slice(0, 100)}`);
        }
      }
    }

    // Heartbeat basado en tiempo (independiente de la velocidad del ciclo)
    if (Date.now() - lastHeartbeatAt >= HEARTBEAT_EVERY_MS) {
      try {
        await heartbeat(runId, ordersLen);
        lastHeartbeatAt = Date.now();
      } catch (he: any) {
        log('warn', `Heartbeat write falló: ${he.message.slice(0, 100)}`);
      }
    }

    const elapsed = Date.now() - t0;
    const sleep = Math.max(0, POLL_INTERVAL_MS - elapsed);
    if (sleep > 0) await new Promise(r => setTimeout(r, sleep));
  }
}

async function closeRun(runId: string, status: 'completed' | 'failed', errorMsg?: string) {
  try {
    await (supabase.schema('otter_raw' as any) as any)
      .from('otter_scrape_runs')
      .update({
        status,
        ended_at: new Date().toISOString(),
        pedidos_count: pedidosNuevosTotal,
        error_count: errorsTotal,
        error_msg: errorMsg || null,
        notes: `Polling cerrado tras ${pollCount} polls (status=${status})`,
      })
      .eq('run_id', runId);
  } catch (e: any) {
    log('error', `closeRun falló: ${e.message?.slice(0, 200)}`);
  }
}

async function main() {
  if (!EMAIL || !PASSWORD) { console.error('❌ Faltan creds Otter'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Faltan creds Supabase'); process.exit(1); }

  log('info', `▶ Iniciando polling 24/7 cada ${POLL_INTERVAL_MS}ms (host=${os.hostname()} pid=${process.pid})`);
  const runId = await getRunId();
  currentRunId = runId;
  log('info', `▶ Run id: ${runId}`);

  // Marca host_name + pid + heartbeat inicial en el run
  await (supabase.schema('otter_raw' as any) as any)
    .from('otter_scrape_runs')
    .update({
      host_name: os.hostname(),
      process_pid: process.pid,
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('run_id', runId);
  lastHeartbeatAt = Date.now();

  browserRef = await chromium.launch({ headless: true });
  contextRef = await browserRef.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-EC' });
  pageRef = await contextRef.newPage();

  // Login + capturar templates iniciales
  await login(pageRef);
  await captureBothTemplates(pageRef);

  // Loop infinito (controlado por shuttingDown)
  await pollLoop(runId);
}

// ─── Crash hooks: nunca dejar el run en 'running' tras una muerte inesperada ─
async function emergencyShutdown(reason: string, exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('error', `☠️  Emergency shutdown (${reason})`);
  try { if (browserRef) await browserRef.close(); } catch {}
  if (currentRunId) {
    await closeRun(currentRunId, exitCode === 0 ? 'completed' : 'failed', reason);
  }
  process.exit(exitCode);
}

process.on('SIGINT',  () => emergencyShutdown('SIGINT',  0));
process.on('SIGTERM', () => emergencyShutdown('SIGTERM', 0));
process.on('SIGHUP',  () => emergencyShutdown('SIGHUP',  2)); // 2 = launchd debe reiniciar
process.on('uncaughtException',  (e: Error) => emergencyShutdown(`uncaughtException: ${e.message?.slice(0,300)}`, 2));
process.on('unhandledRejection', (e: any)   => emergencyShutdown(`unhandledRejection: ${String(e)?.slice(0,300)}`, 2));

main().catch(async (e: any) => {
  await emergencyShutdown(`main() rechazó: ${e?.message?.slice(0,300) || String(e)}`, 2);
});
