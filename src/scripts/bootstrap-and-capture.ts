#!/usr/bin/env tsx
/**
 * BOOTSTRAP + CAPTURA UNIFICADA en UNA sola sesión browser.
 *
 * Combina pedidosya-auth-bootstrap.ts y capture-templates-extendido.ts en un solo
 * proceso para evitar que las cookies expiren entre el bootstrap y la captura.
 *
 * Flujo:
 *   1. Conecta BrightData
 *   2. Login (con detección 2FA opcional)
 *   3. INMEDIATAMENTE navega por las secciones objetivo y captura templates
 *   4. Guarda storageState (para futuros replays directos sin browser) + templates
 *   5. Cierra browser
 *
 * Output:
 *   - pedidosya-auth.json (cookies)
 *   - pedidosya-templates.json (templates GraphQL/REST)
 */
import { chromium, type Page, type Request } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS!;
const EMAIL = process.env.PEDIDOSYA_EMAIL!;
const PASSWORD = process.env.PEDIDOSYA_PASSWORD!;
const AUTH_FILE = path.resolve(process.cwd(), 'pedidosya-auth.json');
const TEMPLATES_FILE = path.resolve(process.cwd(), 'pedidosya-templates.json');
const CODE_FILE = '/tmp/pya-2fa-code.txt';

type Template = {
  type: 'graphql' | 'rest';
  operationName?: string;
  url: string;
  method: 'POST' | 'GET';
  headers: Record<string, string>;
  body?: any;
  domain: string;
  captured_from_section: string;
  captured_at: string;
};

const DOMAIN_FILTER = /vagw-api|bff-api|portal-app\.pedidosya\.com\/api|prd\.portal\.restaurant|vrs-api|vfd-|portal\.restaurant|restaurant-partners/i;
const HEADER_BLACKLIST = new Set(['cookie', 'host', 'content-length']);
function cleanHeaders(h: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(h).filter(([k]) => {
      const lk = k.toLowerCase();
      return !lk.startsWith(':') && !HEADER_BLACKLIST.has(lk);
    })
  );
}

async function waitForCode(timeoutMs = 5 * 60 * 1000): Promise<string> {
  const t0 = Date.now();
  if (fs.existsSync(CODE_FILE)) try { fs.unlinkSync(CODE_FILE); } catch {}
  console.log('\n🔑 ESPERANDO CÓDIGO 2FA — pega 6 dígitos en /tmp/pya-2fa-code.txt');
  while (Date.now() - t0 < timeoutMs) {
    if (fs.existsSync(CODE_FILE)) {
      const raw = fs.readFileSync(CODE_FILE, 'utf-8').trim().replace(/\s+/g, '');
      if (/^\d{6}$/.test(raw)) {
        try { fs.unlinkSync(CODE_FILE); } catch {}
        console.log(`   ✓ Código recibido`);
        return raw;
      }
      try { fs.unlinkSync(CODE_FILE); } catch {}
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Timeout esperando código 2FA');
}

async function fillEmailPassword(page: Page) {
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
}

async function fill2FACode(page: Page, code: string) {
  const sixSep = await page.locator('input[maxlength="1"]:visible').all();
  if (sixSep.length === 6) {
    for (let i = 0; i < 6; i++) {
      await sixSep[i].fill(code[i]);
      await page.waitForTimeout(150);
    }
    return;
  }
  const single = page.locator('input[autocomplete="one-time-code"]:visible, input[name*="code" i]:visible').first();
  if (await single.count() > 0) {
    await single.fill(code);
    return;
  }
  throw new Error('No pude identificar inputs de 2FA');
}

async function doLogin(page: Page) {
  console.log('▶ Goto /login...');
  await page.goto('https://portal-app.pedidosya.com/login', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForTimeout(5000);

  if (page.url().includes('/login')) {
    console.log('   llenando email + password...');
    await fillEmailPassword(page);
    const submit = page.locator('button[type="submit"]:visible').first();
    if (await submit.count() === 0) throw new Error('Submit no visible — captcha PerimeterX');
    await submit.click();
    console.log('   submit ejecutado, esperando redirect...');
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);
      if (!page.url().includes('/login')) break;
    }
    console.log(`   URL post-submit: ${page.url().slice(0, 80)}`);
  }

  if (page.url().includes('/2fa')) {
    console.log('🔒 2FA detectado');
    const code = await waitForCode();
    await fill2FACode(page, code);
    await page.waitForTimeout(2000);
    const submit2fa = page.locator('button[type="submit"]:visible').first();
    if (await submit2fa.count() > 0 && await submit2fa.isVisible({ timeout: 1500 }).catch(() => false)) {
      await submit2fa.click().catch(() => {});
    }
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      if (!page.url().includes('/2fa') && !page.url().includes('/login')) break;
    }
    console.log(`   URL post-2FA: ${page.url().slice(0, 80)}`);
  }

  if (page.url().includes('/login') || page.url().includes('/2fa')) {
    throw new Error(`Login no completado. URL: ${page.url()}`);
  }
  console.log(`✓ Login OK: ${page.url().slice(0, 80)}`);
}

