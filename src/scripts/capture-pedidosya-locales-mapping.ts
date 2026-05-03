// PEDIDOSYA — Capturar el mapeo grid_code → nombre real del local
// Estrategia: abrir el dropdown "6/6 Locales" del header de Finanzas,
// y/o navegar a la sección de Configuración → Locales, y capturar todas las
// queries GraphQL que devuelvan metadata de los vendors.

import { chromium, type Page, type Request } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS!;
const URL = 'https://portal-app.pedidosya.com/login';
const EMAIL = process.env.PEDIDOSYA_EMAIL!;
const PASSWORD = process.env.PEDIDOSYA_PASSWORD!;

const KNOWN_GRIDS = ['HZUU1Y', '4F3TTD', '4F3SJT', 'HRE4HC', 'HPQKWK', 'HAJUYT'];

const OUT_DIR = path.join(process.cwd(), 'tmp-pedidosya-exploration', 'locales-mapping');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

async function login(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  // Si ya estamos logueados (redirigió fuera de /login), salir
  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    console.log(`   ✓ Sesión activa, URL: ${currentUrl.slice(0, 80)}`);
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
  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.count() === 0 || !await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('   ⚠ Submit button no visible — posible que ya esté logueado');
    return;
  }
  await submitBtn.click();
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

async function main() {
  if (!BROWSER_WSS) { console.error('❌'); process.exit(1); }
  const browser = await chromium.connectOverCDP(BROWSER_WSS);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  const captured: any[] = [];
  let trigger = 'initial';
  page.on('request', (req: Request) => {
    if (!req.url().includes('vagw-api') && !req.url().includes('bff-api') && !req.url().includes('portal-app.pedidosya.com/api')) return;
    const post = req.postData();
    if (!post) return;
    let body: any;
    try { body = JSON.parse(post); } catch { body = post; }
    const opName = body?.operationName || body?.[0]?.operationName || 'REST';
    captured.push({ trigger, op: opName, url: req.url(), body, headers: req.headers() });
  });
  page.on('response', async (resp) => {
    if (!resp.url().includes('vagw-api') && !resp.url().includes('bff-api') && !resp.url().includes('portal-app.pedidosya.com/api')) return;
    const idx = [...captured].reverse().findIndex(c => c.url === resp.url() && !c.response);
    if (idx === -1) return;
    const realIdx = captured.length - 1 - idx;
    try {
      const txt = await resp.text();
      captured[realIdx].response = { status: resp.status(), body: txt };
      // Si la respuesta menciona algún grid conocido, marcarla
      const gridsFound = KNOWN_GRIDS.filter(g => txt.includes(g));
      if (gridsFound.length > 0) {
        captured[realIdx].grids_in_response = gridsFound;
      }
    } catch {}
  });

  try {
    console.log('▶ Login...');
    await login(page);

    console.log('\n▶ Cargando /finance...');
    trigger = 'navigate-finance';
    for (let i = 0; i < 3; i++) {
      try { await page.goto('https://portal-app.pedidosya.com/finance', { waitUntil: 'domcontentloaded', timeout: 90_000 }); break; }
      catch { await page.waitForTimeout(3000); }
    }
    await page.waitForTimeout(15_000);

    // Cerrar modales
    for (const txt of ['Ok', 'OK', 'Cancelar', 'NO, THANKS']) {
      const btn = page.locator(`button:has-text("${txt}")`).first();
      if (await btn.count() > 0 && await btn.isVisible({ timeout: 400 }).catch(() => false)) {
        await btn.click().catch(() => {}); await page.waitForTimeout(1500);
      }
    }
    await page.waitForTimeout(3000);

    // ── ACCIÓN 1: clickear el dropdown "6/6 Locales" del header ──
    console.log('\n▶ ACCIÓN 1: Abrir dropdown "Locales" del header...');
    trigger = 'open-locales-dropdown';
    const localesBtn = page.locator(
      'button:has-text("Locales"), button:has-text("Locations"), [data-testid*="local" i], [data-testid*="store" i], button:has-text("/6")'
    ).first();
    if (await localesBtn.count() > 0 && await localesBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('   ✓ Dropdown encontrado, click...');
      await localesBtn.scrollIntoViewIfNeeded().catch(() => {});
      await localesBtn.click({ force: true, timeout: 5_000 }).catch(e => console.log(`   ⚠ ${e.message.slice(0, 80)}`));
      await page.waitForTimeout(8_000);
      // Capturar HTML del dropdown abierto
      const dropdownHtml = await page.locator('[role="dialog"], [role="listbox"], [role="menu"]').first().innerHTML().catch(() => '');
      if (dropdownHtml) {
        fs.writeFileSync(path.join(OUT_DIR, `${ts()}_dropdown.html`), dropdownHtml);
        console.log(`   💾 Dropdown HTML guardado (${dropdownHtml.length}b)`);
      }
      // Screenshot del dropdown abierto
      await page.screenshot({ path: path.join(OUT_DIR, `${ts()}_dropdown_open.png`) });
      // Cerrar
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(2_000);
    } else {
      console.log('   ⚠ Dropdown locales NO encontrado en header');
    }

    // ── ACCIÓN 2: navegar a /vendor o /settings o /configuration ──
    for (const candUrl of ['/vendor-info', '/configuration', '/settings', '/locales', '/restaurants', '/stores', '/account']) {
      try {
        console.log(`\n▶ Probando navegar a ${candUrl}...`);
        trigger = `navigate-${candUrl}`;
        await page.goto(`https://portal-app.pedidosya.com${candUrl}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(8_000);
        const t = await page.title();
        const url = page.url();
        console.log(`   → ${url} | title="${t}"`);
        if (!url.endsWith(candUrl) && !url.includes('login')) {
          console.log(`   (redirigido)`);
        }
      } catch (e: any) {
        console.log(`   ⚠ ${e.message.slice(0, 80)}`);
      }
    }

    // ── ACCIÓN 3: navegar a /reports → ahí casi seguro hay selector con nombres ──
    console.log('\n▶ ACCIÓN 3: Navegar a /reports y abrir selector de tiendas...');
    trigger = 'navigate-reports';
    try {
      await page.goto('https://portal-app.pedidosya.com/reports', { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(10_000);
      const localBtn = page.locator('button:has-text("Locales"), button:has-text("Tiendas"), button:has-text("Stores"), button:has-text("Locations")').first();
      if (await localBtn.count() > 0 && await localBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await localBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(6_000);
        await page.screenshot({ path: path.join(OUT_DIR, `${ts()}_reports_dropdown.png`) });
      }
    } catch (e: any) {
      console.log(`   ⚠ ${e.message.slice(0, 100)}`);
    }

    // ── ACCIÓN 4: navegar a /menu o /restaurant (suelen tener nombre del local) ──
    for (const candUrl of ['/menu', '/restaurant', '/restaurant-info', '/menu-management']) {
      try {
        console.log(`\n▶ Probando ${candUrl}...`);
        trigger = `navigate-${candUrl}`;
        await page.goto(`https://portal-app.pedidosya.com${candUrl}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(6_000);
        const url = page.url();
        console.log(`   → ${url}`);
      } catch {}
    }

    // ── Análisis ──
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('RESULTADOS — Responses que mencionan grids');
    console.log('══════════════════════════════════════════════════════════');
    const withGrids = captured.filter(c => c.grids_in_response && c.grids_in_response.length > 0);
    console.log(`\n   ${withGrids.length} responses contienen al menos 1 grid conocido:\n`);
    withGrids.forEach(c => {
      console.log(`   📌 [${c.trigger}] op=${c.op} | grids=${c.grids_in_response?.join(',')}`);
      console.log(`       URL: ${c.url}`);
      if (c.response?.body) {
        // Buscar pares grid → nombre cercano en el body
        for (const grid of c.grids_in_response) {
          const idx = c.response.body.indexOf(grid);
          if (idx > -1) {
            const ctx = c.response.body.slice(Math.max(0, idx - 200), idx + 300);
            console.log(`       contexto ${grid}: ...${ctx.replace(/\s+/g, ' ').slice(0, 400)}...`);
          }
        }
      }
      console.log();
    });

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('RESULTADOS — Todas las queries únicas capturadas');
    console.log('══════════════════════════════════════════════════════════');
    const uniqueOps: Record<string, number> = {};
    captured.forEach(c => uniqueOps[c.op] = (uniqueOps[c.op] || 0) + 1);
    Object.entries(uniqueOps).sort((a, b) => b[1] - a[1]).forEach(([op, n]) =>
      console.log(`   ${op.padEnd(50)} ×${n}`)
    );

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
