// RECOVERY DE DETALLES — enriquece pedidos sin details_fetched_at usando OrderDetails GraphQL.
// Usa src/lib/otter-shared: login resiliente + storage_state + templates sin click frágil.

import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as os from 'os';
import {
  DETAILS_ENDPOINT,
  log,
  loadStorageState,
  captureListTemplateResilient,
  buildDetailsTemplate,
  buildHeaders,
  parseCustomerNote,
  money,
  type Template,
} from '../lib/otter-shared';

const EMAIL = process.env.OTTER_EMAIL!;
const PASSWORD = process.env.OTTER_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REQUEST_DELAY_MS = 800;
const REFRESH_AFTER_N_REQS = 100;
const FROM_TS = process.env.FROM_TS || process.argv[2] || '2026-04-30';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function captureFreshDetailsTemplate(page: Page, context: any): Promise<Template> {
  const list = await captureListTemplateResilient(page, context, EMAIL, PASSWORD);
  return buildDetailsTemplate(list);
}

async function fetchDetails(page: Page, template: Template, orderId: string): Promise<any | null> {
  const body = { ...template.requestBody, variables: { input: { enrichData: true, orderId } } };
  const resp = await page.request.post(DETAILS_ENDPOINT, {
    headers: buildHeaders(template),
    data: body,
    timeout: 25_000,
  });
  if (!resp.ok()) return null;
  const json = await resp.json();
  return json?.data?.orderDetails || null;
}