interface Section {
  id: string;
  url: string;
  postLoad?: (page: Page) => Promise<void>;
  waitMs?: number;
}

const SECTIONS: Section[] = [
  { id: 'finance', url: 'https://portal-app.pedidosya.com/finance', waitMs: 12_000 },
  { id: 'reviews', url: 'https://portal-app.pedidosya.com/reviews', waitMs: 10_000 },
  {
    id: 'ads-premium',
    url: 'https://portal-app.pedidosya.com/promotion/premium-placement',
    waitMs: 8_000,
    postLoad: async (page) => {
      const inner = page.locator('aside a, nav a, [role="navigation"] a, [class*="menu"] a, [class*="tab"]').filter({ hasText: /./ });
      const count = await inner.count().catch(() => 0);
      for (let i = 0; i < Math.min(count, 6); i++) {
        try {
          const el = inner.nth(i);
          if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
            await el.click({ force: true, timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(4_000);
          }
        } catch {}
      }
    },
  },
  {
    id: 'vendor-deals',
    url: 'https://portal-app.pedidosya.com/vendor-deals',
    waitMs: 8_000,
    postLoad: async (page) => {
      const tabs = ['Mis promociones', 'Activas', 'Histórico', 'Aplicadas', 'Active', 'History'];
      for (const t of tabs) {
        const el = page.locator(`button:has-text("${t}"), a:has-text("${t}"), [role="tab"]:has-text("${t}")`).first();
        if (await el.count() > 0 && await el.isVisible({ timeout: 600 }).catch(() => false)) {
          console.log(`     ▸ Tab: "${t}"`);
          await el.click({ force: true }).catch(() => {});
          await page.waitForTimeout(5_000);
        }
      }
    },
  },
];

async function main() {
  if (!BROWSER_WSS || !EMAIL || !PASSWORD) {
    throw new Error('Faltan env vars: BRIGHTDATA_BROWSER_WSS, PEDIDOSYA_EMAIL, PEDIDOSYA_PASSWORD');
  }

  console.log('🔌 Conectando a BrightData...');
  const browser = await chromium.connectOverCDP(BROWSER_WSS);
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  const templates: Record<string, Template> = {};
  const seenKeys = new Set<string>();
  let currentSection = '__init__';

  page.on('request', (req: Request) => {
    const url = req.url();
    if (!DOMAIN_FILTER.test(url)) return;
    const post = req.postData();
    const method = req.method() as 'POST' | 'GET';
    const headers = req.headers();

    if (method === 'POST' && post && url.includes('/query')) {
      try {
        const body = JSON.parse(post);
        const op = body?.operationName;
        if (!op) return;
        const key = `gql_${op}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        templates[key] = {
          type: 'graphql', operationName: op, url, method,
          headers: cleanHeaders(headers), body,
          domain: (url.match(/^https?:\/\/([^/]+)/) || [, 'unknown'])[1] || 'unknown',
          captured_from_section: currentSection,
          captured_at: new Date().toISOString(),
        };
        console.log(`     📡 GraphQL: ${op}`);
      } catch {}
      return;
    }

    const u = new URL(url);
    const key = `rest_${method}_${u.host}${u.pathname}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    let parsedBody: any = null;
    if (post) {
      try { parsedBody = JSON.parse(post); } catch { parsedBody = post; }
    }

    templates[key] = {
      type: 'rest', url, method,
      headers: cleanHeaders(headers), body: parsedBody,
      domain: u.host,
      captured_from_section: currentSection,
      captured_at: new Date().toISOString(),
    };
    console.log(`     📡 REST: ${method} ${u.host}${u.pathname.slice(0, 60)}`);
  });

  try {
    // 1. LOGIN INMEDIATO
    await doLogin(page);

    // 2. Guardar storageState recién creado
    const state = await ctx.storageState();
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
    console.log(`✓ storageState guardado (${state.cookies.length} cookies)\n`);

    // 3. Capturar templates en MISMA sesión
    for (const section of SECTIONS) {
      currentSection = section.id;
      console.log(`══════════════════════════════════════════════════════════`);
      console.log(`SECCIÓN: ${section.id}`);
      console.log(`══════════════════════════════════════════════════════════`);
      console.log(`▶ Goto ${section.url}`);
      try {
        await page.goto(section.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.waitForTimeout(section.waitMs ?? 8_000);
      } catch (e: any) {
        console.log(`   ⚠ goto: ${e.message?.slice(0, 100)}`);
        continue;
      }
      const finalUrl = page.url();
      if (finalUrl.includes('/login') || finalUrl.includes('/2fa')) {
        console.log(`   ⚠ redirect a auth: ${finalUrl}. Saltando.`);
        continue;
      }
      console.log(`   URL final: ${finalUrl.slice(0, 100)}`);

      // Cerrar modales
      for (const t of ['Ok','OK','Cancelar','Cerrar','Close','NO, THANKS','Aceptar','Entendido']) {
        const b = page.locator(`button:has-text("${t}")`).first();
        if (await b.count() > 0 && await b.isVisible({ timeout: 400 }).catch(() => false)) {
          await b.click().catch(() => {});
          await page.waitForTimeout(1_000);
        }
      }

      if (section.postLoad) {
        console.log(`   ▶ postLoad...`);
        try { await section.postLoad(page); } catch (e: any) { console.log(`   ⚠ postLoad: ${e.message?.slice(0, 100)}`); }
      }
    }
  } finally {
    await browser.close();
  }

  const output = {
    captured_at: new Date().toISOString(),
    sections_explored: SECTIONS.map(s => s.id),
    total_templates: Object.keys(templates).length,
    by_type: {
      graphql: Object.values(templates).filter(t => t.type === 'graphql').length,
      rest: Object.values(templates).filter(t => t.type === 'rest').length,
    },
    by_domain: Object.values(templates).reduce((acc, t) => {
      acc[t.domain] = (acc[t.domain] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    templates,
  };
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(output, null, 2));

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`✅ COMPLETADO`);
  console.log(`══════════════════════════════════════════════════════════`);
  console.log(`Total templates: ${output.total_templates}`);
  console.log(`  GraphQL: ${output.by_type.graphql}`);
  console.log(`  REST:    ${output.by_type.rest}`);
  console.log(`Por dominio:`);
  Object.entries(output.by_domain).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => {
    console.log(`  ${d.padEnd(50)} ${n}`);
  });
  console.log(`\n💾 ${TEMPLATES_FILE}`);
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1); });
