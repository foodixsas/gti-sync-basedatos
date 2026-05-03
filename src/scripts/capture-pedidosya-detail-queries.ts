// PEDIDOSYA — Capturar request bodies REALES de las 3 queries clave del módulo Finance
// Necesarias para construir el scraper de producción:
//   1. getInvoiceDetails
//   2. getPayoutEarningsSummary (con withBreakdown:true)
//   3. RequestInvoice (download URL)
//
// Estrategia: Login → /finance → click "Ver detalle" en un payout → capturar todos los
// POSTs al gateway con operationName ∈ {getInvoiceDetails, getPayoutEarningsSummary, RequestInvoice}.

import { chromium, type Page, type Request } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS!;
const URL = 'https://portal-app.pedidosya.com/login';
const EMAIL = process.env.PEDIDOSYA_EMAIL!;
const PASSWORD = process.env.PEDIDOSYA_PASSWORD!;

const TARGET_OPERATIONS = ['getInvoiceDetails', 'getPayoutEarningsSummary', 'RequestInvoice'] as const;
const CAPTURE_ALL_OPS = true; // capturar TODAS las queries, no solo las target, para descubrir qué dispara cada acción

const OUT_DIR = path.join(process.cwd(), 'tmp-pedidosya-exploration', 'capture-detail-queries');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

