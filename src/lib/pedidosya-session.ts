/**
 * Helper compartido para sesiones de PedidosYa sobre BrightData CDP.
 *
 * Decisión arquitectónica importante (siguiendo el patrón documentado en
 * src/lib/pedidosya-auth.ts):
 *
 *   BrightData CDP persiste las cookies del contexto remoto entre conexiones.
 *   Por eso NO llamamos a ctx.addCookies() — BrightData rechaza el override con:
 *     "Storage.setCookies: Overriding ... cookies is forbidden"
 *
 *   La estrategia correcta es:
 *     1. Reusar el contexto existente (browser.contexts()[0]) tal como viene
 *     2. Verificar si está autenticado intentando una ruta protegida (/finance)
 *     3. Si la ruta carga sin redirect → skip login
 *     4. Si redirige a /login o /2fa → login fresco + saveSession()
 *
 *   El archivo pedidosya-auth.json se mantiene como AUDIT/snapshot del estado,
 *   no como fuente de cookies para inyectar. Es útil para:
 *     - Debugging (ver qué cookies tenía el contexto en una corrida)
 *     - Eventual fallback a contexto NUEVO con newContext({storageState}) si
 *       algún día dejamos BrightData CDP
 *
 * Mejoras anti-detección incluidas:
 *   1. Stealth plugin (playwright-extra + puppeteer-extra-plugin-stealth)
 *      → oculta navigator.webdriver, fixea chrome.runtime/permissions.query, WebGL
 *   2. trySkipLogin(): verificar sesión existente antes de re-login
 *      → reduce logins/día, evita rate-limit PerimeterX
 *   3. saveSession(): snapshot al final del run para auditoría
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BrowserContext, Page } from 'playwright';
// playwright-extra envuelve playwright y permite plugins
import { chromium as chromiumExtra } from 'playwright-extra';
// @ts-ignore - puppeteer-extra-plugin-stealth no tiene types completos
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

let stealthInitialized = false;

/**
 * Inicializa el stealth plugin (una sola vez por proceso).
 * Retorna el chromium con stealth aplicado, listo para connectOverCDP/launch.
 */
export function getStealthChromium() {
  if (!stealthInitialized) {
    chromiumExtra.use(StealthPlugin());
    stealthInitialized = true;
  }
  return chromiumExtra;
}

export const AUTH_FILE_DEFAULT = path.resolve(process.cwd(), 'pedidosya-auth.json');

/**
 * Verifica si la sesión actual del contexto sigue autenticada intentando una
 * ruta protegida. Retorna true si NO redirige a /login ni /2fa.
 *
 * Usa /finance porque es ruta autenticada estable. PedidosYa hace hard redirect
 * a /login?redirect=... cuando la sesión expira (sin overlay client-side).
 */
export async function isSessionValid(page: Page, timeoutMs = 25_000): Promise<boolean> {
  try {
    await page.goto('https://portal-app.pedidosya.com/finance', {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    await page.waitForTimeout(3000);
    const url = page.url();
    return !url.includes('/login') && !url.includes('/2fa');
  } catch {
    return false;
  }
}

/**
 * Intenta saltar el login confiando en que el contexto remoto de BrightData
 * ya tiene cookies válidas de sesiones previas.
 *
 * NO inyecta cookies del archivo local — BrightData rechaza addCookies sobre
 * cookies preexistentes (incluso cuando ctx.cookies() reporta 0; tiene cookies
 * invisibles internamente). Verificado empíricamente 2026-05-11.
 *
 * ⚠️ COMPORTAMIENTO REAL OBSERVADO (validado con 3 runs):
 *   - Funciona en ventana CORTA (~5-15 min entre runs)
 *   - Falla en ventana LARGA (24h del cron diario) — sesión BrightData expira
 *   - Puede retornar TRUE inicialmente pero la sesión se invalida durante
 *     actividad larga post-skip (warmup, etc.). Ver Run #2 2026-05-11
 *
 * Implicaciones:
 *   - El CRON DIARIO casi siempre hará login fresh (skip retorna false)
 *   - Para scripts manuales/dev que corren múltiples veces el mismo día, SÍ ahorra
 *   - NO confiar en skip-login + secuencia larga sin re-verificar sesión periódicamente
 *
 * Patrón de uso:
 *   if (!(await trySkipLogin(ctx, page))) {
 *     await doLogin(page);
 *   }
 *   await saveSession(ctx);   // snapshot para auditoría/debugging
 */
export async function trySkipLogin(
  ctx: BrowserContext,
  page: Page,
  _authFile = AUTH_FILE_DEFAULT
): Promise<boolean> {
  void ctx; void _authFile; // mantenidos en firma para backward compat
  console.log('▶ Verificando sesión existente del contexto BrightData...');
  const ok = await isSessionValid(page);
  if (ok) {
    console.log(`   ✓ Sesión válida — login SKIPPED (${page.url().slice(0, 80)})`);
    return true;
  }
  console.log('   ✗ Sesión inválida o expirada — login fresh requerido');
  return false;
}

/**
 * Guarda snapshot del storageState al disco (auditoría/debugging).
 *
 * NO es para reusar via addCookies (BrightData rechaza). El propósito real es:
 *   - Debug post-mortem: ver qué cookies había en el contexto en cada run
 *   - Fallback futuro si migramos a browser local (newContext({storageState}))
 */
export async function saveSession(
  ctx: BrowserContext,
  authFile = AUTH_FILE_DEFAULT
): Promise<{ cookies: number }> {
  try {
    const state = await ctx.storageState();
    fs.writeFileSync(authFile, JSON.stringify(state, null, 2));
    console.log(`   💾 storageState snapshot (${state.cookies.length} cookies → ${path.basename(authFile)})`);
    return { cookies: state.cookies.length };
  } catch (e: any) {
    console.log(`   ⚠ saveSession falló: ${e.message}`);
    return { cookies: 0 };
  }
}
