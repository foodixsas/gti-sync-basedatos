// PEDIDOSYA — Captura PROFUNDA de Reviews + Ads + Vendor Deals (Promos)
// Estrategia:
//   1. Login BrightData
//   2. Por cada sección y cada vendor (6 grids):
//      a. Navegar a la URL
//      b. Capturar TODOS los requests GraphQL/REST + response bodies
//      c. Hacer interacciones que disparen más queries (filtros, paginación)
//      d. Snapshot del HTML para mapear UI → data
//   3. Persistir a disk para análisis offline
//
// Output: tmp-pedidosya-exploration/secciones-3/{ts}_<seccion>_<grid>.json

import { chromium, type Page, type Request } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS!;
const EMAIL = process.env.PEDIDOSYA_EMAIL!;
const PASSWORD = process.env.PEDIDOSYA_PASSWORD!;

const VENDORS = [
  { grid: 'HZUU1Y', vendorId: '238962', nombre: 'Chios Floreana' },
  { grid: '4F3TTD', vendorId: '210361', nombre: 'Chios Real Audiencia' },
  { grid: '4F3SJT', vendorId: '210792', nombre: 'Chios Portugal' },
  { grid: 'HRE4HC', vendorId: '528672', nombre: 'Santo Cachón' },
  { grid: 'HPQKWK', vendorId: '587373', nombre: 'Santo Cachón Portugal' },
  { grid: 'HAJUYT', vendorId: '480041', nombre: 'Simón Bolón' },
];

// Para Reviews probamos los 6 vendors. Para Ads/Deals probamos 1 vendor representativo
// (asumimos que las queries son las mismas, solo cambia vendorId).
const SECCIONES = [
  { id: 'reviews',           url: (v: typeof VENDORS[0]) => `https://portal-app.pedidosya.com/reviews?vendor=PY_EC;${v.vendorId}`,                  test_vendors: VENDORS.slice(0, 2) },
  { id: 'ads-premium',       url: (v: typeof VENDORS[0]) => `https://portal-app.pedidosya.com/promotion/premium-placement?vendor=PY_EC;${v.vendorId}`, test_vendors: VENDORS.slice(0, 1) },
  { id: 'vendor-deals',      url: (v: typeof VENDORS[0]) => `https://portal-app.pedidosya.com/vendor-deals?vendor=PY_EC;${v.vendorId}`,                test_vendors: VENDORS.slice(0, 1) },
];

const OUT_DIR = path.join(process.cwd(), 'tmp-pedidosya-exploration', 'secciones-3');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

interface Capture {
  trigger: string;
  url: string;
  method: string;
  domain: string;
  operationName?: string;
  variables?: any;
  query_text?: string;
  request_headers: Record<string, string>;
  request_body_raw?: string;
  response?: { status: number; headers: Record<string, string>; body: string; size: number };
  captured_at: string;
}

