// PEDIDOSYA — Capturar query GraphQL que devuelve pedidos individuales (para invoice_lines)
// Estrategia: navegar a varias secciones del portal (Pedidos, Reports, Operations) y
// capturar TODAS las queries GraphQL — luego filtrar por las que devuelvan arrays de pedidos
// con campos commission/gross/order_id.

import { chromium, type Page, type Request } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS!;
const URL = 'https://portal-app.pedidosya.com/login';
const EMAIL = process.env.PEDIDOSYA_EMAIL!;
const PASSWORD = process.env.PEDIDOSYA_PASSWORD!;

// Queries que YA conocemos — las ignoramos para enfocarnos en las nuevas
const KNOWN_OPS = new Set([
  'getPayoutEarningsSummary', 'ListPayouts', 'ListOutstandingInvoices',
  'getInvoiceDetails', 'GetLoanOffers', 'GetBulkPayoutDownloadCounts',
  'RequestBulkDownloadPayouts', 'IsUserEligibleForLoan', 'getCombinedPayout',
  'getPayNowDetails',
]);

const OUT_DIR = path.join(process.cwd(), 'tmp-pedidosya-exploration', 'orders-query');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

async function login(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  if (!page.url().includes('/login')) {
    console.log(`   ✓ Sesión activa: ${page.url().slice(0, 80)}`);
    return;
  }
  const fillScript = `
    (function(email, password) {
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      var e = document.querySelector('input[name="email"]');
      var p = document.querySelector('input[name="password"], input[id*="password" i]');
      if (e) { setter.call(e, email); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }
      if (p) { var t=p.getAttribute('type'); p.setAttribute('type','text'); setter.call(p, password); p.dispatchEvent(new Event('input',{bubbles:true})); p.dispatchEvent(new Event('change',{bubbles:true})); setTimeout(function(){p.setAttribute('type', t||'password');},100); }
    })(${JSON.stringify(EMAIL)}, ${JSON.stringify(PASSWORD)})
  `;
  await page.evaluate(fillScript);
  await page.waitForTimeout(1500);
  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count() > 0 && await submit.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submit.click();
  }
  for (let i = 0; i < 90; i++) {
    if (await page.locator('text=/Live Orders|Pedidos|Dashboard|Finanzas|Procesamiento/i').first().isVisible({ timeout: 200 }).catch(() => false) && i > 5) {
      await page.waitForTimeout(3000);
      const cancel = page.locator('button:has-text("Cancelar"), button:has-text("Ok"), button:has-text("OK")').first();
      if (await cancel.count() > 0 && await cancel.isVisible({ timeout: 800 }).catch(() => false)) {
        await cancel.click().catch(() => {}); await page.waitForTimeout(1500);
      }
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('Portal NO cargó');
}

interface CapturedQuery {
  trigger: string;
  op: string;
  url: string;
  variables?: any;
  query_text?: string;
  response?: { status: number; body_full: string };
  has_orders_array?: boolean;
  sample_order_fields?: string[];
}

async function main() {
  if (!BROWSER_WSS) { console.error('❌'); process.exit(1); }
  const browser = await chromium.connectOverCDP(BROWSER_WSS);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  const captured: CapturedQuery[] = [];
  let trigger = 'initial';

  page.on('request', (req: Request) => {
    if (!req.url().includes('vagw-api') && !req.url().includes('bff-api')) return;
    const post = req.postData();
    if (!post) return;
    let body: any;
    try { body = JSON.parse(post); } catch { return; }
    const op = body?.operationName || body?.[0]?.operationName;
    if (!op) return;
    captured.push({
      trigger, op,
      url: req.url(),
      variables: body.variables,
      query_text: typeof body.query === 'string' ? body.query.slice(0, 2000) : undefined,
    });
  });
  page.on('response', async (resp) => {
    if (!resp.url().includes('vagw-api') && !resp.url().includes('bff-api')) return;
    const idx = [...captured].reverse().findIndex(c => c.url === resp.url() && !c.response);
    if (idx === -1) return;
    const realIdx = captured.length - 1 - idx;
    try {
      const txt = await resp.text();
      captured[realIdx].response = { status: resp.status(), body_full: txt };
      // Heurística: ¿el response contiene un array de pedidos?
      if (/orderHistory|orders|orderList|nodes/i.test(txt) && txt.length > 1500) {
        captured[realIdx].has_orders_array = true;
        // Extraer keys del primer objeto del array
        try {
          const j = JSON.parse(txt);
          const findArrayWithOrders = (obj: any, depth = 0): any[] | null => {
            if (depth > 8 || !obj || typeof obj !== 'object') return null;
            if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
              const k = Object.keys(obj[0]);
              if (k.some(x => /id|order|amount|commission|date/i.test(x))) return obj;
            }
            for (const v of Object.values(obj)) {
              const r = findArrayWithOrders(v, depth + 1);
              if (r) return r;
            }
            return null;
          };
          const arr = findArrayWithOrders(j);
          if (arr && arr[0]) captured[realIdx].sample_order_fields = Object.keys(arr[0]);
        } catch {}
      }
    } catch {}
  });

  try {
    console.log('▶ Login via BrightData...');
    await login(page);

    // ── ACCIÓN 1: navegar a /live-orders (la sección "Procesamiento de pedidos") ──
    console.log('\n▶ ACCIÓN 1: navegar a /live-orders...');
    trigger = 'live-orders';
    try { await page.goto('https://portal-app.pedidosya.com/live-orders', { waitUntil: 'domcontentloaded', timeout: 60_000 }); await page.waitForTimeout(15_000); } catch (e: any) { console.log(`   ⚠ ${e.message.slice(0, 80)}`); }

    // Cerrar modales
    for (const txt of ['Ok','OK','Cancelar','NO, THANKS']) {
      const btn = page.locator(`button:has-text("${txt}")`).first();
      if (await btn.count() > 0 && await btn.isVisible({ timeout: 400 }).catch(() => false)) { await btn.click().catch(() => {}); await page.waitForTimeout(1500); }
    }

    // ── ACCIÓN 2: click en "Pedidos" del menú lateral (NO el del header) ──
    console.log('\n▶ ACCIÓN 2: click en menú lateral "Pedidos"...');
    trigger = 'sidebar-pedidos';
    const sidebarPedidos = page.locator('nav a:has-text("Pedidos"), aside a:has-text("Pedidos"), [role="navigation"] >> text="Pedidos"').first();
    if (await sidebarPedidos.count() > 0 && await sidebarPedidos.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('   ✓ Encontrado, click...');
      await sidebarPedidos.click({ force: true, timeout: 8_000 }).catch(e => console.log(`   ⚠ ${e.message.slice(0, 80)}`));
      await page.waitForTimeout(15_000);
    } else {
      console.log('   ⚠ No encontrado en sidebar');
    }

    // ── ACCIÓN 3: navegar a /reports ──
    console.log('\n▶ ACCIÓN 3: navegar a /reports...');
    trigger = 'reports';
    try { await page.goto('https://portal-app.pedidosya.com/reports', { waitUntil: 'domcontentloaded', timeout: 60_000 }); await page.waitForTimeout(15_000); } catch (e: any) { console.log(`   ⚠ ${e.message.slice(0, 80)}`); }

    // ── ACCIÓN 4: navegar a /orders explícitamente ──
    for (const candUrl of ['/orders', '/order-history', '/operations', '/orders-history', '/order-management']) {
      console.log(`\n▶ ACCIÓN 4 (${candUrl}): probando navegación...`);
      trigger = `goto-${candUrl}`;
      try { await page.goto(`https://portal-app.pedidosya.com${candUrl}`, { waitUntil: 'domcontentloaded', timeout: 30_000 }); await page.waitForTimeout(10_000); } catch (e: any) { console.log(`   ⚠ ${e.message.slice(0, 80)}`); }
    }

    // ── ACCIÓN 5: ir de nuevo a /finance + click en factura específica + buscar "Ver pedidos" ──
    console.log('\n▶ ACCIÓN 5: /finance + click factura + buscar "ver pedidos"...');
    trigger = 'finance-invoice-orders';
    try {
      await page.goto('https://portal-app.pedidosya.com/finance', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(15_000);
      // Click en factura pendiente para abrir detalle
      const facturaPend = page.locator('text=/9701181922|FACTURA/').first();
      if (await facturaPend.count() > 0 && await facturaPend.isVisible({ timeout: 1500 }).catch(() => false)) {
        await facturaPend.click({ force: true }).catch(() => {});
        await page.waitForTimeout(10_000);
        // Buscar botón "Ver pedidos" dentro del modal del invoice
        const verPedidos = page.locator('button:has-text("pedidos" i), a:has-text("pedidos" i), button:has-text("orders" i), button:has-text("Ver detalles"), button:has-text("Detalle")').first();
        if (await verPedidos.count() > 0 && await verPedidos.isVisible({ timeout: 1500 }).catch(() => false)) {
          console.log('   ✓ Encontrado botón orders, click...');
          await verPedidos.click({ force: true }).catch(() => {});
          await page.waitForTimeout(10_000);
        }
      }
    } catch (e: any) { console.log(`   ⚠ ${e.message.slice(0, 80)}`); }

    // ── Análisis ──
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('RESULTADOS — Queries CON array de orders detectado');
    console.log('══════════════════════════════════════════════════════════');
    const withOrders = captured.filter(c => c.has_orders_array);
    if (withOrders.length === 0) {
      console.log('   ⚠ Ninguna query devolvió un array que parezca pedidos');
    } else {
      withOrders.forEach(c => {
        console.log(`\n   📌 [${c.trigger}] ${c.op}`);
        console.log(`      variables: ${JSON.stringify(c.variables || {}).slice(0, 200)}`);
        console.log(`      sample fields: ${(c.sample_order_fields || []).join(', ')}`);
        console.log(`      response size: ${c.response?.body_full?.length || 0}b`);
      });
    }

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('TODAS las queries NUEVAS capturadas (no conocidas)');
    console.log('══════════════════════════════════════════════════════════');
    const newOps: Record<string, { count: number; triggers: Set<string>; sample: any }> = {};
    captured.forEach(c => {
      if (KNOWN_OPS.has(c.op)) return;
      if (!newOps[c.op]) newOps[c.op] = { count: 0, triggers: new Set(), sample: c };
      newOps[c.op].count++;
      newOps[c.op].triggers.add(c.trigger);
    });
    Object.entries(newOps).sort((a, b) => b[1].count - a[1].count).forEach(([op, info]) => {
      console.log(`\n   ${op.padEnd(50)} ×${info.count}  triggers=${[...info.triggers].join(',')}`);
      console.log(`      vars: ${JSON.stringify(info.sample.variables || {}).slice(0, 300)}`);
    });

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('CONTEO TOTAL por op (incluyendo conocidas)');
    console.log('══════════════════════════════════════════════════════════');
    const allOps: Record<string, number> = {};
    captured.forEach(c => allOps[c.op] = (allOps[c.op] || 0) + 1);
    Object.entries(allOps).sort((a, b) => b[1] - a[1]).forEach(([op, n]) =>
      console.log(`   ${KNOWN_OPS.has(op) ? '·' : '⭐'} ${op.padEnd(50)} ×${n}`));

    fs.writeFileSync(path.join(OUT_DIR, `${ts()}_all_captures.json`), JSON.stringify(captured, null, 2));
    console.log(`\n💾 Guardado: ${OUT_DIR}/${ts()}_all_captures.json`);

    console.log('\n⏸ 30s antes de cerrar...');
    await page.waitForTimeout(30_000);
  } catch (e: any) {
    console.error('❌', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
