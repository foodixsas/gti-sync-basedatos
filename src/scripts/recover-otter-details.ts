// RECOVERY DE DETALLES — enriquece pedidos sin details_fetched_at usando OrderDetails GraphQL.
// Reusa la lógica testeada del polling (escribe a otter_pedido_productos con tipo + parent_producto_id).
// Útil después de un gap recovery o cuando el polling cayó y dejó pedidos solo con header.

import { chromium, type Page, type Response } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as os from 'os';

const OTTER_URL = 'https://manager.tryotter.com/';
const EMAIL = process.env.OTTER_EMAIL!;
const PASSWORD = process.env.OTTER_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DETAILS_ENDPOINT = 'https://manager.tryotter.com/api/graphql?operation=OrderDetails';

const REQUEST_DELAY_MS = 800;
const REFRESH_AFTER_N_REQS = 100;
const FROM_TS = process.env.FROM_TS || process.argv[2] || '2026-04-30';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function ts(): string { return new Date().toISOString().replace('T',' ').slice(0,19); }
function log(msg: string) { console.log(`[${ts()}] ${msg}`); }

function money(m: any): number {
  if (!m) return 0;
  return (m.units || 0) + (m.nanos || 0) / 1e9;
}

function parseCustomerNote(note: string | null | undefined) {
  if (!note) return {} as any;
  return {
    cedula_ruc: note.match(/Tax ID:\s*(\d+)/i)?.[1]?.trim()
              || note.match(/Nro\.?:\s*(\d+)/i)?.[1]?.trim()
              || note.match(/CI:\s*(\d+)/i)?.[1]?.trim()
              || null,
    razon_social: note.match(/Facturar a empresa:\s*([^-|]+?)(?:\s*-|$)/i)?.[1]?.trim()
               || note.match(/Legal Entity Name:\s*([^|]+?)(?:\s*\||$)/i)?.[1]?.trim()
               || null,
    email_canal: note.match(/Email del Cliente:\s*([^\s|]+)/i)?.[1]?.trim() || null,
    email_real: note.match(/Email:\s*([^\s|]+@[^\s|]+)/i)?.[1]?.trim() || null,
    direccion: note.match(/Address:\s*(.+?)(?:\s*\||$)/i)?.[1]?.trim() || null,
    medio_pago: note.match(/Medio de pago:\s*([^|]+?)(?:\s*\||$)/i)?.[1]?.trim()
             || note.match(/Datos de pago:\s*([^.]+)/i)?.[1]?.trim()
             || null,
    prepagado: /Prepagado/i.test(note) || null,
    codigo_check_in: note.match(/Código de check-in:\s*(\d+)/i)?.[1]?.trim() || null,
    codigo_entrega: note.match(/Código de Entrega:\s*(\d+)/i)?.[1]?.trim() || null,
  };
}

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

async function captureTemplate(page: Page): Promise<any> {
  log('▶ Capturando template OrderDetails...');
  let captured: any = null;
  const handler = async (resp: Response) => {
    if (captured) return;
    if (!resp.url().includes('/api/graphql')) return;
    const post = resp.request().postData();
    if (!post) return;
    try {
      const body = JSON.parse(post);
      if (body.operationName === 'OrderDetails') {
        captured = { requestBody: body, requestHeaders: resp.request().headers() };
      }
    } catch {}
  };
  page.on('response', handler);
  await page.goto('https://manager.tryotter.com/orders?dayRangeFilter=TODAY', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(8000);
  try {
    const noThanks = page.locator('button:has-text("NO, THANKS")').first();
    if (await noThanks.isVisible({ timeout: 2000 })) await noThanks.click();
  } catch {}
  await page.waitForSelector('table tbody tr', { timeout: 15_000 });
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(4000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  page.off('response', handler);
  if (!captured) throw new Error('No se capturó template OrderDetails');
  log('✓ Template capturado');
  return captured;
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

async function fetchDetails(page: Page, template: any, orderId: string): Promise<any | null> {
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

async function processPedido(page: Page, template: any, otterInternalId: string): Promise<{ items: number; mods: number }> {
  const od = await fetchDetails(page, template, otterInternalId);
  if (!od) return { items: 0, mods: 0 };

  const det = od.details || {};
  const customerNote = det.fulfillmentInfo?.customerNote || null;
  const customerName = det.customerName || null;
  const parsed = parseCustomerNote(customerNote);

  // UPDATE header con detalles parseados (mismo set de columnas que polling)
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

  // Borrar productos previos del pedido (idempotente en re-runs)
  await (supabase.schema('otter_raw' as any) as any)
    .from('otter_pedido_productos')
    .delete()
    .eq('pedido_internal_id', otterInternalId);

  // Insertar items + modificadores siguiendo el patrón del polling
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
  log(`▶ Recovery details desde ${fromIso}`);

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
  log(`▶ Run id: ${runId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-EC' });
  const page = await context.newPage();

  let processed = 0, totalItems = 0, totalMods = 0, errors = 0;
  const t0 = Date.now();

  try {
    await login(page);
    let template = await captureTemplate(page);

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
        log('✅ No quedan pendientes en el rango.');
        break;
      }
      log(`▶ Lote de ${pending.length} pendientes...`);

      for (const p of pending) {
        try {
          const r = await processPedido(page, template, p.otter_internal_id);
          totalItems += r.items;
          totalMods += r.mods;
          processed++;
        } catch (e: any) {
          errors++;
          console.warn(`  ⚠ ${p.otter_internal_id}: ${e.message?.slice(0,150)}`);
        }
        if (processed % 25 === 0) {
          const dt = ((Date.now()-t0)/1000).toFixed(0);
          log(`  ${processed} pedidos | items=${totalItems} mods=${totalMods} errors=${errors} | ${dt}s`);
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
          log('🔄 Refrescando JWT preventivamente...');
          try { template = await captureTemplate(page); } catch (e: any) {
            log(`  refresh failed: ${e.message?.slice(0,120)}`);
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

    const dt = ((Date.now()-t0)/1000).toFixed(0);
    log(`═══ RESUMEN ═══`);
    log(`  procesados: ${processed} | items: ${totalItems} | mods: ${totalMods} | errors: ${errors} | ${dt}s`);
  } catch (err: any) {
    log(`❌ Fatal: ${err.message}`);
    await (supabase.schema('otter_raw' as any) as any)
      .from('otter_scrape_runs')
      .update({ status: 'failed', ended_at: new Date().toISOString(), error_msg: err.message?.slice(0,500) })
      .eq('run_id', runId);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
