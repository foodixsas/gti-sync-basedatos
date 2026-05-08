// ⚠️  DEPRECATED — NO USAR (2026-05-07).
// Este script apunta a tablas que no existen: `otter_pedido_items` y `otter_pedido_modificadores`.
// La tabla real es `otter_pedido_productos` (con columna `tipo` y `parent_producto_id`).
// Los INSERTs fallan silenciosamente y el script "procesa" pedidos sin enriquecerlos.
// Reemplazado por: `npm run recover-otter-details` (src/scripts/recover-otter-details.ts).
//
// Bug detectado durante la recuperación del gap del polling 1-may → 7-may 2026.
// Si necesitas reescribir este script: usar la lógica del polling (otter_pedido_productos
// con tipo='item' + tipo='modificador' linkeados por parent_producto_id).

console.error('❌ Este script está deprecated por un bug (escribe a tablas inexistentes).');
console.error('   Usa: npm run recover-otter-details');
process.exit(1);

// FASE 2 — Backfill de DETALLES (items + modificadores + customer_note + cliente)
// para pedidos que ya tienen header pero no detalle (details_fetched_at IS NULL).
// Llama OrderDetails GraphQL por cada pedido con throttling.

import { chromium, type Page, type Response } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const OTTER_URL = 'https://manager.tryotter.com/';
const EMAIL = process.env.OTTER_EMAIL!;
const PASSWORD = process.env.OTTER_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const GRAPHQL_ENDPOINT = 'https://manager.tryotter.com/api/graphql?operation=OrderDetails';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Throttling
const REQUEST_DELAY_MS = 800; // ~1.25 req/s, conservador
const REFRESH_AFTER_N_REQS = 100; // refrescar JWT cada 100 requests preventivamente

