// RECOVERY — backfill ad-hoc del gap entre el último pedido en BD y "ahora".
// Reutiliza la misma lógica de captureListingTemplate del polling, pero hace 1 sola
// query con minDate/maxDate explícitos. Solo headers (items + clientes vienen luego
// con `npm run backfill-otter-details`).

import { chromium, type Page, type Response } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as os from 'os';

const OTTER_URL = 'https://manager.tryotter.com/';
const EMAIL = process.env.OTTER_EMAIL!;
const PASSWORD = process.env.OTTER_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENDPOINT = 'https://manager.tryotter.com/api/analytics/table/order_performance_cullinan';

// Permite override por CLI/env. Default: desde último ts_reference_local en BD.
const ARG_FROM = process.env.RECOVER_FROM || process.argv[2] || null;
const ARG_TO   = process.env.RECOVER_TO   || process.argv[3] || null;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function ts(): string { return new Date().toISOString().replace('T',' ').slice(0,19); }
function log(msg: string) { console.log(`[${ts()}] ${msg}`); }

async function login(page: Page) {
  log('▶ Login Otter...');
  await page.goto(OTTER_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Iniciar")').first().click();
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function captureListingTemplate(page: Page): Promise<any> {
  log('▶ Capturando template del listado...');
  const candidates: any[] = [];
  const handler = async (resp: Response) => {
    if (!resp.url().includes('/api/analytics/table/order_performance_cullinan')) return;
    if (resp.request().method() !== 'POST') return;
    const post = resp.request().postData();
    if (!post) return;
    try {
      const body = JSON.parse(post);
      candidates.push({ requestBody: body, requestHeaders: resp.request().headers() });
    } catch {}
  };
  page.on('response', handler);
  await page.goto('https://manager.tryotter.com/orders?dayRangeFilter=TODAY', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(10_000);
  try {
    const noThanks = page.locator('button:has-text("NO, THANKS")').first();
    if (await noThanks.isVisible({ timeout: 2000 })) await noThanks.click();
  } catch {}
  page.off('response', handler);
  const winner = candidates.find(c => {
    const cols = c.requestBody?.columns || [];
    return cols.some((col: any) => col.key === 'external_order_display_id') && c.requestBody?.paginate === true;
  });
  if (!winner) throw new Error('No se capturó template del listado');
  log('✓ Template capturado');
  return winner;
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

function toIso(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 1_000_000_000_000) return new Date(n).toISOString();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v;
  return null;
}

async function main() {
  if (!EMAIL || !PASSWORD) { console.error('❌ Faltan creds Otter'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Faltan creds Supabase'); process.exit(1); }

  // 1) Determinar rango
  let fromIso: string;
  let toIsoStr: string;
  if (ARG_FROM && ARG_TO) {
    fromIso = new Date(ARG_FROM).toISOString();
    toIsoStr = new Date(ARG_TO).toISOString();
  } else {
    const { data: lastRow } = await (supabase.schema('otter_raw' as any) as any)
      .from('otter_pedidos')
      .select('ts_reference_local')
      .order('ts_reference_local', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastTs = lastRow?.ts_reference_local;
    if (!lastTs) { console.error('No hay pedidos previos en BD; usa CLI args.'); process.exit(1); }
    // Resta 6 horas al último ts_reference_local para cubrir solapamiento (idempotente por upsert)
    const lastDate = new Date(`${lastTs}Z`);
    fromIso = new Date(lastDate.getTime() - 6 * 3600 * 1000).toISOString();
    toIsoStr = new Date().toISOString();
  }
  log(`▶ Recovery window: ${fromIso} → ${toIsoStr}`);

  // 2) Crear scrape run
  const { data: run, error: runErr } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_scrape_runs')
    .insert({
      run_type: 'backfill',
      range_from: fromIso,
      range_to: toIsoStr,
      notes: 'Recovery gap (post-crash polling)',
      host_name: os.hostname(),
      process_pid: process.pid,
      last_heartbeat_at: new Date().toISOString(),
    })
    .select('run_id')
    .single();
  if (runErr || !run) { console.error('❌ No se pudo crear run', runErr); process.exit(1); }
  const runId = run.run_id;
  log(`▶ Run id: ${runId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-EC' });
  const page = await context.newPage();

  let inserted = 0;
  try {
    await login(page);
    const template = await captureListingTemplate(page);

    // 3) Query con rango
    const body = JSON.parse(JSON.stringify(template.requestBody));
    body.limit = 5000;
    body.filterSet = (body.filterSet || []).map((f: any) =>
      f.filterType === 'dateRangeFilter' ? { ...f, minDate: fromIso, maxDate: toIsoStr } : f
    );
    log('▶ Pidiendo listado a Otter...');
    const resp = await page.request.post(ENDPOINT, { headers: buildHeaders(template), data: body, timeout: 60_000 });
    if (!resp.ok()) throw new Error(`HTTP ${resp.status()}: ${(await resp.text()).slice(0,400)}`);
    const json = await resp.json();
    const rows = (json.rows || []).map(rowToObject);
    const total = json.totalRowCount || 0;
    log(`✓ Recibidos ${rows.length}/${total} pedidos`);

    if (json.pageInfo?.hasNext && total > rows.length) {
      log(`⚠ Hay más de ${rows.length} pedidos en el rango — considera ampliar limit o partir el rango.`);
    }

    if (rows.length === 0) {
      log('Sin pedidos nuevos en el rango.');
    } else {
      // 4) Upsert headers en lotes de 200
      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const pedidos = slice.map((r: any) => {
          const tsRefLocalIso = toIso(r.reference_time_local_without_tz);
          const tsRefLocal = tsRefLocalIso ? tsRefLocalIso.replace('Z','') : null;
          const tsRef = toIso(r.partition_source_timestamp) || tsRefLocalIso;
          return {
            otter_internal_id: r.order_id,
            display_id: r.external_order_display_id || r.order_id,
            organization_id: r.organization_id,
            payout_id: r.payout_id || null,
            canal_slug: r.ofo_slug,
            ofo_slug: r.ofo_slug,
            store_id: r.store_id,
            facility_id: r.facility_id,
            store_name: r.facility_name,
            country_code: 'EC',
            brand_id: r.brand_id,
            brand_name: r.brand_name,
            is_test: r.is_test === 'true' || r.is_test === true,
            ts_reference: tsRef,
            ts_reference_local: tsRefLocal,
            data_fidelity: r.order_data_fidelity || null,
            order_status: r.order_status || null,
            acceptance_status: r.acceptance_status || null,
            order_items_quantity: r.order_items_quantity || null,
            num_issues: r.order_issue_count || 0,
            currency_code: r.currency_code || 'USD',
            subtotal: r.subtotal || 0,
            tax: r.tax || 0,
            tip: r.tip || 0,
            adjusted_commission: r.adjusted_commission || 0,
            order_error_charges: r.order_error_charges || 0,
            restaurant_funded_discount: r.restaurant_funded_discount || 0,
            ofo_funded_discount: r.ofo_funded_discount || 0,
            discount: (r.restaurant_funded_discount || 0) + (r.ofo_funded_discount || 0),
            total: r.total_with_tip ? (r.total_with_tip - (r.tip || 0)) : 0,
            total_with_tip: r.total_with_tip || 0,
            adjusted_net_or_estimated_payout: r.adjusted_net_or_estimated_payout || 0,
            payout: r.adjusted_net_or_estimated_payout || 0,
            fulfillment_mode: r.fulfillment_mode || null,
            scheduling_type: r.scheduling_type || null,
            run_id: runId,
          };
        });
        const { error } = await (supabase.schema('otter_raw' as any) as any)
          .from('otter_pedidos')
          .upsert(pedidos, { onConflict: 'otter_internal_id', ignoreDuplicates: false });
        if (error) {
          log(`⚠ Batch error: ${error.message}`);
        } else {
          inserted += pedidos.length;
        }
        process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
      }
      console.log('');
    }

    await (supabase.schema('otter_raw' as any) as any)
      .from('otter_scrape_runs')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        pedidos_count: rows.length,
        pedidos_inserted: inserted,
      })
      .eq('run_id', runId);

    log(`✅ Recovery completo: ${inserted} headers upserted`);
  } catch (e: any) {
    log(`❌ Fatal: ${e.message?.slice(0,400)}`);
    await (supabase.schema('otter_raw' as any) as any)
      .from('otter_scrape_runs')
      .update({ status: 'failed', ended_at: new Date().toISOString(), error_msg: e.message?.slice(0,500) })
      .eq('run_id', runId);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
