// PEDIDOSYA — Backfill de producción (v2 — queries hardcodeadas)
// Elimina la fragilidad de "capturar templates en vivo" — solo necesitamos el JWT.
//
// Estrategia:
//   1. Login BrightData
//   2. Capturar UN request a vagw-api para extraer Authorization Bearer + headers de auth
//   3. Reusar headers + queries hardcodeadas para todos los requests
//   4. Loop mensual: ListPayouts → upsert payouts → getInvoiceDetails → upsert invoices
//   5. Loop semanal: ListOrders paginado → upsert invoice_lines (con __STAGING__ invoice_id)
//   6. Phase=link: vincular invoice_lines con su invoice real por grid+rango
//
// CLI: npm run backfill-pedidosya -- --from=2025-01-01 --to=2026-05-02 --phase=all
//   --phase ∈ { all, payouts, invoices, orders, link }

import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

// ── Env ──────────────────────────────────────────────────────────────────────
const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS!;
const EMAIL = process.env.PEDIDOSYA_EMAIL!;
const PASSWORD = process.env.PEDIDOSYA_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!BROWSER_WSS || !EMAIL || !PASSWORD || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan env vars'); process.exit(1);
}

// ── CLI args ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2).reduce<Record<string, string>>((acc, a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  acc[k] = v ?? 'true';
  return acc;
}, {});
const FROM = argv.from || '2025-01-01';
const TO = argv.to || new Date().toISOString().slice(0, 10);
const PHASE = (argv.phase || 'all') as 'all'|'payouts'|'invoices'|'orders'|'link';

// ── Constantes FOODIX ────────────────────────────────────────────────────────
const ACCOUNTS = [
  { grid: 'HZUU1Y', billingParentId: '197177', chainId: '0016900002hloN8', vendorId: '238962' },
  { grid: '4F3TTD', billingParentId: '197177', chainId: '0016900002hloN8', vendorId: '210361' },
  { grid: '4F3SJT', billingParentId: '197177', chainId: '0016900002hloN8', vendorId: '210792' },
  { grid: 'HRE4HC', billingParentId: '197177', chainId: '',                 vendorId: '528672' },
  { grid: 'HPQKWK', billingParentId: '197177', chainId: '',                 vendorId: '587373' },
  { grid: 'HAJUYT', billingParentId: '197177', chainId: '',                 vendorId: '480041' },
];
const VENDOR_TO_GRID = Object.fromEntries(ACCOUNTS.map(a => [a.vendorId, a.grid]));
const ACCOUNTS_PARAM = ACCOUNTS.map(a => ({ grid: a.grid, billingParentId: a.billingParentId, chainId: a.chainId }));
const VENDOR_CODES_PARAM = ACCOUNTS.map(a => ({ globalEntityId: 'PY_EC', vendorId: a.vendorId }));

// ── Las queries de finance (ListPayouts, ListOrders) se capturan EN VIVO del
// browser — único modo fiable de que coincidan con el Apollo Client del portal.
// `getInvoiceDetails` se inlinea aquí porque NO siempre se dispara automático.
// Esta es la query LITERAL capturada del Apollo Client el 2026-05-02.
const GET_INVOICE_DETAILS_QUERY = `query getInvoiceDetails($params: GetInvoiceDetailsRequest!) {
  finances {
    getInvoiceDetails(input: $params) {
      totalNetPayout
      taxes
      invoice {
        globalEntityId totalPayout attachments currency id netEarnings ordersCount processedDate
        earningsPeriod { invoiceStartDate invoiceEndDate __typename }
        __typename
      }
      breakdown {
        grossSales cashCollected
        loans { loans { amount reason __typename } total __typename }
        taxCharges { taxChargeList { amount reason __typename } total __typename }
        additionalSales { total deliveryFees packagingFees movFees foodCostReimbursement tips additionalEarnings { reason amount __typename } __typename }
        discounts { discountsBySelf discountsByBrand __typename }
        vouchers { vouchersBySelf vouchersByBrand __typename }
        customerRefundCharges { total charges { reason amount __typename } __typename }
        additionalFees { total paymentFee additionalCharges { amount reason __typename } __typename }
        marketingFees { total marketingFee { type amount __typename } __typename }
        commissions { total commissionList { amount type __typename } __typename }
        waitTimeFee { totalCharge __typename }
        currentBalance
        customerFees { reason amount __typename }
        __typename
      }
      __typename
    }
    __typename
  }
}`;

