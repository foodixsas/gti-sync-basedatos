/**
 * Helper de autenticación PedidosYa con storageState persistente.
 *
 * Flujo:
 *   1. Una vez cada N días, ejecutar `npm run pedidosya-auth-bootstrap` para
 *      hacer login + 2FA manual y guardar `pedidosya-auth.json` (cookies/storage).
 *   2. Los scripts de captura llaman `getAuthenticatedContext(browser)` para
 *      obtener un BrowserContext autenticado sin volver a loguear.
 *
 * El cron de producción (backfill-pedidosya.ts) NO usa este helper — sigue con
 * su propio loginAndCaptureTemplates() porque corre 1 vez al día y no dispara 2FA.
 */
import { Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export const AUTH_FILE = path.resolve(process.cwd(), 'pedidosya-auth.json');
const MAX_AGE_DAYS = 7;

export function isAuthValid(): { valid: boolean; reason?: string; ageDays?: number } {
  if (!fs.existsSync(AUTH_FILE)) {
    return { valid: false, reason: `pedidosya-auth.json no existe en ${AUTH_FILE} — ejecuta: npm run pedidosya-auth-bootstrap` };
  }
  const stat = fs.statSync(AUTH_FILE);
  const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
  if (ageDays > MAX_AGE_DAYS) {
    return { valid: false, reason: `pedidosya-auth.json tiene ${ageDays.toFixed(1)} días (>${MAX_AGE_DAYS}) — re-ejecuta bootstrap`, ageDays };
  }
  return { valid: true, ageDays };
}

/**
 * Devuelve un BrowserContext con la sesión PedidosYa cargada.
 *
 * BrightData connectOverCDP típicamente persiste cookies entre conexiones, así que el
 * contexto existente puede YA estar autenticado del último bootstrap. Estrategia:
 *   1. Reusar contexto existente sin tocar cookies (lo más común)
 *   2. Si el caller detecta que no está autenticado (assertAuthenticated falla),
 *      la única opción robusta es re-ejecutar el bootstrap manual.
 *
 * NO intentamos addCookies porque BrightData rechaza override de cookies preexistentes
 * con "Storage.setCookies: Overriding ... cookies is forbidden".
 */
export async function getAuthenticatedContext(browser: Browser): Promise<BrowserContext> {
  const check = isAuthValid();
  if (!check.valid) {
    throw new Error(`[pedidosya-auth] ${check.reason}`);
  }

  const existing = browser.contexts()[0];
  if (existing) {
    console.log(`[pedidosya-auth] reusando contexto BrightData existente (auth file edad: ${check.ageDays?.toFixed(2)}d)`);
    return existing;
  }

  // Fallback: contexto totalmente nuevo carga storageState desde JSON
  console.log(`[pedidosya-auth] creando contexto nuevo desde storageState (edad: ${check.ageDays?.toFixed(2)}d)`);
  return await browser.newContext({ storageState: AUTH_FILE });
}

/**
 * Verifica que la página esté autenticada navegando a /finance.
 * Aborta con error claro si encuentra /login o /2fa.
 */
export async function assertAuthenticated(page: Page): Promise<void> {
  await page.goto('https://portal-app.pedidosya.com/finance', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const url = page.url();
  if (url.includes('/2fa')) {
    throw new Error(`[pedidosya-auth] AUTH_2FA: sesión expiró, dispara 2FA. URL: ${url}. Ejecuta: npm run pedidosya-auth-bootstrap`);
  }
  if (url.includes('/login')) {
    throw new Error(`[pedidosya-auth] AUTH_LOGIN: sesión expiró, redirige a login. URL: ${url}. Ejecuta: npm run pedidosya-auth-bootstrap`);
  }
  console.log(`[pedidosya-auth] sesión válida confirmada (URL: ${url.slice(0, 80)})`);
}