async function login(page: Page) {
  console.log('▶ Login con retry...');
  let loggedIn = false;
  for (let attempt = 1; attempt <= 4 && !loggedIn; attempt++) {
    if (attempt > 1) console.log(`   intento ${attempt}/4...`);
    await page.goto('https://portal-app.pedidosya.com/login', { waitUntil: 'domcontentloaded', timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(5000);
    if (!page.url().includes('/login')) { loggedIn = true; break; }
    await page.evaluate(`
      (function(email, password) {
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        var e = document.querySelector('input[name="email"]');
        var p = document.querySelector('input[name="password"], input[id*="password" i]');
        if (e) { setter.call(e, email); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }
        if (p) { var t=p.getAttribute('type'); p.setAttribute('type','text'); setter.call(p, password); p.dispatchEvent(new Event('input',{bubbles:true})); p.dispatchEvent(new Event('change',{bubbles:true})); setTimeout(function(){p.setAttribute('type', t||'password');},100); }
      })(${JSON.stringify(EMAIL)}, ${JSON.stringify(PASSWORD)})
    `);
    await page.waitForTimeout(2500);
    const submit = page.locator('button[type="submit"]').first();
    if (await submit.count() === 0 || !await submit.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('     ⚠ Submit no visible — posible captcha PerimeterX latente');
      await page.waitForTimeout(5000);
      continue;
    }
    await submit.click().catch(e => console.log(`     ⚠ click submit: ${e.message.slice(0, 80)}`));
    for (let i = 0; i < 90; i++) {
      await page.waitForTimeout(1000);
      if (!page.url().includes('/login')) { loggedIn = true; break; }
    }
    if (!loggedIn) console.log(`     URL post-submit: ${page.url().slice(0, 80)}`);
  }
  if (!loggedIn) throw new Error('Login falló tras 4 intentos. Posible captcha PerimeterX activo.');
  // Cerrar modales
  for (const t of ['Ok','OK','Cancelar','NO, THANKS']) {
    const b = page.locator(`button:has-text("${t}")`).first();
    if (await b.count() > 0 && await b.isVisible({ timeout: 400 }).catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(1500); }
  }
  console.log(`   ✓ Logueado: ${page.url().slice(0, 80)}`);
}

async function exploreSeccion(page: Page, seccion: typeof SECCIONES[0], vendor: typeof VENDORS[0]): Promise<{ captures: Capture[]; html: string; screenshotPath: string }> {
  const captures: Capture[] = [];
  let currentTrigger = `${seccion.id}-${vendor.grid}-load`;

  const onRequest = (req: Request) => {
    const url = req.url();
    // Filtrar dominios de interés (api gateways + bff)
    if (!/vagw-api|bff-api|portal-app\.pedidosya\.com\/api|prd\.portal\.restaurant|\.us\./i.test(url)) return;
    // Skip recursos estáticos
    if (/\.(png|jpg|gif|svg|woff|woff2|ttf|css|map|ico)(\?|$)/i.test(url)) return;
    if (url.startsWith('data:') || url.startsWith('blob:')) return;

    const post = req.postData();
    let body: any; let opName: string | undefined; let variables: any; let queryText: string | undefined;
    if (post) {
      try {
        body = JSON.parse(post);
        opName = body?.operationName || body?.[0]?.operationName;
        variables = body?.variables || body?.[0]?.variables;
        queryText = typeof body?.query === 'string' ? body.query : (typeof body?.[0]?.query === 'string' ? body[0].query : undefined);
      } catch {
        body = post;
      }
    }

    captures.push({
      trigger: currentTrigger,
      url,
      method: req.method(),
      domain: (url.match(/^https?:\/\/([^/]+)/) || [, 'unknown'])[1] || 'unknown',
      operationName: opName,
      variables,
      query_text: queryText?.slice(0, 3000),
      request_headers: req.headers(),
      request_body_raw: typeof body === 'string' ? body.slice(0, 500) : undefined,
      captured_at: new Date().toISOString(),
    });
  };

  const onResponse = async (resp: any) => {
    const url = resp.url();
    if (!/vagw-api|bff-api|portal-app\.pedidosya\.com\/api|prd\.portal\.restaurant/i.test(url)) return;
    if (/\.(png|jpg|gif|svg|woff|woff2|ttf|css|map|ico)(\?|$)/i.test(url)) return;

    const idx = [...captures].reverse().findIndex(c => c.url === url && !c.response);
    if (idx === -1) return;
    const realIdx = captures.length - 1 - idx;
    try {
      const txt = await resp.text();
      captures[realIdx].response = {
        status: resp.status(),
        headers: resp.headers(),
        body: txt.slice(0, 30_000),  // cap 30KB por response
        size: txt.length,
      };
    } catch {}
  };

  page.on('request', onRequest);
  page.on('response', onResponse);

  try {
    console.log(`\n  📍 ${seccion.id} → ${vendor.nombre} (${vendor.grid})`);
    const targetUrl = seccion.url(vendor);
    console.log(`     URL: ${targetUrl}`);
    currentTrigger = `${seccion.id}-${vendor.grid}-goto`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(e => console.log(`     ⚠ goto: ${e.message.slice(0, 80)}`));
    await page.waitForTimeout(15_000);

    // Cerrar modales que aparezcan
    for (const t of ['Ok','OK','Cancelar','Cerrar','Close','NO, THANKS']) {
      const b = page.locator(`button:has-text("${t}")`).first();
      if (await b.count() > 0 && await b.isVisible({ timeout: 400 }).catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(1000); }
    }

    // Interacciones específicas por sección para disparar más queries
    if (seccion.id === 'reviews') {
      // Intentar scroll para trigger pagination + click en filtros si existen
      currentTrigger = `${seccion.id}-${vendor.grid}-scroll`;
      await page.mouse.wheel(0, 1500).catch(() => {});
      await page.waitForTimeout(5_000);
      // Probar click en "Ver más" si existe
      const verMas = page.locator('button:has-text("Ver más"), button:has-text("Show more"), button:has-text("Cargar más")').first();
      if (await verMas.count() > 0 && await verMas.isVisible({ timeout: 800 }).catch(() => false)) {
        currentTrigger = `${seccion.id}-${vendor.grid}-vermas`;
        await verMas.click({ force: true }).catch(() => {});
        await page.waitForTimeout(5_000);
      }
    }

    if (seccion.id === 'ads-premium') {
      currentTrigger = `${seccion.id}-${vendor.grid}-explore-tabs`;
      // Click en cualquier tab visible
      const tabs = page.locator('[role="tab"], button[class*="tab" i]');
      const tabCount = await tabs.count();
      console.log(`     tabs encontrados: ${tabCount}`);
      for (let i = 0; i < Math.min(tabCount, 4); i++) {
        await tabs.nth(i).click({ force: true, timeout: 3_000 }).catch(() => {});
        await page.waitForTimeout(3_000);
      }
    }

    if (seccion.id === 'vendor-deals') {
      currentTrigger = `${seccion.id}-${vendor.grid}-explore`;
      // Click en cualquier deal/card visible
      const deals = page.locator('[class*="deal" i], [class*="promotion" i], [data-testid*="deal" i]').first();
      if (await deals.count() > 0 && await deals.isVisible({ timeout: 800 }).catch(() => false)) {
        await deals.click({ force: true }).catch(() => {});
        await page.waitForTimeout(5_000);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(2_000);
      }
    }

    // Snapshot HTML
    const html = await page.content().catch(() => '');
    const screenshotPath = path.join(OUT_DIR, `${ts()}_${seccion.id}_${vendor.grid}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    // Esperar un poco más para capturar requests tardíos
    await page.waitForTimeout(3_000);

    return { captures, html, screenshotPath };
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
  }
}

async function main() {
  if (!BROWSER_WSS) { console.error('❌'); process.exit(1); }
  const browser = await chromium.connectOverCDP(BROWSER_WSS);
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  try {
    await login(page);

    const allResults: any[] = [];

    for (const seccion of SECCIONES) {
      console.log(`\n══════════════════════════════════════════════════════════`);
      console.log(`SECCIÓN: ${seccion.id}`);
      console.log(`══════════════════════════════════════════════════════════`);
      for (const vendor of seccion.test_vendors) {
        const { captures, html, screenshotPath } = await exploreSeccion(page, seccion, vendor);
        const opCount: Record<string, number> = {};
        captures.forEach(c => {
          const k = c.operationName || `(REST) ${c.url.split('/').slice(-2).join('/').slice(0, 50)}`;
          opCount[k] = (opCount[k] || 0) + 1;
        });
        console.log(`     📊 ${captures.length} requests capturados, ops únicas:`);
        Object.entries(opCount).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([op, n]) =>
          console.log(`         • ${op.padEnd(50)} ×${n}`));

        // Guardar
        const outFile = path.join(OUT_DIR, `${ts()}_${seccion.id}_${vendor.grid}.json`);
        fs.writeFileSync(outFile, JSON.stringify({
          seccion: seccion.id, vendor, total_captures: captures.length, captures,
          html_size: html.length,
          screenshot: path.basename(screenshotPath),
        }, null, 2));
        // HTML separado para no inflar el JSON
        fs.writeFileSync(outFile.replace('.json', '.html'), html);

        allResults.push({ seccion: seccion.id, vendor: vendor.grid, captures: captures.length, ops: Object.keys(opCount) });
      }
    }

    // Resumen final
    console.log(`\n══════════════════════════════════════════════════════════`);
    console.log(`RESUMEN GLOBAL`);
    console.log(`══════════════════════════════════════════════════════════`);
    for (const r of allResults) {
      console.log(`  ${r.seccion.padEnd(20)} ${r.vendor.padEnd(8)} ${r.captures} requests, ops: ${r.ops.join(', ').slice(0, 200)}`);
    }

    fs.writeFileSync(path.join(OUT_DIR, `${ts()}_index.json`), JSON.stringify(allResults, null, 2));
    console.log(`\n💾 Index: ${OUT_DIR}/${ts()}_index.json`);

    await page.waitForTimeout(15_000);
  } catch (e: any) {
    console.error('❌', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
