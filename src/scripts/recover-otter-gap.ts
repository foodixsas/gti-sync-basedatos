// RECOVERY — backfill ad-hoc del gap entre el último pedido en BD y "ahora".
// Usa src/lib/otter-shared para login resiliente + storage_state + captura sin click.
// Solo headers (items + clientes vienen luego con `npm run recover-otter-details`).

import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as os from 'os';
import {
  LIST_ENDPOINT,
  log,
  loadStorageState,
  captureListTemplateResilient,
  buildHeaders,
  rowToObject,
  toIso,
  withRetry,
} from '../lib/otter-shared';

const EMAIL = process.env.OTTER_EMAIL!;
const PASSWORD = process.env.OTTER_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ARG_FROM = process.env.RECOVER_FROM || process.argv[2] || null;
const ARG_TO   = process.env.RECOVER_TO   || process.argv[3] || null;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });


async function main() {
  if (!EMAIL || !PASSWORD) { console.error('❌ Faltan creds Otter'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Faltan creds Supabase'); process.exit(1); }

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
    const lastDate = new Date(`${lastTs}Z`);
    fromIso = new Date(lastDate.getTime() - 6 * 3600 * 1000).toISOString();
    toIsoStr = new Date().toISOString();
  }
  log('info', `▶ Recovery window: ${fromIso} → ${toIsoStr}`);

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
  log('info', `▶ Run id: ${runId}`);

  const browser = await chromium.launch({ headless: true });
  const storageState = loadStorageState();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-EC', storageState });
  const page = await context.newPage();

  let inserted = 0;
  try {
    const template = await captureListTemplateResilient(page, context, EMAIL, PASSWORD);

    const body = JSON.parse(JSON.stringify(template.requestBody));
    body.limit = 5000;
    body.filterSet = (body.filterSet || []).map((f: any) =>
      f.filterType === 'dateRangeFilter' ? { ...f, minDate: fromIso, maxDate: toIsoStr } : f
    );
    log('info', '▶ Pidiendo listado a Otter...');
    const resp = await withRetry(() => page.request.post(LIST_ENDPOINT, {
      headers: buildHeaders(template),
      data: body,
      timeout: 60_000,
    }), { attempts: 3, baseDelayMs: 1000, label: 'list-fetch' });
    if (!resp.ok()) throw new Error(`HTTP ${resp.status()}: ${(await resp.text()).slice(0, 400)}`);
    const json = await resp.json();
    const rows = (json.rows || []).map(rowToObject);
    const total = json.totalRowCount || 0;
    log('info', `✓ Recibidos ${rows.length}/${total} pedidos`);

    if (json.pageInfo?.hasNext && total > rows.length) {
      log('warn', `⚠ Hay más de ${rows.length} pedidos en el rango — considera ampliar limit o partir el rango.`);
    }

    if (rows.length === 0) {
      log('info', 'Sin pedidos nuevos en el rango.');
    } else {
      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const pedidos = slice.map((r: any) => {
          const tsRefLocalIso = toIso(r.reference_time_local_without_tz);
          const tsRefLocal = tsRefLocalIso ? tsRefLocalIso.replace('Z', '') : null;
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
          log('warn', `⚠ Batch error: ${error.message}`);
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

    log('info', `✅ Recovery completo: ${inserted} headers upserted`);
  } catch (e: any) {
    log('error', `❌ Fatal: ${e.message?.slice(0, 400)}`);
    await (supabase.schema('otter_raw' as any) as any)
      .from('otter_scrape_runs')
      .update({ status: 'failed', ended_at: new Date().toISOString(), error_msg: e.message?.slice(0, 500) })
      .eq('run_id', runId);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
