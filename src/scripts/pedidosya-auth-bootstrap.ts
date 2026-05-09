#!/usr/bin/env tsx
/**
 * Bootstrap de autenticación PedidosYa.
 *
 * Hace login email+password, detecta /2fa, espera a que el operador escriba
 * el código en /tmp/pya-2fa-code.txt, ingresa el código, y guarda
 * pedidosya-auth.json para que los scripts capture-* reusen la sesión.
 *
 * Uso:
 *   npm run pedidosya-auth-bootstrap
 *
 * Cuando llegue el email con el código, en otra terminal:
 *   echo 123456 > /tmp/pya-2fa-code.txt
 *
 * Timeout: 5 minutos esperando código.
 */
import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS!;
const EMAIL = process.env.PEDIDOSYA_EMAIL!;
const PASSWORD = process.env.PEDIDOSYA_PASSWORD!;
const AUTH_FILE = path.resolve(process.cwd(), 'pedidosya-auth.json');
const CODE_FILE = '/tmp/pya-2fa-code.txt';

async function waitForCode(timeoutMs = 5 * 60 * 1000): Promise<string> {
  const t0 = Date.now();
  if (fs.existsSync(CODE_FILE)) {
    try { fs.unlinkSync(CODE_FILE); } catch {}
  }
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔑 ESPERANDO CÓDIGO 2FA');
  console.log('');
  console.log('   1. Abre tu email → busca el código de 6 dígitos de PedidosYa');
  console.log('   2. En OTRA terminal, ejecuta:');
  console.log('         echo 123456 > /tmp/pya-2fa-code.txt');
  console.log('      (reemplaza 123456 con tu código real)');
  console.log('');
  console.log(`   Timeout: 5 minutos. Polling cada 2s sobre ${CODE_FILE}...`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  while (Date.now() - t0 < timeoutMs) {
    if (fs.existsSync(CODE_FILE)) {
      const raw = fs.readFileSync(CODE_FILE, 'utf-8').trim();
      const code = raw.replace(/\s+/g, '');
      if (/^\d{6}$/.test(code)) {
        try { fs.unlinkSync(CODE_FILE); } catch {}
        console.log(`   ✓ Código recibido: ${code.slice(0, 2)}****`);
        return code;
      } else {
        console.log(`   ⚠ Contenido inválido en ${CODE_FILE}: "${raw.slice(0, 30)}". Esperando 6 dígitos numéricos...`);
        try { fs.unlinkSync(CODE_FILE); } catch {}
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Timeout esperando código 2FA después de 5 minutos');
}

async function fillEmailPassword(page: Page) {
  console.log('   llenando email + password...');
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
  console.log('   ingresando código 2FA en el form...');

  // Estrategia 1: 6 inputs separados con maxlength=1
  const sixSep = await page.locator('input[maxlength="1"]:visible').all();
  if (sixSep.length === 6) {
    console.log('     detectados 6 inputs maxlength=1');
    for (let i = 0; i < 6; i++) {
      await sixSep[i].fill(code[i], { timeout: 3000 });
      await page.waitForTimeout(150);
    }
    return;
  }

  // Estrategia 2: input único OTP
  const single = page.locator('input[autocomplete="one-time-code"]:visible, input[name*="code" i]:visible, input[name*="otp" i]:visible, input[id*="otp" i]:visible').first();
  if (await single.count() > 0) {
    console.log('     detectado input único OTP');
    await single.fill(code, { timeout: 3000 });
    return;
  }

  // Estrategia 3: cualquier 6 inputs visibles
  const anyInputs = await page.locator('input:visible').all();
  console.log(`     fallback: encontré ${anyInputs.length} inputs visibles`);
  if (anyInputs.length === 6) {
    for (let i = 0; i < 6; i++) {
      await anyInputs[i].fill(code[i]);
      await page.waitForTimeout(150);
    }
    return;
  }
  if (anyInputs.length === 1) {
    await anyInputs[0].fill(code);
    return;
  }

  // Estrategia 4: usar setter directo + keyboard.type (más resistente a anti-bot)
  console.log('     fallback final: keyboard.type sobre primer input');
  if (anyInputs.length > 0) {
    await anyInputs[0].click();
    await page.keyboard.type(code, { delay: 80 });
    return;
  }

  throw new Error(`No pude identificar inputs de 2FA. Encontré ${anyInputs.length} inputs visibles`);
}

async function main() {
  if (!BROWSER_WSS || !EMAIL || !PASSWORD) {
    throw new Error('Faltan env vars: BRIGHTDATA_BROWSER_WSS, PEDIDOSYA_EMAIL, PEDIDOSYA_PASSWORD');
  }

  console.log('🔌 Conectando a BrightData...');
  const browser = await chromium.connectOverCDP(BROWSER_WSS);
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  try {
    console.log('▶ Goto /login...');
    await page.goto('https://portal-app.pedidosya.com/login', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForTimeout(5000);
    console.log(`   URL inicial: ${page.url().slice(0, 80)}`);

    if (page.url().includes('/login')) {
      // BrightData puede necesitar tiempo para resolver el captcha PerimeterX antes
      // de que el form de login sea interactivo. Reintentamos hasta 4 veces con 15s entre intentos.
      let submitted = false;
      for (let attempt = 1; attempt <= 4 && !submitted; attempt++) {
        if (attempt > 1) {
          console.log(`   intento ${attempt}/4 — esperando 15s a que BrightData resuelva captcha...`);
          await page.waitForTimeout(15_000);
          // Recargar la página en intentos posteriores para dar a BrightData otra oportunidad
          if (attempt === 3) {
            await page.goto('https://portal-app.pedidosya.com/login', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
            await page.waitForTimeout(8_000);
          }
        }

        // Screenshot diagnóstico
        const ssDir = path.resolve(process.cwd(), 'tmp-pedidosya-exploration/auth-bootstrap');
        fs.mkdirSync(ssDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({ path: path.join(ssDir, `${ts}_attempt${attempt}.png`), fullPage: true }).catch(() => {});

        await fillEmailPassword(page);

        // Esperar hasta 20s a que el submit sea visible (BrightData puede necesitar ese tiempo)
        const submit = page.locator('button[type="submit"]:visible').first();
        let submitVisible = false;
        for (let w = 0; w < 20; w++) {
          await page.waitForTimeout(1000);
          if (await submit.count() > 0 && await submit.isVisible({ timeout: 500 }).catch(() => false)) {
            submitVisible = true;
            break;
          }
        }

        if (!submitVisible) {
          console.log(`   intento ${attempt}: submit no visible después de 20s`);
          continue;
        }

        await submit.click();
        console.log(`   intento ${attempt}: submit ejecutado, esperando redirect...`);
        submitted = true;
      }

      if (!submitted) throw new Error('Submit button nunca visible tras 4 intentos — BrightData no pudo resolver captcha');

      // Esperar a que salga de /login
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(1000);
        if (!page.url().includes('/login')) break;
      }
      console.log(`   URL post-submit: ${page.url().slice(0, 100)}`);
    }

    // Si está en /2fa, pedir código manualmente
    if (page.url().includes('/2fa')) {
      console.log('🔒 Pantalla 2FA detectada');
      // Captura screenshot para diagnóstico
      const ssDir = path.resolve(process.cwd(), 'tmp-pedidosya-exploration/auth-bootstrap');
      fs.mkdirSync(ssDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      await page.screenshot({ path: path.join(ssDir, `${ts}_2fa_detected.png`), fullPage: true }).catch(() => {});

      const code = await waitForCode();
      await fill2FACode(page, code);
      await page.waitForTimeout(2000);

      // Algunos forms necesitan submit explícito
      const submit2fa = page.locator('button[type="submit"]:visible').first();
      if (await submit2fa.count() > 0 && await submit2fa.isVisible({ timeout: 1500 }).catch(() => false)) {
        console.log('   click submit del form 2FA...');
        await submit2fa.click().catch(() => {});
      }

      // Esperar redirect fuera de /2fa
      console.log('   esperando validación del código...');
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        if (!page.url().includes('/2fa') && !page.url().includes('/login')) break;
      }
      console.log(`   URL post-2FA: ${page.url().slice(0, 100)}`);

      await page.screenshot({ path: path.join(ssDir, `${ts}_post_2fa.png`), fullPage: true }).catch(() => {});
    }

    // Validación final
    const finalUrl = page.url();
    if (finalUrl.includes('/login')) {
      throw new Error(`Login no completado — sigue en /login. URL: ${finalUrl}`);
    }
    if (finalUrl.includes('/2fa')) {
      throw new Error(`2FA no validado — sigue en /2fa. URL: ${finalUrl}. ¿Código incorrecto?`);
    }

    console.log('✓ Login OK. Navegando a /finance para confirmar sesión activa...');
    await page.goto('https://portal-app.pedidosya.com/finance', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(5000);

    if (page.url().includes('/login') || page.url().includes('/2fa')) {
      throw new Error(`Sesión inválida — al ir a /finance redirigió a ${page.url()}`);
    }

    console.log(`✓ Sesión confirmada. URL final: ${page.url().slice(0, 80)}`);

    // Guardar storageState
    const state = await ctx.storageState();
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
    console.log(`✓ storageState guardado en: ${AUTH_FILE}`);
    console.log(`   cookies: ${state.cookies.length}, origins: ${state.origins.length}`);
  } catch (e: any) {
    console.error(`\n❌ Error: ${e.message}`);
    const ssDir = path.resolve(process.cwd(), 'tmp-pedidosya-exploration/auth-bootstrap');
    fs.mkdirSync(ssDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ path: path.join(ssDir, `${ts}_error.png`), fullPage: true }).catch(() => {});
    console.error(`   screenshot guardado: ${ssDir}/${ts}_error.png`);
    throw e;
  } finally {
    await browser.close();
  }

  console.log('\n✅ Bootstrap completado. Ahora puedes correr los scripts capture-* normalmente.');
}

main().catch(e => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
