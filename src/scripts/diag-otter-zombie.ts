// DIAGNÓSTICO — reproducir "zombie session" de forma controlada
// Carga storage_state con JWT corrompidos y captura evidencia rica:
// - HTML body
// - Screenshot
// - Console errors
// - Todas las network responses (no filtradas)
// - URL final, title, modal/overlay visible

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const STORAGE_PATH = path.join(PROJECT_ROOT, '.otter-storage-state.json');
const OUT_DIR = path.join(PROJECT_ROOT, 'logs', 'diag');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  // 1. Leer storage state real
  const original = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf-8'));

  // 2. Crear copia con JWTs corrompidos (mantener mismo formato, valor inválido)
  const corrupt = JSON.parse(JSON.stringify(original));
  let modCount = 0;
  for (const o of corrupt.origins || []) {
    if (!o.origin?.includes('tryotter')) continue;
    for (const item of o.localStorage || []) {
      if (item.name === 'css.authtoken' || item.name === 'css.refreshToken') {
        // Corromper la firma del JWT (último segmento) — mantener header/payload
        const parts = (item.value || '').split('.');
        if (parts.length === 3) {
          item.value = parts[0] + '.' + parts[1] + '.INVALID_SIGNATURE_FOR_TEST';
          modCount++;
        }
      }
    }
  }
  console.log(`[diag] Corrompidos ${modCount} tokens. Lanzando browser...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'es-EC',
    storageState: corrupt,
  });
  const page = await context.newPage();

  const responses: any[] = [];
  page.on('response', async (resp) => {
    if (responses.length > 60) return; // cap
    const url = resp.url();
    // Solo capturar tryotter / cloudflare
    if (!url.includes('tryotter') && !url.includes('cloudflare')) return;
    let body = '';
    try {
      const ct = resp.headers()['content-type'] || '';
      if (ct.includes('json') || ct.includes('text')) {
        const txt = await resp.text();
        body = txt.slice(0, 400);
      }
    } catch {}
    responses.push({
      method: resp.request().method(),
      url: url.slice(0, 200),
      status: resp.status(),
      ct: resp.headers()['content-type'],
      bodySnippet: body,
    });
  });

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`);
    }
  });

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message.slice(0, 500));
  });

  // 3. Navegar a /orders
  console.log('[diag] goto /orders...');
  try {
    await page.goto('https://manager.tryotter.com/orders?dayRangeFilter=TODAY', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  } catch (e: any) {
    console.log(`[diag] goto error: ${e.message?.slice(0, 200)}`);
  }
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(8000); // mismo tiempo que captureListTemplate

  // 4. Capturar evidencia
  const finalUrl = page.url();
  const title = await page.title().catch(() => '?');

  const html = await page.evaluate(() => document.body?.innerHTML?.slice(0, 5000) || '').catch(() => '?');
  const visibleText = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || '').catch(() => '?');

  // ¿Hay modal o overlay visible?
  const overlays = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('div[role="dialog"], div[class*="modal"], div[class*="overlay"], div[class*="loading"]'));
    return candidates
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({
        tag: el.tagName,
        cls: el.className.slice(0, 100),
        text: (el.textContent || '').slice(0, 200),
      }))
      .slice(0, 10);
  }).catch(() => [] as any[]);

  // ¿Hay form de email?
  const hasEmailForm = await page.locator('input[type="email"]').first().isVisible({ timeout: 2000 }).catch(() => false);

  // Screenshot
  const ssPath = path.join(OUT_DIR, `zombie-${ts}.png`);
  await page.screenshot({ path: ssPath, fullPage: true }).catch(() => {});

  // 5. Reporte
  const report = {
    timestamp: new Date().toISOString(),
    finalUrl,
    title,
    hasEmailFormVisible: hasEmailForm,
    overlays,
    visibleText: visibleText.slice(0, 1000),
    htmlSnippet: html.slice(0, 1000),
    consoleErrors: consoleErrors.slice(0, 30),
    pageErrors: pageErrors.slice(0, 10),
    responses: responses.slice(0, 50),
    screenshotPath: ssPath,
  };

  const reportPath = path.join(OUT_DIR, `zombie-${ts}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`[diag] === RESUMEN ===`);
  console.log(`URL final: ${finalUrl}`);
  console.log(`Title: ${title}`);
  console.log(`Email form visible: ${hasEmailForm}`);
  console.log(`Overlays detectados: ${overlays.length}`);
  if (overlays.length > 0) console.log('  ', JSON.stringify(overlays.slice(0, 3)));
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.slice(0, 5).forEach((e) => console.log(`  - ${e.slice(0, 200)}`));
  console.log(`Page errors: ${pageErrors.length}`);
  pageErrors.slice(0, 3).forEach((e) => console.log(`  - ${e.slice(0, 200)}`));
  console.log(`Total responses Otter/CF: ${responses.length}`);
  // Mostrar status codes de POST a tryotter
  const postsToOtter = responses.filter((r) => r.method === 'POST' && r.url.includes('tryotter'));
  console.log(`POST a tryotter: ${postsToOtter.length}`);
  postsToOtter.slice(0, 10).forEach((r) => console.log(`  ${r.status} ${r.url.slice(0, 100)} | body: ${r.bodySnippet?.slice(0, 100)}`));
  console.log(`\nReporte completo: ${reportPath}`);
  console.log(`Screenshot: ${ssPath}`);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