// ── Supabase client (schema pedidosya_raw) ───────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: 'pedidosya_raw' as any },
  auth: { persistSession: false },
});

// ── Util ─────────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const monthRanges = (from: string, to: string): { start: string; end: string }[] => {
  const ranges: { start: string; end: string }[] = [];
  let cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
    const rangeEnd = monthEnd > end ? end : monthEnd;
    ranges.push({ start: fmtDate(cur), end: fmtDate(rangeEnd) });
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return ranges;
};
const weekRanges = (from: string, to: string): { start: Date; end: Date }[] => {
  const ranges: { start: Date; end: Date }[] = [];
  let cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T23:59:59Z`);
  while (cur <= end) {
    const weekEnd = new Date(cur); weekEnd.setUTCDate(weekEnd.getUTCDate() + 6); weekEnd.setUTCHours(23, 59, 59, 999);
    ranges.push({ start: new Date(cur), end: weekEnd > end ? end : weekEnd });
    cur = new Date(cur); cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return ranges;
};

// ── Login + captura de templates LITERALES (queries + headers + url) ─────────
type Template = { url: string; headers: Record<string, string>; body: any /* contiene query string completo */ };

async function loginAndCaptureTemplates(page: Page): Promise<Record<string, Template>> {
  const templates: Record<string, Template> = {};
  const NEEDED = ['ListPayouts', 'getInvoiceDetails', 'ListOrders'];

  page.on('request', (req) => {
    if (!req.url().includes('vagw-api')) return;
    const post = req.postData(); if (!post) return;
    let body: any; try { body = JSON.parse(post); } catch { return; }
    const op = body?.operationName;
    if (!op || !body?.query) return;
    if (NEEDED.includes(op) && !templates[op]) {
      templates[op] = { url: req.url(), headers: req.headers(), body };
      console.log(`   📡 Template capturado: ${op}`);
    }
  });

  const closeModals = async () => {
    for (const t of ['Ok','OK','Cancelar','NO, THANKS']) {
      const b = page.locator(`button:has-text("${t}")`).first();
      if (await b.count() > 0 && await b.isVisible({ timeout: 400 }).catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(1500); }
    }
  };

  // Login con reintentos + screenshot diagnóstico si falla
  console.log('▶ Login...');
  let loggedIn = false;
  for (let attempt = 1; attempt <= 3 && !loggedIn; attempt++) {
    if (attempt > 1) console.log(`   intento ${attempt}/3...`);
    await page.goto('https://portal-app.pedidosya.com/login', { waitUntil: 'domcontentloaded', timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(5000);
    if (!page.url().includes('/login')) { loggedIn = true; break; }

    console.log('   llenando credenciales...');
    await page.evaluate(`
      (function(email, password) {
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        var e = document.querySelector('input[name="email"]');
        var p = document.querySelector('input[name="password"], input[id*="password" i]');
        if (e) { setter.call(e, email); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }
        if (p) { var t=p.getAttribute('type'); p.setAttribute('type','text'); setter.call(p, password); p.dispatchEvent(new Event('input',{bubbles:true})); p.dispatchEvent(new Event('change',{bubbles:true})); setTimeout(function(){p.setAttribute('type', t||'password');},100); }
      })(${JSON.stringify(EMAIL)}, ${JSON.stringify(PASSWORD)})
    `);
    await page.waitForTimeout(2000);
    const submit = page.locator('button[type="submit"]').first();
    if (await submit.count() === 0 || !await submit.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('     ⚠ Submit button no visible — puede haber captcha PerimeterX latente');
      continue;
    }
    await submit.click().catch(e => console.log(`     ⚠ click submit: ${e.message.slice(0, 80)}`));
    // Esperar redirect (hasta 60s)
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);
      if (!page.url().includes('/login')) { loggedIn = true; break; }
    }
    if (!loggedIn) console.log(`     ⚠ Submit ejecutado pero URL sigue en /login después de 60s`);
  }

  if (!loggedIn) {
    const ssPath = `/tmp/pedidosya_login_failed_${Date.now()}.png`;
    await page.screenshot({ path: ssPath, fullPage: true }).catch(() => {});
    throw new Error(`Login falló tras 3 intentos. Screenshot: ${ssPath}`);
  }
  console.log(`   ✓ URL post-login: ${page.url().slice(0, 80)}`);
  await closeModals();

  // 1. /finance → captura ListPayouts
  console.log('▶ Cargar /finance (captura ListPayouts)...');
  for (let attempt = 1; attempt <= 3 && !templates['ListPayouts']; attempt++) {
    await page.goto('https://portal-app.pedidosya.com/finance', { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(20_000);
    await closeModals();
    if (!templates['ListPayouts']) console.log(`   intento ${attempt}: ListPayouts no capturado, reintentar`);
  }

  // 2. Click en factura pendiente → captura getInvoiceDetails
  if (!templates['getInvoiceDetails']) {
    console.log('▶ Click en factura pendiente (captura getInvoiceDetails)...');
    for (let attempt = 1; attempt <= 3 && !templates['getInvoiceDetails']; attempt++) {
      const facturaPend = page.locator('text=/9701181922|FACTURA/i').first();
      if (await facturaPend.count() > 0 && await facturaPend.isVisible({ timeout: 1500 }).catch(() => false)) {
        await facturaPend.click({ force: true, timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(8_000);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(2_000);
      } else {
        console.log(`   intento ${attempt}: factura no visible, recargar /finance`);
        await page.goto('https://portal-app.pedidosya.com/finance', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
        await page.waitForTimeout(15_000);
      }
    }
  }

  // 3. /orders → captura ListOrders
  console.log('▶ Cargar /orders (captura ListOrders)...');
  for (let attempt = 1; attempt <= 3 && !templates['ListOrders']; attempt++) {
    await page.goto('https://portal-app.pedidosya.com/orders', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(20_000);
    await closeModals();
    if (!templates['ListOrders']) console.log(`   intento ${attempt}: ListOrders no capturado, reintentar`);
  }

  // getInvoiceDetails: si no se capturó vivo, construir template usando el query
  // INLINE + headers/URL frescos de ListPayouts (mismo gateway, mismo auth).
  if (!templates['getInvoiceDetails'] && templates['ListPayouts']) {
    templates['getInvoiceDetails'] = {
      url: templates['ListPayouts'].url,
      headers: templates['ListPayouts'].headers,
      body: { operationName: 'getInvoiceDetails', query: GET_INVOICE_DETAILS_QUERY, variables: {} },
    };
    console.log(`   ✓ getInvoiceDetails template construido inline (auth fresco de ListPayouts)`);
  }

  const NEEDED_ALL = [...NEEDED, 'getInvoiceDetails'];
  const missing = NEEDED_ALL.filter(o => !templates[o]);
  if (missing.length > 0) throw new Error(`Faltan templates: ${missing.join(', ')}`);
  console.log(`✓ Templates capturados: ${Object.keys(templates).join(', ')}`);
  return templates;
}

// ── GraphQL helper — page.request.post (funciona para queries de finance) ────
// Para ListOrders devuelve 403 por PerimeterX (ver phaseOrders).
async function gql(page: Page, t: Template, variables: any): Promise<any> {
  const headers = Object.fromEntries(
    Object.entries(t.headers).filter(([k]) => {
      const lk = k.toLowerCase();
      return !lk.startsWith(':') && lk !== 'cookie' && lk !== 'host' && lk !== 'content-length';
    })
  );
  const body = { ...t.body, variables };  // reusa operationName + query LITERAL
  const resp = await page.request.post(t.url, { headers, data: body, timeout: 60_000 });
  const txt = await resp.text();
  if (resp.status() !== 200) throw new Error(`HTTP ${resp.status()}: ${txt.slice(0, 200)}`);
  let json: any;
  try { json = JSON.parse(txt); } catch { throw new Error(`Bad JSON: ${txt.slice(0, 200)}`); }
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0, 300)}`);
  return json.data;
}

