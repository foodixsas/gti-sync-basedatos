// PEDIDOSYA — Verificar la primera fecha real de operación de FOODIX en PedidosYa
// Hace ListPayouts con varios rangos para detectar si:
//   (A) Los payouts del primer período están en feb (delay de pago)
//   (B) ListPayouts filtra por processedDate vs período de earnings
//   (C) Chios Burger NO operaba antes de feb 2025

import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS!;
const EMAIL = process.env.PEDIDOSYA_EMAIL!;
const PASSWORD = process.env.PEDIDOSYA_PASSWORD!;

const ACCOUNTS = [
  { grid: 'HZUU1Y', billingParentId: '197177', chainId: '0016900002hloN8' },
  { grid: '4F3TTD', billingParentId: '197177', chainId: '0016900002hloN8' },
  { grid: '4F3SJT', billingParentId: '197177', chainId: '0016900002hloN8' },
  { grid: 'HRE4HC', billingParentId: '197177', chainId: '' },
  { grid: 'HPQKWK', billingParentId: '197177', chainId: '' },
  { grid: 'HAJUYT', billingParentId: '197177', chainId: '' },
];

const RANGOS = [
  { name: '2024 ENTERO',     start: '2024-01-01', end: '2024-12-31' },
  { name: '2024-Q4',         start: '2024-10-01', end: '2024-12-31' },
  { name: '2024-12 + 2025-01', start: '2024-12-01', end: '2025-01-31' },
  { name: '2025-01 SOLO',    start: '2025-01-01', end: '2025-01-31' },
  { name: '2025-02 SOLO',    start: '2025-02-01', end: '2025-02-28' },
  { name: '2025-Q1',         start: '2025-01-01', end: '2025-03-31' },
];

const OUT_DIR = path.join(process.cwd(), 'tmp-pedidosya-exploration', 'historico-real');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

async function main() {
  const browser = await chromium.connectOverCDP(BROWSER_WSS);
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  let template: any = null;
  page.on('request', (req) => {
    if (template) return;
    if (!req.url().includes('vagw-api')) return;
    const post = req.postData(); if (!post) return;
    let body: any; try { body = JSON.parse(post); } catch { return; }
    if (body?.operationName === 'ListPayouts' && body?.query) {
      template = { url: req.url(), headers: req.headers(), body };
      console.log(`📡 Template ListPayouts capturado`);
    }
  });

  // Login
  console.log('▶ Login...');
  await page.goto('https://portal-app.pedidosya.com/login', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForTimeout(3000);
  if (page.url().includes('/login')) {
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
    await page.locator('button[type="submit"]').first().click();
    for (let i = 0; i < 60; i++) { if (!page.url().includes('/login')) break; await page.waitForTimeout(1000); }
  }
  console.log(`   URL post-login: ${page.url()}`);

  // Cargar /finance para capturar template
  console.log('▶ Cargar /finance...');
  for (let i = 0; i < 3 && !template; i++) {
    await page.goto('https://portal-app.pedidosya.com/finance', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(15_000);
  }
  if (!template) { console.error('❌ Sin template'); process.exit(1); }

  const safeHeaders = Object.fromEntries(
    Object.entries(template.headers).filter(([k]) => {
      const lk = k.toLowerCase();
      return !lk.startsWith(':') && lk !== 'cookie' && lk !== 'host' && lk !== 'content-length';
    })
  );

  async function runListPayouts(start: string, end: string, accounts: any[]) {
    const body = {
      ...template.body,
      variables: { params: { startDate: start, endDate: end, globalEntityId: 'PY_EC', accounts, filter: {} } },
    };
    const r = await page.request.post(template.url, { headers: safeHeaders, data: body, timeout: 60_000 });
    const txt = await r.text();
    if (r.status() !== 200) return { error: `HTTP ${r.status()}: ${txt.slice(0, 200)}` };
    const json = JSON.parse(txt);
    return { payouts: json?.data?.finances?.listPayouts?.payouts || [] };
  }

  const allResults: any[] = [];

  // PRUEBA 1: por cada rango con TODOS los accounts juntos
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('PRUEBA 1: ListPayouts con LOS 6 GRIDS juntos');
  console.log('══════════════════════════════════════════════════════════');
  for (const r of RANGOS) {
    const res = await runListPayouts(r.start, r.end, ACCOUNTS);
    if (res.error) {
      console.log(`   ❌ ${r.name.padEnd(25)} ${res.error}`);
    } else {
      const dates = res.payouts!.map((p: any) => p.at || p.processedDate).filter(Boolean).sort();
      const minDate = dates[0] || '-';
      const maxDate = dates[dates.length - 1] || '-';
      console.log(`   ${r.name.padEnd(25)} → ${String(res.payouts!.length).padStart(3)} payouts (range ${minDate} → ${maxDate})`);
      // Mostrar el invoice más antiguo
      const oldest = res.payouts!.flatMap((p: any) => (p.invoices || []).map((inv: any) => ({
        invoiceId: inv.invoiceId,
        period: inv.period,
        invoiceAmount: inv.invoiceAmount,
      }))).sort((a: any, b: any) => (a.period?.from || '').localeCompare(b.period?.from || ''))[0];
      if (oldest) console.log(`        ↳ invoice más antiguo: ${oldest.invoiceId} period ${oldest.period?.from} → ${oldest.period?.to} ($${oldest.invoiceAmount})`);
      allResults.push({ rango: r.name, ...res });
    }
  }

  // PRUEBA 2: por GRID INDIVIDUAL en 2024-Q4 + 2025-Q1
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('PRUEBA 2: ListPayouts POR GRID 2024-Q4 → 2025-03-31');
  console.log('══════════════════════════════════════════════════════════');
  for (const acct of ACCOUNTS) {
    const res = await runListPayouts('2024-10-01', '2025-03-31', [acct]);
    if (res.error) {
      console.log(`   ❌ ${acct.grid}  ${res.error}`);
    } else {
      const dates = res.payouts!.map((p: any) => p.at || p.processedDate).filter(Boolean).sort();
      console.log(`   ${acct.grid} → ${String(res.payouts!.length).padStart(3)} payouts (${dates[0] || '-'} → ${dates[dates.length-1] || '-'})`);
      const oldest = res.payouts!.flatMap((p: any) => (p.invoices || []).map((inv: any) => ({
        invoiceId: inv.invoiceId, period: inv.period, invoiceAmount: inv.invoiceAmount,
      }))).sort((a: any, b: any) => (a.period?.from || '').localeCompare(b.period?.from || ''))[0];
      if (oldest) console.log(`        ↳ invoice más antiguo: ${oldest.invoiceId} period ${oldest.period?.from} → ${oldest.period?.to} ($${oldest.invoiceAmount})`);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, `${ts()}_results.json`), JSON.stringify(allResults, null, 2));
  console.log(`\n💾 Guardado: ${OUT_DIR}/${ts()}_results.json`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