// ─── Helpers ────────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto(OTTER_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Iniciar")').first().click();
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function captureOrderDetailsTemplate(page: Page) {
  console.log('▶ Capturando template OrderDetails...');
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

  // Cargar /orders y abrir primer pedido para forzar OrderDetails
  await page.goto('https://manager.tryotter.com/orders?dayRangeFilter=TODAY', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(7000);
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

function money(m: any): number {
  if (!m) return 0;
  return (m.units || 0) + (m.nanos || 0) / 1e9;
}

function parseCustomerNote(note: string | null | undefined) {
  if (!note) return {};
  const out: any = {};
  out.cedula_ruc = note.match(/Tax ID:\s*(\d+)/i)?.[1]?.trim()
                || note.match(/Nro\.?:\s*(\d+)/i)?.[1]?.trim()
                || note.match(/CI:\s*(\d+)/i)?.[1]?.trim()
                || null;
  out.razon_social = note.match(/Facturar a empresa:\s*([^-|]+?)(?:\s*-|$)/i)?.[1]?.trim()
                  || note.match(/Legal Entity Name:\s*([^|]+?)(?:\s*\||$)/i)?.[1]?.trim()
                  || null;
  out.email_canal = note.match(/Email del Cliente:\s*([^\s|]+)/i)?.[1]?.trim() || null;
  out.email_real = note.match(/Email:\s*([^\s|]+@[^\s|]+)/i)?.[1]?.trim() || null;
  out.direccion = note.match(/Address:\s*(.+?)(?:\s*\||$)/i)?.[1]?.trim() || null;
  out.medio_pago = note.match(/Medio de pago:\s*([^|]+?)(?:\s*\||$)/i)?.[1]?.trim()
                || note.match(/Datos de pago:\s*([^.]+)/i)?.[1]?.trim()
                || null;
  out.prepagado = /Prepagado/i.test(note) || null;
  out.codigo_check_in = note.match(/Código de check-in:\s*(\d+)/i)?.[1]?.trim() || null;
  out.codigo_entrega = note.match(/Código de Entrega:\s*(\d+)/i)?.[1]?.trim() || null;
  return out;
}

async function upsertCliente(parsed: any, canalSlug: string, customerName: string | null, ts: string): Promise<string | null> {
  if (!parsed.cedula_ruc && !customerName) return null;

  if (parsed.cedula_ruc) {
    const { data: existing } = await (supabase.schema('otter_raw' as any) as any)
      .from('otter_clientes')
      .select('cliente_id')
      .eq('cedula_ruc', parsed.cedula_ruc)
      .maybeSingle();
    if (existing?.cliente_id) {
      await (supabase.schema('otter_raw' as any) as any)
        .from('otter_clientes')
        .update({
          nombre_canal: customerName,
          medio_pago_ultimo: parsed.medio_pago,
          email_real: parsed.email_real || undefined,
          direccion: parsed.direccion || undefined,
          ultimo_pedido_at: ts,
        })
        .eq('cliente_id', existing.cliente_id);
      return existing.cliente_id;
    }
  } else if (customerName) {
    const { data: existing } = await (supabase.schema('otter_raw' as any) as any)
      .from('otter_clientes')
      .select('cliente_id')
      .eq('canal_origen', canalSlug)
      .eq('nombre_canal', customerName)
      .is('cedula_ruc', null)
      .maybeSingle();
    if (existing?.cliente_id) return existing.cliente_id;
  }

  const { data: created } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_clientes')
    .insert({
      cedula_ruc: parsed.cedula_ruc,
      nombre_facturacion: parsed.razon_social,
      nombre_canal: customerName,
      email_canal: parsed.email_canal,
      email_real: parsed.email_real,
      direccion: parsed.direccion,
      medio_pago_ultimo: parsed.medio_pago,
      canal_origen: canalSlug,
      primer_pedido_at: ts,
      ultimo_pedido_at: ts,
    })
    .select('cliente_id')
    .single();
  return created?.cliente_id || null;
}

let debugFirstCalls = 3; // log primeras 3 llamadas a detalle
async function fetchOrderDetails(page: Page, templateRef: { current: any }, orderId: string): Promise<any> {
  // CRITICAL: la query GraphQL OrderDetails espera variables.input.orderId (no variables.orderId)
  const body = { ...templateRef.current.requestBody, variables: { input: { enrichData: true, orderId } } };
  const headers = buildHeaders(templateRef.current);
  if (debugFirstCalls > 0) {
    console.log(`  [DEBUG] template body keys: ${Object.keys(templateRef.current.requestBody).join(',')} | original variables: ${JSON.stringify(templateRef.current.requestBody.variables).slice(0,200)}`);
    console.log(`  [DEBUG] sending orderId=${orderId} | merged variables: ${JSON.stringify(body.variables)}`);
  }
  const resp = await page.request.post(GRAPHQL_ENDPOINT, { headers, data: body });
  if (resp.status() === 401 || resp.status() === 403) {
    console.log('  🔄 JWT expirado, refrescando...');
    const fresh = await captureOrderDetailsTemplate(page);
    templateRef.current = fresh;
    return fetchOrderDetails(page, templateRef, orderId);
  }
  if (!resp.ok()) throw new Error(`HTTP ${resp.status()}`);
  const txt = await resp.text();
  const json = JSON.parse(txt);
  if (debugFirstCalls > 0) {
    console.log(`  [DEBUG] response status=${resp.status()} | top keys=${Object.keys(json || {}).join(',')} | data keys=${Object.keys(json?.data || {}).join(',')}`);
    if (!json?.data?.orderDetails) {
      console.log(`  [DEBUG] FULL RESPONSE (first 1500): ${txt.slice(0, 1500)}`);
    }
    debugFirstCalls--;
  }
  return json?.data?.orderDetails;
}

async function processPedido(page: Page, templateRef: { current: any }, runId: string, otterInternalId: string): Promise<{ items: number; mods: number; clienteCreated: boolean }> {
  const od = await fetchOrderDetails(page, templateRef, otterInternalId);
  if (!od) return { items: 0, mods: 0, clienteCreated: false };

  const det = od.details || {};
  const md = od.metadata || {};
  const customerNote = det.fulfillmentInfo?.customerNote || null;
  const customerName = det.customerName || null;
  const canalSlug = md.ofo?.slug || null;
  const tsRefLocal = det.referenceTimeLocalWithoutTz;
  const tsRef = det.referenceTime;

  // Parsear cliente
  const parsed = parseCustomerNote(customerNote);
  const clienteId = canalSlug ? await upsertCliente(parsed, canalSlug, customerName, tsRef) : null;

  // Actualizar pedido con datos del detalle
  await (supabase.schema('otter_raw' as any) as any)
    .from('otter_pedidos')
    .update({
      cliente_id: clienteId,
      customer_name: customerName,
      customer_note: customerNote,
      data_fidelity: det.dataFidelity,
      num_menu_items: det.numOfMenuItems,
      num_issues: det.numOfIssues || 0,
      // Refrescar montos finales (Otter los ajusta retroactivamente)
      subtotal: money(det.subtotal),
      tax: money(det.tax),
      tip: money(det.tip),
      discount: money(det.discount),
      ofo_funded_discount: money(det.ofoFundedDiscount),
      total: money(det.total),
      total_eater_fees: money(det.totalEaterFees),
      service_fee_for_restaurant: money(det.serviceFeeForRestaurant),
      payment_due: money(det.paymentDue),
      payout: money(det.payout),
      fee_processing: money(det.restaurantFees?.processingFee),
      fee_delivery: money(det.restaurantFees?.deliveryFee),
      fee_sales_tax_withheld: money(det.restaurantFees?.salesTaxWithheld),
      fee_other: money(det.restaurantFees?.other),
      fee_advertising: money(det.restaurantFees?.advertising),
      eater_delivery_fee: money(det.eaterFees?.deliveryFee),
      eater_bag_fee: money(det.eaterFees?.bagFee),
      eater_packing_fee: money(det.eaterFees?.packingFee),
      eater_small_order_fee: money(det.eaterFees?.smallOrderFee),
      delivery_provider_slug: det.fulfillmentInfo?.deliveryServiceProviderSlug,
      delivery_courier: det.fulfillmentInfo?.deliveryCourierName,
      prep_time_secs: det.prepTimeSecs || 0,
      table_number: det.tableNumber,
      medio_pago: parsed.medio_pago,
      prepagado: parsed.prepagado,
      codigo_check_in: parsed.codigo_check_in,
      codigo_entrega: parsed.codigo_entrega,
      details_fetched_at: new Date().toISOString(),
    })
    .eq('otter_internal_id', otterInternalId);

  // Borrar items previos y reinsertar (idempotente)
  await (supabase.schema('otter_raw' as any) as any)
    .from('otter_pedido_items')
    .delete()
    .eq('pedido_internal_id', otterInternalId);

  let itemsCount = 0, modsCount = 0;
  const items = od.items || [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const { data: insertedItem } = await (supabase.schema('otter_raw' as any) as any)
      .from('otter_pedido_items')
      .insert({
        pedido_internal_id: otterInternalId,
        line_number: i + 1,
        sku_id: it.skuId,
        name: it.name,
        quantity: it.quantity,
        price: money(it.price),
        raw_extra: it,
      })
      .select('item_id')
      .single();
    if (!insertedItem) continue;
    itemsCount++;

    // Modificadores
    const subItems = it.subItems || [];
    for (const s of subItems) {
      await (supabase.schema('otter_raw' as any) as any)
        .from('otter_pedido_modificadores')
        .insert({
          item_id: insertedItem.item_id,
          sub_header: s.subHeader,
          sku_id: s.skuId,
          name: s.name,
          quantity: s.quantity || 1,
          price: money(s.price),
          raw_extra: s,
        });
      modsCount++;
    }
  }

  // Guardar raw payload
  await (supabase.schema('otter_raw' as any) as any).from('otter_raw_responses').insert({
    run_id: runId,
    otter_internal_id: otterInternalId,
    endpoint: 'OrderDetails',
    request_variables: { orderId: otterInternalId },
    payload: od,
  });

  return { items: itemsCount, mods: modsCount, clienteCreated: !!clienteId };
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  if (!EMAIL || !PASSWORD) { console.error('❌ Faltan creds Otter'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Faltan creds Supabase'); process.exit(1); }

  // Crear scrape run
  const { data: run } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_scrape_runs')
    .insert({
      run_type: 'backfill',
      notes: 'Fase 2 — Backfill de detalles (items + modificadores + clientes)',
    })
    .select('run_id')
    .single();
  const runId = run!.run_id;
  console.log(`▶ Scrape run creado: ${runId}`);

  const browser = await chromium.launch({ headless: true, slowMo: 0 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-EC' });
  const page = await context.newPage();

  const t0 = Date.now();
  let totalItems = 0, totalMods = 0, totalClientes = 0, totalErrors = 0, processed = 0;

  try {
    await login(page);
    const initial = await captureOrderDetailsTemplate(page);
    const templateRef = { current: initial };
    console.log('  ✓ Template inicial OK');

    // Loop: traer batch de pedidos pendientes y procesar
    while (true) {
      const { data: pending } = await (supabase.schema('otter_raw' as any) as any)
        .from('otter_pedidos')
        .select('otter_internal_id')
        .is('details_fetched_at', null)
        .eq('is_test', false)
        .order('ts_reference', { ascending: false })  // empezar por los más recientes
        .limit(500);

      if (!pending || pending.length === 0) {
        console.log('\n✅ No hay pedidos pendientes. Backfill completo.');
        break;
      }

      console.log(`\n▶ Lote de ${pending.length} pedidos pendientes...`);
      for (let i = 0; i < pending.length; i++) {
        const p = pending[i];
        try {
          const r = await processPedido(page, templateRef, runId, p.otter_internal_id);
          totalItems += r.items;
          totalMods += r.mods;
          if (r.clienteCreated) totalClientes++;
          processed++;
        } catch (e: any) {
          console.warn(`  ⚠ Error en ${p.otter_internal_id}: ${e.message}`);
          totalErrors++;
        }
        if (processed % 25 === 0) {
          const dt = ((Date.now() - t0) / 1000).toFixed(0);
          console.log(`  Progreso: ${processed} pedidos | items: ${totalItems} | mods: ${totalMods} | errors: ${totalErrors} | ${dt}s`);
        }
        if (processed % REFRESH_AFTER_N_REQS === 0) {
          console.log('  🔄 Refresco preventivo de JWT...');
          try {
            const fresh = await captureOrderDetailsTemplate(page);
            templateRef.current = fresh;
          } catch (e: any) {
            console.warn(`  Refresh falló: ${e.message}`);
          }
        }
        await new Promise(res => setTimeout(res, REQUEST_DELAY_MS));
      }
    }

    await (supabase.schema('otter_raw' as any) as any).from('otter_scrape_runs')
      .update({
        ended_at: new Date().toISOString(),
        status: totalErrors > 0 ? 'partial' : 'completed',
        pedidos_count: processed,
        pedidos_updated: processed,
        items_count: totalItems,
        modifiers_count: totalMods,
        clientes_inserted: totalClientes,
        error_count: totalErrors,
      })
      .eq('run_id', runId);

    const dt = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`\n═══ RESUMEN FASE 2 ═══`);
    console.log(`  Pedidos procesados: ${processed}`);
    console.log(`  Items insertados: ${totalItems}`);
    console.log(`  Modificadores: ${totalMods}`);
    console.log(`  Clientes nuevos: ${totalClientes}`);
    console.log(`  Errores: ${totalErrors}`);
    console.log(`  Tiempo: ${dt}s`);

  } catch (err: any) {
    console.error('❌ Fatal:', err.message);
    await (supabase.schema('otter_raw' as any) as any).from('otter_scrape_runs')
      .update({ ended_at: new Date().toISOString(), status: 'failed', error_msg: err.message })
      .eq('run_id', runId);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