// ── Phase 1+2: Payouts + Invoices ────────────────────────────────────────────
// IMPORTANTE: el portal devuelve invoices AGREGADOS para toda FOODIX por semana
// (no desglosa por sucursal individual). El detalle por sucursal solo viene en
// ListOrders (bloqueado por PerimeterX, queda para v2).
// Por eso pedimos UN solo ListPayouts por mes con TODOS los accounts.
async function phasePayoutsAndInvoices(page: Page, t: Record<string, Template>, runId: number): Promise<{ payouts: number; invoices: number; errors: string[] }> {
  const ranges = monthRanges(FROM, TO);
  let totalPayouts = 0, totalInvoices = 0;
  const errors: string[] = [];

  for (const r of ranges) {
    console.log(`\n  📅 Mes ${r.start} → ${r.end}`);

    {
      // Single iteration con TODOS los accounts juntos
      const acct = { grid: '', billingParentId: '197177', chainId: '', vendorId: '' };
      let payouts: any[] = [];
      try {
        const data = await gql(page, t.ListPayouts, {
          params: {
            startDate: r.start, endDate: r.end,
            globalEntityId: 'PY_EC',
            accounts: ACCOUNTS_PARAM,
            filter: {},
          },
        });
        payouts = data?.finances?.listPayouts?.payouts || [];
        console.log(`     ListPayouts → ${payouts.length} payouts`);
      } catch (e: any) {
        const m = `ListPayouts ${r.start}: ${e.message.slice(0, 120)}`;
        console.log(`     ⚠ ${m}`); errors.push(m); continue;
      }

      const payoutsRows: any[] = [];
      const invoiceQueue: { invoiceId: string; processedDate: string; payoutId: string; gridCode: string; chainId: string }[] = [];

      for (const p of payouts) {
        const payoutId = String(p.payoutId || p.id);
        // Mapping de campos REAL (capturado del response):
        // - p.payoutAmount = monto total transferido
        // - p.at = processedDate (fecha efectiva)
        // - p.payoutAccount = { grid, chainId, billingParentId }
        // - p.invoices = array de Invoice
        const payoutAccount = p.payoutAccount || {};
        // String vacío → NULL para que la FK a mapeo_centro_costo no falle
        const gridFromResponse = (payoutAccount.grid && payoutAccount.grid.length > 0) ? payoutAccount.grid
                                : (acct.grid && acct.grid.length > 0) ? acct.grid : null;
        const chainFromResponse = (payoutAccount.chainId && payoutAccount.chainId.length > 0) ? payoutAccount.chainId
                                : (acct.chainId && acct.chainId.length > 0) ? acct.chainId : null;

        payoutsRows.push({
          payout_id: payoutId,
          global_entity_id: p.globalEntityId || 'PY_EC',
          billing_parent_id: payoutAccount.billingParentId || acct.billingParentId,
          grid_code: gridFromResponse,
          chain_id: chainFromResponse || null,
          status: p.status || null,
          total_amount: p.payoutAmount ?? p.totalPayout ?? p.totalAmount ?? null,
          currency: p.payoutCurrency || p.currency || 'USD',
          processed_date: p.at || p.processedDate || null,
          payout_period_start: p.startDate || null,
          payout_period_end: p.endDate || null,
          invoices_count: (p.invoices || []).length || null,
          attachments: p.payoutAttachments || p.attachments || null,
          raw_extra: p,
          scrape_run_id: runId,
        });

        for (const inv of (p.invoices || [])) {
          const invAccount = inv.invoiceAccount || {};
          const invGrid = (invAccount.grid && invAccount.grid.length > 0) ? invAccount.grid
                        : gridFromResponse;
          const invChain = (invAccount.chainId && invAccount.chainId.length > 0) ? invAccount.chainId
                         : chainFromResponse;
          invoiceQueue.push({
            invoiceId: String(inv.invoiceId || inv.id),
            processedDate: inv.processedDate || p.at,
            payoutId,
            gridCode: invGrid as any,
            chainId: invChain as any,
          });
        }
      }

      if (payoutsRows.length > 0) {
        const { error } = await supabase.from('payouts').upsert(payoutsRows, { onConflict: 'payout_id' });
        if (error) { console.log(`     ⚠ upsert payouts grid=${acct.grid}: ${error.message}`); errors.push(`upsert payouts ${r.start} grid=${acct.grid}: ${error.message}`); }
        else { totalPayouts += payoutsRows.length; }
      }

      if (PHASE === 'all' || PHASE === 'invoices') {
        let okInv = 0;
        for (const q of invoiceQueue) {
          try {
            const d = await gql(page, t.getInvoiceDetails, {
              params: {
                invoiceId: q.invoiceId,
                processedDate: q.processedDate,
                globalEntityId: 'PY_EC',
                accounts: [{ grid: q.gridCode, billingParentId: '197177', chainId: q.chainId || '' }],
              },
            });
            const inv = d?.finances?.getInvoiceDetails?.invoice || {};
            const bd = d?.finances?.getInvoiceDetails?.breakdown || {};
            const row = {
              invoice_id: String(inv.id || q.invoiceId),
              payout_id: q.payoutId,
              global_entity_id: inv.globalEntityId || 'PY_EC',
              billing_parent_id: '197177',
              grid_code: q.gridCode,
              chain_id: q.chainId,
              invoice_start_date: inv.earningsPeriod?.invoiceStartDate || null,
              invoice_end_date: inv.earningsPeriod?.invoiceEndDate || null,
              processed_date: inv.processedDate || q.processedDate,
              orders_count: inv.ordersCount || null,
              currency: inv.currency || 'USD',
              gross_sales: bd.grossSales ?? null,
              total_commissions: bd.commissions?.total ?? null,
              total_net_payout: d?.finances?.getInvoiceDetails?.totalNetPayout ?? null,
              taxes: d?.finances?.getInvoiceDetails?.taxes ?? null,
              delivery_fees: bd.additionalSales?.deliveryFees ?? null,
              packaging_fees: bd.additionalSales?.packagingFees ?? null,
              mov_fees: bd.additionalSales?.movFees ?? null,
              food_cost_reimbursement: bd.additionalSales?.foodCostReimbursement ?? null,
              additional_sales_total: bd.additionalSales?.total ?? null,
              marketing_fees_total: bd.marketingFees?.total ?? null,
              additional_fees_total: bd.additionalFees?.total ?? null,
              cash_collected: bd.cashCollected ?? null,
              attachments: inv.attachments || null,
              invoice_breakdown: bd,
              raw_extra: d?.finances?.getInvoiceDetails,
              scrape_run_id: runId,
            };
            const { error } = await supabase.from('invoices').upsert(row, { onConflict: 'invoice_id' });
            if (error) {
              const m = `upsert invoice ${q.invoiceId}: ${error.message}`;
              console.log(`        ⚠ ${m}`); errors.push(m);
            } else okInv++;
            await sleep(200);
          } catch (e: any) {
            const m = `getInvoiceDetails ${q.invoiceId}: ${e.message.slice(0, 120)}`;
            console.log(`        ⚠ ${m}`); errors.push(m);
          }
        }
        totalInvoices += okInv;
        if (invoiceQueue.length > 0) console.log(`     [${acct.grid}] ✓ ${okInv}/${invoiceQueue.length} invoices`);
      }
      await sleep(300);
    }
  }
  return { payouts: totalPayouts, invoices: totalInvoices, errors };
}