async function processPedido(page: Page, template: Template, otterInternalId: string): Promise<{ items: number; mods: number }> {
  const od = await fetchDetails(page, template, otterInternalId);
  if (!od) return { items: 0, mods: 0 };

  const det = od.details || {};
  const customerNote = det.fulfillmentInfo?.customerNote || null;
  const customerName = det.customerName || null;
  const parsed = parseCustomerNote(customerNote);

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
    .eq('otter_internal_id', otterInternalId);

  await (supabase.schema('otter_raw' as any) as any)
    .from('otter_pedido_productos')
    .delete()
    .eq('pedido_internal_id', otterInternalId);

  const items = od.items || [];
  let lineCounter = 0;
  const productosToInsert: any[] = [];
  const modsTemplates: any[] = [];

  for (const it of items) {
    lineCounter++;
    const itemLine = lineCounter;
    productosToInsert.push({
      pedido_internal_id: otterInternalId,
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
        tempKey: `${otterInternalId}__${itemLine}`,
        data: {
          pedido_internal_id: otterInternalId,
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

  let itemsInsertados = 0;
  let modsInsertados = 0;
  if (productosToInsert.length > 0) {
    const { data: insertedItems, error: errItems } = await (supabase.schema('otter_raw' as any) as any)
      .from('otter_pedido_productos')
      .insert(productosToInsert)
      .select('producto_id, pedido_internal_id, line_number');
    if (errItems) {
      console.warn(`  ⚠ Insert items error ${otterInternalId}: ${errItems.message}`);
    } else {
      itemsInsertados = insertedItems?.length || 0;
      if (insertedItems && modsTemplates.length > 0) {
        const idByKey = new Map<string, number>();
        for (const it of insertedItems) {
          idByKey.set(`${it.pedido_internal_id}__${it.line_number}`, it.producto_id);
        }
        const modsToInsert = modsTemplates
          .map(m => ({ ...m.data, parent_producto_id: idByKey.get(m.tempKey) }))
          .filter(m => m.parent_producto_id !== undefined);
        if (modsToInsert.length > 0) {
          const { error: errMods } = await (supabase.schema('otter_raw' as any) as any)
            .from('otter_pedido_productos')
            .insert(modsToInsert);
          if (errMods) {
            console.warn(`  ⚠ Insert mods error ${otterInternalId}: ${errMods.message}`);
          } else {
            modsInsertados = modsToInsert.length;
          }
        }
      }
    }
  }

  return { items: itemsInsertados, mods: modsInsertados };
}

async function main() {
  if (!EMAIL || !PASSWORD) { console.error('❌ Faltan creds Otter'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Faltan creds Supabase'); process.exit(1); }

  const fromIso = new Date(FROM_TS).toISOString();
  log('info', `▶ Recovery details desde ${fromIso}`);

  const { data: run } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_scrape_runs')
    .insert({
      run_type: 'backfill',
      range_from: fromIso,
      range_to: new Date().toISOString(),
      notes: 'Recovery details (post-crash polling) — usa otter_pedido_productos',
      host_name: os.hostname(),
      process_pid: process.pid,
      last_heartbeat_at: new Date().toISOString(),
    })
    .select('run_id')
    .single();
  const runId = run!.run_id;
  log('info', `▶ Run id: ${runId}`);

  const browser = await chromium.launch({ headless: true });
  const storageState = loadStorageState();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-EC', storageState });
  const page = await context.newPage();

  let processed = 0, totalItems = 0, totalMods = 0, errors = 0;
  const t0 = Date.now();

  try {
    let template = await captureFreshDetailsTemplate(page, context);

    while (true) {
      const { data: pending } = await (supabase.schema('otter_raw' as any) as any)
        .from('otter_pedidos')
        .select('otter_internal_id')
        .is('details_fetched_at', null)
        .eq('is_test', false)
        .gte('ts_reference_local', FROM_TS)
        .order('ts_reference_local', { ascending: false })
        .limit(500);

      if (!pending || pending.length === 0) {
        log('info', '✅ No quedan pendientes en el rango.');
        break;
      }
      log('info', `▶ Lote de ${pending.length} pendientes...`);

      for (const p of pending) {
        try {
          const r = await processPedido(page, template, p.otter_internal_id);
          totalItems += r.items;
          totalMods += r.mods;
          processed++;
        } catch (e: any) {
          errors++;
          console.warn(`  ⚠ ${p.otter_internal_id}: ${e.message?.slice(0, 150)}`);
        }
        if (processed % 25 === 0) {
          const dt = ((Date.now() - t0) / 1000).toFixed(0);
          log('info', `  ${processed} pedidos | items=${totalItems} mods=${totalMods} errors=${errors} | ${dt}s`);
          await (supabase.schema('otter_raw' as any) as any)
            .from('otter_scrape_runs')
            .update({
              last_heartbeat_at: new Date().toISOString(),
              poll_count: processed,
              items_count: totalItems,
              modifiers_count: totalMods,
              error_count: errors,
            })
            .eq('run_id', runId);
        }
        if (processed % REFRESH_AFTER_N_REQS === 0) {
          log('info', '🔄 Refrescando JWT preventivamente...');
          try { template = await captureFreshDetailsTemplate(page, context); } catch (e: any) {
            log('warn', `  refresh failed: ${e.message?.slice(0, 120)}`);
          }
        }
        await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
      }
    }

    await (supabase.schema('otter_raw' as any) as any)
      .from('otter_scrape_runs')
      .update({
        status: errors > 0 ? 'partial' : 'completed',
        ended_at: new Date().toISOString(),
        pedidos_count: processed,
        pedidos_updated: processed,
        items_count: totalItems,
        modifiers_count: totalMods,
        error_count: errors,
      })
      .eq('run_id', runId);

    const dt = ((Date.now() - t0) / 1000).toFixed(0);
    log('info', `═══ RESUMEN ═══`);
    log('info', `  procesados: ${processed} | items: ${totalItems} | mods: ${totalMods} | errors: ${errors} | ${dt}s`);
  } catch (err: any) {
    log('error', `❌ Fatal: ${err.message}`);
    await (supabase.schema('otter_raw' as any) as any)
      .from('otter_scrape_runs')
      .update({ status: 'failed', ended_at: new Date().toISOString(), error_msg: err.message?.slice(0, 500) })
      .eq('run_id', runId);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