async function login(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
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
  await page.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 90; i++) {
    if (await page.locator('text=/Live Orders|Pedidos|Dashboard|Finanzas|Finance/i').first().isVisible({ timeout: 200 }).catch(() => false) && i > 5) {
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
  operationName: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  response?: { status: number; headers: Record<string, string>; body_full: string };
  triggered_by: string;
  captured_at: string;
}

async function main() {
  if (!BROWSER_WSS) { console.error('❌ Falta BRIGHTDATA_BROWSER_WSS'); process.exit(1); }

  const browser = await chromium.connectOverCDP(BROWSER_WSS);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  const captured: CapturedQuery[] = [];
  let currentTrigger = 'initial-load';

  page.on('request', (req: Request) => {
    if (!req.url().includes('vagw-api') && !req.url().includes('bff-api')) return;
    const post = req.postData();
    if (!post) return;
    let body: any;
    try { body = JSON.parse(post); } catch { body = post; }
    const opName = body?.operationName || (typeof body === 'object' && Array.isArray(body) ? body[0]?.operationName : null);
    if (!opName) return;
    const isTarget = TARGET_OPERATIONS.includes(opName as any);
    if (isTarget || CAPTURE_ALL_OPS) {
      captured.push({
        operationName: opName,
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
        body,
        triggered_by: currentTrigger,
        captured_at: new Date().toISOString(),
      });
      console.log(`   📡 ${isTarget ? '⭐' : '·'} ${opName} (${currentTrigger})`);
    }
  });

  page.on('response', async (resp) => {
    if (!resp.url().includes('vagw-api') && !resp.url().includes('bff-api')) return;
    // Asociar con la captura más reciente del mismo URL sin response
    const idx = [...captured].reverse().findIndex(c => c.url === resp.url() && !c.response);
    if (idx === -1) return;
    const realIdx = captured.length - 1 - idx;
    try {
      captured[realIdx].response = {
        status: resp.status(),
        headers: resp.headers(),
        body_full: await resp.text(),
      };
    } catch {}
  });

  try {
    console.log('▶ Login via BrightData...');
    await login(page);

    console.log('\n▶ Navegando a /finance...');
    currentTrigger = 'navigate-finance';
    let navOk = false;
    for (let i = 0; i < 3; i++) {
      try { await page.goto('https://portal-app.pedidosya.com/finance', { waitUntil: 'domcontentloaded', timeout: 90_000 }); navOk = true; break; }
      catch { await page.waitForTimeout(3000); }
    }
    if (!navOk) throw new Error('No cargó /finance');
    await page.waitForTimeout(15_000);

    // Cerrar modales
    for (const txt of ['Ok', 'OK', 'Cancelar', 'NO, THANKS', 'Cancel']) {
      const btn = page.locator(`button:has-text("${txt}")`).first();
      if (await btn.count() > 0 && await btn.isVisible({ timeout: 400 }).catch(() => false)) {
        await btn.click().catch(() => {}); await page.waitForTimeout(1500);
      }
    }
    await page.waitForTimeout(3000);

    // ── ACCIÓN 1: Click en "Ver detalles" del header (Summary) ──
    console.log('\n▶ ACCIÓN 1: Click en "Ver detalles" del Summary del header...');
    currentTrigger = 'click-ver-detalles-summary';
    const verDetallesSummary = page.locator('a:has-text("Ver detalles"), button:has-text("Ver detalles"), a:has-text("View details")').first();
    if (await verDetallesSummary.count() > 0 && await verDetallesSummary.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('   ✓ Encontrado, click...');
      await verDetallesSummary.click({ force: true, timeout: 8_000 }).catch(e => console.log(`   ⚠ ${e.message.slice(0, 100)}`));
      await page.waitForTimeout(10_000);
      // Cerrar el modal/drawer si abrió
      const closeBtn = page.locator('button[aria-label*="lose" i], button:has-text("Cerrar"), button:has-text("Close"), [data-testid*="close"]').first();
      if (await closeBtn.count() > 0 && await closeBtn.isVisible({ timeout: 800 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2000);
      } else {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(2000);
      }
    } else {
      console.log('   ⚠ No encontrado');
    }

    // ── ACCIÓN 2: Click en una FILA de payout (la fila completa) ──
    console.log('\n▶ ACCIÓN 2: Click en fila de payout 600007262441...');
    currentTrigger = 'click-payout-row';
    // El contenedor de la fila — usar texto del payout id como ancla
    const payoutRow = page.locator('text=/600007262441|618006905304|610007112376/').first();
    if (await payoutRow.count() > 0 && await payoutRow.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('   ✓ Encontrada fila, click...');
      await payoutRow.click({ force: true, timeout: 8_000 }).catch(e => console.log(`   ⚠ ${e.message.slice(0, 100)}`));
      await page.waitForTimeout(10_000);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(2000);
    } else {
      console.log('   ⚠ No encontrada');
    }

    // ── ACCIÓN 3: Click en "Factura pendiente" (la fila roja arriba) ──
    console.log('\n▶ ACCIÓN 3: Click en factura pendiente 9701181922...');
    currentTrigger = 'click-factura-pendiente';
    const facturaPend = page.locator('text=/9701181922|FACTURA/').first();
    if (await facturaPend.count() > 0 && await facturaPend.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('   ✓ Encontrada, click...');
      await facturaPend.click({ force: true, timeout: 8_000 }).catch(e => console.log(`   ⚠ ${e.message.slice(0, 100)}`));
      await page.waitForTimeout(10_000);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(2000);
    } else {
      console.log('   ⚠ No encontrada');
    }

    // ── ACCIÓN 4: Click en ícono download de un payout ──
    console.log('\n▶ ACCIÓN 4: Click en download del payout 600007262441...');
    currentTrigger = 'click-download-payout';
    const downloadBtn = page.locator('button[data-testid="download-600007262441"], button[data-testid^="download-"]').first();
    if (await downloadBtn.count() > 0 && await downloadBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('   ✓ Encontrado, click...');
      await downloadBtn.scrollIntoViewIfNeeded().catch(() => {});
      await downloadBtn.click({ force: true, timeout: 8_000 }).catch(e => console.log(`   ⚠ ${e.message.slice(0, 100)}`));
      await page.waitForTimeout(15_000);
    } else {
      console.log('   ⚠ No encontrado');
    }

    // ── ACCIÓN 5: Click en "Descargar todos" ──
    console.log('\n▶ ACCIÓN 5: Click en "Descargar todos"...');
    currentTrigger = 'click-descargar-todos';
    const descargarTodos = page.locator('button:has-text("Descargar todos"), button:has-text("Download all"), a:has-text("Descargar todos")').first();
    if (await descargarTodos.count() > 0 && await descargarTodos.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('   ✓ Encontrado, click...');
      await descargarTodos.click({ force: true, timeout: 8_000 }).catch(e => console.log(`   ⚠ ${e.message.slice(0, 100)}`));
      await page.waitForTimeout(10_000);
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      console.log('   ⚠ No encontrado');
    }

    // ── Análisis ──
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('RESULTADOS — Por trigger');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`\n📡 Total queries capturadas: ${captured.length}`);

    const byTrigger: Record<string, string[]> = {};
    captured.forEach(c => {
      (byTrigger[c.triggered_by] ||= []).push(c.operationName);
    });
    for (const [trig, ops] of Object.entries(byTrigger)) {
      console.log(`\n   📍 ${trig}: ${ops.length} ops`);
      const counts: Record<string, number> = {};
      ops.forEach(op => counts[op] = (counts[op] || 0) + 1);
      Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([op, n]) => {
        const star = TARGET_OPERATIONS.includes(op as any) ? '⭐' : ' ';
        console.log(`      ${star} ${op} ×${n}`);
      });
    }

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('RESULTADOS — Por target operation');
    console.log('══════════════════════════════════════════════════════════');
    for (const op of TARGET_OPERATIONS) {
      const matches = captured.filter(c => c.operationName === op);
      console.log(`\n   ${op}: ${matches.length} captura(s)`);
      matches.slice(0, 2).forEach((m, i) => {
        console.log(`   [${i + 1}] triggered_by=${m.triggered_by}`);
        console.log(`       variables: ${JSON.stringify(m.body.variables || {}).slice(0, 250)}`);
        if (m.response) {
          console.log(`       response_status: ${m.response.status}`);
          console.log(`       response_size: ${m.response.body_full.length}b`);
        }
      });
    }

    // ── Guardar templates para producción ──
    const templatesByOp: Record<string, any> = {};
    for (const op of TARGET_OPERATIONS) {
      const first = captured.find(c => c.operationName === op);
      if (first) {
        templatesByOp[op] = {
          url: first.url,
          method: first.method,
          headers_template: first.headers,
          body_template: first.body,
          example_response: first.response?.body_full?.slice(0, 5000),
        };
      }
    }

    const outFile = path.join(OUT_DIR, `${ts()}_capture_results.json`);
    fs.writeFileSync(outFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      target_operations: TARGET_OPERATIONS,
      captured_count: captured.length,
      templates: templatesByOp,
      all_captures: captured,
    }, null, 2));
    console.log(`\n💾 Templates guardados: ${outFile}`);

    await page.screenshot({ path: path.join(OUT_DIR, `${ts()}_final_state.png`), fullPage: true });

    console.log('\n⏸ 30s antes de cerrar...');
    await page.waitForTimeout(30_000);

  } catch (e: any) {
    console.error('❌', e.message, e.stack?.split('\n').slice(0, 3).join('\n'));
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