// ── Phase 3: Orders ──────────────────────────────────────────────────────────
let stagingEnsured = false;
async function ensureStagingInvoice() {
  if (stagingEnsured) return;
  await supabase.from('invoices').upsert({
    invoice_id: '__STAGING__', global_entity_id: 'PY_EC', billing_parent_id: '197177',
    raw_extra: { note: 'staging para invoice_lines previo a vinculación' },
  }, { onConflict: 'invoice_id' });
  stagingEnsured = true;
}

async function phaseOrders(page: Page, t: Record<string, Template>, runId: number): Promise<{ orders: number; errors: string[] }> {
  await ensureStagingInvoice();
  const ranges = weekRanges(FROM, TO);
  let total = 0;
  const errors: string[] = [];

  for (const r of ranges) {
    console.log(`\n  📅 Semana ${fmtDate(r.start)} → ${fmtDate(r.end)}`);
    let nextPageToken: string | undefined = undefined;
    let pageNum = 0;
    do {
      pageNum++;
      try {
        const variables: any = {
          params: {
            pagination: { pageSize: 50, ...(nextPageToken ? { pageToken: nextPageToken } : {}) },
            timeFrom: r.start.toISOString(),
            timeTo: r.end.toISOString(),
            globalVendorCodes: VENDOR_CODES_PARAM,
          },
        };
        const d = await gql(page, t.ListOrders, variables);
        const orders = d?.orders?.listOrders?.orders || [];
        nextPageToken = d?.orders?.listOrders?.nextPageToken || undefined;

        if (orders.length > 0) {
          const rows = orders.map((o: any) => ({
            invoice_id: '__STAGING__',
            payout_id: null,
            grid_code: VENDOR_TO_GRID[o.vendorId] || null,
            order_display_id: String(o.orderId),
            order_id_interno: null,
            order_date: o.placedTimestamp,
            gross_amount: o.subtotal ?? null,
            commission_amount: o.billing?.commissionAmount != null ? -Math.abs(o.billing.commissionAmount) : null,
            commission_pct: (o.billing?.commissionAmount != null && o.subtotal) ? Number((o.billing.commissionAmount / o.subtotal * 100).toFixed(2)) : null,
            marketing_fees: null, additional_fees: null,
            discount_by_brand: null, discount_by_self: null,
            net_amount: o.billing?.netRevenue ?? null,
            payment_method: null,
            order_status: o.orderStatus || null,
            raw_line: o,
            scrape_run_id: runId,
          }));
          const { error } = await supabase.from('invoice_lines').upsert(rows, { onConflict: 'order_display_id' });
          if (error) {
            const m = `upsert orders ${fmtDate(r.start)} pg ${pageNum}: ${error.message}`;
            console.log(`     ⚠ ${m}`); errors.push(m);
          } else { total += rows.length; console.log(`     ✓ pg ${pageNum}: ${rows.length} orders (next=${nextPageToken ? 'yes' : 'no'})`); }
        }
      } catch (e: any) {
        const m = `ListOrders ${fmtDate(r.start)} pg ${pageNum}: ${e.message.slice(0, 120)}`;
        console.log(`     ⚠ ${m}`); errors.push(m); break;
      }
      await sleep(400);
    } while (nextPageToken);
  }
  return { orders: total, errors };
}

// ── Phase 4: Link ────────────────────────────────────────────────────────────
async function phaseLink(): Promise<number> {
  console.log('  Vinculando invoice_lines con invoices reales...');
  const { data: invs, error: invErr } = await supabase.from('invoices')
    .select('invoice_id, payout_id, grid_code, invoice_start_date, invoice_end_date')
    .neq('invoice_id', '__STAGING__');
  if (invErr || !invs) { console.log(`  ⚠ ${invErr?.message}`); return 0; }
  console.log(`  ${invs.length} invoices candidatos`);

  let linked = 0;
  for (const inv of invs) {
    if (!inv.invoice_start_date || !inv.invoice_end_date || !inv.grid_code) continue;
    const startTs = new Date(`${inv.invoice_start_date}T00:00:00.000Z`).toISOString();
    const endTs = new Date(`${inv.invoice_end_date}T23:59:59.999Z`).toISOString();
    const { error, count } = await supabase.from('invoice_lines')
      .update({ invoice_id: inv.invoice_id, payout_id: inv.payout_id }, { count: 'exact' })
      .eq('grid_code', inv.grid_code)
      .gte('order_date', startTs)
      .lte('order_date', endTs)
      .eq('invoice_id', '__STAGING__');
    if (error) console.log(`     ⚠ link ${inv.invoice_id}: ${error.message}`);
    else if (count) linked += count;
  }
  console.log(`  ✓ ${linked} invoice_lines vinculadas`);
  return linked;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`Backfill PedidosYa  range=[${FROM} → ${TO}]  phase=${PHASE}`);
  console.log(`══════════════════════════════════════════════════════════\n`);
  const t0 = Date.now();

  const { data: run, error: runErr } = await supabase.from('scrape_runs').insert({
    tipo: 'backfill', rango_desde: FROM, rango_hasta: TO, status: 'running',
  }).select().single();
  if (runErr || !run) { console.error(`❌ scrape_runs insert: ${runErr?.message}`); process.exit(1); }
  const runId = run.id;
  console.log(`📊 scrape_run id=${runId}\n`);

  let pTotal = 0, iTotal = 0, oTotal = 0, lTotal = 0;
  const errors: string[] = [];

  const browser = await chromium.connectOverCDP(BROWSER_WSS);
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  try {
    const templates = await loginAndCaptureTemplates(page);

    if (PHASE === 'all' || PHASE === 'payouts' || PHASE === 'invoices') {
      console.log(`\n▶ FASE 1+2: ListPayouts + getInvoiceDetails`);
      const r = await phasePayoutsAndInvoices(page, templates, runId);
      pTotal = r.payouts; iTotal = r.invoices; errors.push(...r.errors);
    }

    if (PHASE === 'all' || PHASE === 'orders') {
      console.log(`\n▶ FASE 3: ListOrders`);
      const r = await phaseOrders(page, templates, runId);
      oTotal = r.orders; errors.push(...r.errors);
    }

    if (PHASE === 'all' || PHASE === 'link') {
      console.log(`\n▶ FASE 4: Vincular invoice_lines → invoices`);
      lTotal = await phaseLink();
    }
  } catch (e: any) {
    errors.push(e.message); console.error(`\n❌ ${e.message}`);
  } finally {
    await browser.close();
  }

  const dur = Math.round((Date.now() - t0) / 1000);
  await supabase.from('scrape_runs').update({
    finished_at: new Date().toISOString(),
    payouts_nuevos: pTotal,
    invoices_nuevos: iTotal,
    invoice_lines_nuev: oTotal,
    errores: errors.length,
    mensajes_error: errors.length ? errors.slice(0, 50) : null,
    duracion_seg: dur,
    status: errors.length ? 'failed' : 'ok',
  }).eq('id', runId);

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`✅ DONE en ${dur}s · payouts=${pTotal}  invoices=${iTotal}  orders=${oTotal}  vinculadas=${lTotal}  errores=${errors.length}`);
  console.log(`══════════════════════════════════════════════════════════\n`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
