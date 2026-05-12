// otter-shared.ts — utilidades compartidas para polling + recovery scripts.
// Centraliza login resiliente, captura de templates sin click frágil,
// persistencia de session state y helpers de parseo.

import type { Page, BrowserContext, Response } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { captureFingerprint, findAdaptive } from './otter-adaptive';

// ─── Constantes públicas ────────────────────────────────────────────────────

export const OTTER_URL = 'https://manager.tryotter.com/';
export const ORDERS_TODAY_URL = 'https://manager.tryotter.com/orders?dayRangeFilter=TODAY';
export const LIST_ENDPOINT = 'https://manager.tryotter.com/api/analytics/table/order_performance_cullinan';
export const DETAILS_ENDPOINT = 'https://manager.tryotter.com/api/graphql?operation=OrderDetails';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const STORAGE_STATE_PATH = path.join(PROJECT_ROOT, '.otter-storage-state.json');
export const TEMPLATE_CACHE_PATH = path.join(PROJECT_ROOT, '.otter-template-cache.json');
export const TEMPLATE_CACHE_MAX_AGE_MS = 9 * 60 * 1000;

// Cascadas de selectores. Cada elemento se busca en orden hasta encontrar uno presente.
export const EMAIL_SELECTORS = [
  'input[type="email"]',
  'input[name="email"]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
  'input[id*="email" i]',
  'input[placeholder*="email" i]',
];

export const PASSWORD_SELECTORS = [
  'input[type="password"]',
  'input[name="password"]',
  'input[autocomplete="current-password"]',
  'input[id*="password" i]',
  'input[placeholder*="password" i]',
];

export const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'button:has-text("Iniciar")',
  'button:has-text("Sign in")',
  'button:has-text("Log in")',
  'button:has-text("Login")',
  'input[type="submit"]',
  '[role="button"]:has-text("Iniciar")',
];

// Hardcoded GraphQL query — extraído de la sesión real (cache 2026-05-11).
// No contiene JWT ni datos de orden. Solo cambia si Otter actualiza schema GraphQL.
export const ORDER_DETAILS_QUERY = `query OrderDetails($input: OrderDetailsInput!) {
  orderDetails(input: $input) {
    ... on OrderDetailsResponse {
      metadata {
        internalId
        externalId
        displayId
        organizationId
        ofo {
          slug
          __typename
        }
        store {
          id
          facilityV2 {
            id
            name
            address {
              countryCode
              __typename
            }
            __typename
          }
          restrictedBrand {
            id
            name
            __typename
          }
          __typename
        }
        isTest
        __typename
      }
      details {
        timestamp
        referenceTime
        referenceTimeLocalWithoutTz
        dataFidelity
        numOfIssues
        issues {
          type
          explanation
          __typename
        }
        numOfMenuItems
        orderState
        subtotal {
          ...MoneyFragment
          __typename
        }
        tax {
          ...MoneyFragment
          __typename
        }
        tip {
          ...MoneyFragment
          __typename
        }
        commission {
          ...MoneyFragment
          __typename
        }
        adjustment {
          ...MoneyFragment
          __typename
        }
        restaurantFees {
          processingFee {
            ...MoneyFragment
            __typename
          }
          deliveryFee {
            ...MoneyFragment
            __typename
          }
          salesTaxWithheld {
            ...MoneyFragment
            __typename
          }
          other {
            ...MoneyFragment
            __typename
          }
          advertising {
            ...MoneyFragment
            __typename
          }
          __typename
        }
        eaterFees {
          deliveryFee {
            ...MoneyFragment
            __typename
          }
          bagFee {
            ...MoneyFragment
            __typename
          }
          packingFee {
            ...MoneyFragment
            __typename
          }
          smallOrderFee {
            ...MoneyFragment
            __typename
          }
          otherFeeForRestaurant {
            ...MoneyFragment
            __typename
          }
          __typename
        }
        prepTimeSecs
        tableNumber
        total {
          ...MoneyFragment
          __typename
        }
        totalEaterFees {
          ...MoneyFragment
          __typename
        }
        serviceFeeForRestaurant {
          ...MoneyFragment
          __typename
        }
        paymentDue {
          ...MoneyFragment
          __typename
        }
        ffAdjustedTotalPartnerCharges {
          ...MoneyFragment
          __typename
        }
        discount {
          ...MoneyFragment
          __typename
        }
        ofoFundedDiscount {
          ...MoneyFragment
          __typename
        }
        payout {
          ...MoneyFragment
          __typename
        }
        fulfillmentInfo {
          customerNote
          deliveryCourierName
          deliveryFee {
            ...MoneyFragment
            __typename
          }
          deliveryProviderId
          deliveryServiceProviderSlug
          fulfillmentMode
          __typename
        }
        customerName
        __typename
      }
      items {
        skuId
        name
        quantity
        price {
          ...MoneyFragment
          __typename
        }
        subItems {
          skuId
          name
          quantity
          subHeader
          price {
            ...MoneyFragment
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}

fragment MoneyFragment on Money {
  currencyCode
  units
  nanos
  __typename
}`;

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface Template {
  requestBody: any;
  requestHeaders: Record<string, string>;
}

// Error específico para sesión zombie (JWT invalidado server-side sin redirect a /login).
// Señaliza que se debe invalidar storage_state y re-logear, NO caer al cache.
export class SessionExpiredError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'SessionExpiredError';
  }
}

// ─── Logging compartido ─────────────────────────────────────────────────────

function ts(): string { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
export function log(level: 'info' | 'warn' | 'error', msg: string): void {
  console.log(`[${ts()}] ${level.toUpperCase()}: ${msg}`);
}

// ─── Storage state (cookies + localStorage) ─────────────────────────────────

export function loadStorageState(): any | undefined {
  try {
    if (!fs.existsSync(STORAGE_STATE_PATH)) return undefined;
    const raw = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf-8'));
    log('info', `✓ Storage state cargado de disco`);
    return raw;
  } catch (e: any) {
    log('warn', `[storage.load] ${e.message}`);
    return undefined;
  }
}

export async function saveStorageState(context: BrowserContext): Promise<void> {
  try {
    await context.storageState({ path: STORAGE_STATE_PATH });
    log('info', `✓ Storage state guardado a disco`);
  } catch (e: any) {
    log('warn', `[storage.save] ${e.message}`);
  }
}

export function clearStorageState(): void {
  try { if (fs.existsSync(STORAGE_STATE_PATH)) fs.unlinkSync(STORAGE_STATE_PATH); } catch {}
}

// ─── Detección de login requerido (URL + form presence) ─────────────────────

export async function detectLoginRequired(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes('/login') || url.includes('/auth') || url.includes('/signin') || url.includes('/sso')) {
    return true;
  }
  // Fallback: ¿hay un input de email visible aunque la URL no sea /login?
  for (const sel of EMAIL_SELECTORS) {
    try {
      if (await page.locator(sel).first().isVisible({ timeout: 1000 })) return true;
    } catch {}
  }
  return false;
}

// ─── Cascade-fill helper ────────────────────────────────────────────────────

// Intenta cada selector como cascade. Si todos fallan, intenta capa adaptive
// (fingerprint scoring) sobre los elementos visibles del DOM actual.
async function tryFillSelector(page: Page, sel: string, value: string): Promise<boolean> {
  try {
    const loc = page.locator(sel).first();
    if (await loc.count() === 0) return false;
    await loc.fill(value, { timeout: 5000 });
    return true;
  } catch { return false; }
}

async function tryClickSelector(page: Page, sel: string): Promise<boolean> {
  try {
    const loc = page.locator(sel).first();
    if (await loc.count() === 0) return false;
    await loc.click({ timeout: 5000 });
    return true;
  } catch { return false; }
}

async function fillCascade(page: Page, selectors: string[], value: string, role: string): Promise<void> {
  // Espera primero a que CUALQUIER selector se vuelva visible (page settle)
  let visibleSel: string | null = null;
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { state: 'visible', timeout: 8000 });
      visibleSel = sel;
      break;
    } catch {}
  }
  if (visibleSel) {
    // Capa 1: cascade en orden de preferencia
    for (const sel of selectors) {
      if (await tryFillSelector(page, sel, value)) {
        await captureFingerprint(page, sel, role);
        return;
      }
    }
  }
  // Capa 2: adaptive fallback — buscar por similitud al fingerprint guardado
  const adaptiveSel = await findAdaptive(page, role, 0.5);
  if (adaptiveSel && await tryFillSelector(page, adaptiveSel, value)) {
    log('warn', `[adaptive.${role}] fill OK via fingerprint match`);
    return;
  }
  throw new Error(`[login.fillCascade] Sin cascade ni adaptive match para ${role}`);
}

async function clickCascade(page: Page, selectors: string[], role: string): Promise<void> {
  let visibleSel: string | null = null;
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { state: 'visible', timeout: 8000 });
      visibleSel = sel;
      break;
    } catch {}
  }
  if (visibleSel) {
    for (const sel of selectors) {
      if (await tryClickSelector(page, sel)) {
        await captureFingerprint(page, sel, role);
        return;
      }
    }
  }
  const adaptiveSel = await findAdaptive(page, role, 0.5);
  if (adaptiveSel && await tryClickSelector(page, adaptiveSel)) {
    log('warn', `[adaptive.${role}] click OK via fingerprint match`);
    return;
  }
  throw new Error(`[login.clickCascade] Sin cascade ni adaptive match para ${role}`);
}

// ─── Login resiliente ───────────────────────────────────────────────────────

export async function loginOtter(page: Page, email: string, password: string): Promise<void> {
  log('info', '▶ Login Otter (cascade selectors)...');
  await page.goto(OTTER_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await fillCascade(page, EMAIL_SELECTORS, email, 'email');
  await fillCascade(page, PASSWORD_SELECTORS, password, 'password');
  await clickCascade(page, SUBMIT_SELECTORS, 'submit');
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  log('info', '✓ Login OK');
}

// ─── Captura del LIST template (sin click frágil) ───────────────────────────
// Solo navega al listado y observa el primer POST a /api/analytics/table/...
// Ese request trae el JWT que reusaremos para construir el Details template.

export async function captureListTemplate(page: Page): Promise<Template> {
  log('info', '▶ Capturando LIST template...');
  const candidates: Template[] = [];

  // Diagnóstico A: contar 401/403 a tryotter durante la captura.
  // No afecta la lógica de captura — solo enriquece el mensaje de error si falla.
  let unauthorizedCount = 0;
  const unauthorizedUrls: string[] = [];

  const handler = async (resp: Response) => {
    const url = resp.url();
    const status = resp.status();
    if (url.includes('tryotter.com') && (status === 401 || status === 403)) {
      unauthorizedCount++;
      if (unauthorizedUrls.length < 5) unauthorizedUrls.push(`${status} ${url.split('?')[0].slice(0, 100)}`);
    }
    if (!url.includes('/api/analytics/table/order_performance_cullinan')) return;
    if (resp.request().method() !== 'POST') return;
    const post = resp.request().postData();
    if (!post) return;
    try {
      candidates.push({ requestBody: JSON.parse(post), requestHeaders: resp.request().headers() });
    } catch {}
  };
  page.on('response', handler);

  await page.goto(ORDERS_TODAY_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(8000);

  try {
    const noThanks = page.locator('button:has-text("NO, THANKS")').first();
    if (await noThanks.isVisible({ timeout: 2000 })) await noThanks.click();
    await page.waitForTimeout(2000);
  } catch {}

  page.off('response', handler);

  const winner = candidates.find(c => {
    const cols = c.requestBody?.columns || [];
    return cols.some((col: any) => col.key === 'external_order_display_id') && c.requestBody?.paginate === true;
  });

  if (winner) {
    if (unauthorizedCount > 0) {
      log('warn', `[capture] winner OK pese a ${unauthorizedCount} 401/403 en endpoints auxiliares`);
    }
    log('info', '✓ LIST template capturado');
    return winner;
  }

  // Si hubo 401s Y no hay winner: señal inequívoca de zombie session.
  // SessionExpiredError indica al caller que debe invalidar storage y re-logear.
  if (unauthorizedCount > 0) {
    throw new SessionExpiredError(
      `[captureListTemplate] Zombie session: ${unauthorizedCount} 401/403 sin winner. URLs: ${unauthorizedUrls.join(' | ')}`
    );
  }

  throw new Error('[captureListTemplate] No se capturó template del listado');
}

// ─── Construir Details template a partir del LIST (sin click) ───────────────
// El JWT vive en headers del listTemplate. El query es estático (hardcoded).

export function buildDetailsTemplate(listTemplate: Template): Template {
  return {
    requestBody: {
      operationName: 'OrderDetails',
      query: ORDER_DETAILS_QUERY,
      variables: { input: { enrichData: true, orderId: '' } },
    },
    requestHeaders: { ...listTemplate.requestHeaders },
  };
}

// ─── Cache de templates en disco (último recurso) ───────────────────────────

export function saveTemplateCache(listTemplate: Template, detailsTemplate: Template): void {
  try {
    fs.writeFileSync(TEMPLATE_CACHE_PATH, JSON.stringify({
      savedAt: Date.now(),
      templateList: listTemplate,
      templateDetails: detailsTemplate,
    }));
  } catch (e: any) {
    log('warn', `[cache.save] ${e.message}`);
  }
}

export function loadCachedTemplates(): { list: Template; details: Template } | null {
  try {
    if (!fs.existsSync(TEMPLATE_CACHE_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(TEMPLATE_CACHE_PATH, 'utf-8'));
    const age = Date.now() - (raw.savedAt || 0);
    if (age > TEMPLATE_CACHE_MAX_AGE_MS) return null;
    if (!raw.templateList || !raw.templateDetails) return null;
    log('info', `✓ Templates desde cache (${Math.round(age / 1000)}s old)`);
    return { list: raw.templateList, details: raw.templateDetails };
  } catch (e: any) {
    log('warn', `[cache.load] ${e.message}`);
    return null;
  }
}

// ─── Captura completa con resiliencia (4 capas) ─────────────────────────────
// Capa 1: detección login (URL + form) → re-login + reintento
// Capa 2: captura LIST template via navegación
// Capa 3: build Details template a partir del LIST (sin click — antes era flake #1)
// Capa 4: si falla → cache en disco como fallback
// Depth limit previene loops infinitos de re-login.

export async function captureBothTemplatesResilient(
  page: Page,
  context: BrowserContext,
  email: string,
  password: string,
  depth: number = 0,
  hadStorageOnEntry: boolean = false,
): Promise<{ list: Template; details: Template }> {
  if (depth >= 2) throw new Error('[capture.depth] Re-login loop detectado (depth>=2)');

  // Determinar si hay storage_state cargado ANTES de intentar captura.
  // Si había storage y la captura falla → asumir zombie y re-logear (Enfoque C).
  const storageExists = fs.existsSync(STORAGE_STATE_PATH);
  const hasStoragePrevio = hadStorageOnEntry || storageExists;

  // Navegación inicial para ver si la sesión está viva (señales DOM clásicas)
  await page.goto(ORDERS_TODAY_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  if (await detectLoginRequired(page)) {
    log('warn', `🔒 Sesión expirada (depth=${depth}, DOM) — re-login + retry`);
    clearStorageState();
    await loginOtter(page, email, password);
    await saveStorageState(context);
    return captureBothTemplatesResilient(page, context, email, password, depth + 1, false);
  }

  try {
    const list = await captureListTemplate(page);
    const details = buildDetailsTemplate(list);
    saveTemplateCache(list, details);
    return { list, details };
  } catch (e: any) {
    const isZombie = e instanceof SessionExpiredError;
    const isZombieByStorage = hasStoragePrevio && !(e instanceof Error && e.message.includes('net::ERR'));

    if (isZombie || isZombieByStorage) {
      // Enfoque C: captura falló con storage previo → asumir zombie, re-logear.
      // Enfoque A: SessionExpiredError confirma explícitamente via 401s observados.
      const reason = isZombie ? 'zombie session (401s detectados)' : 'storage previo + captura fallida';
      log('warn', `🔒 Re-login forzado (${reason}, depth=${depth}): ${e.message?.slice(0, 150)}`);
      clearStorageState();
      await loginOtter(page, email, password);
      await saveStorageState(context);
      return captureBothTemplatesResilient(page, context, email, password, depth + 1, false);
    }

    // Error genuino (red caída, DNS, timeout de red sin storage previo): caer al cache.
    log('warn', `[capture.fallback] LIST capture falló (sin storage previo): ${e.message?.slice(0, 200)}`);
    const cached = loadCachedTemplates();
    if (!cached) throw new Error(`[capture] Sin captura ni cache disponible: ${e.message}`);
    log('warn', '⚠️ Usando templates desde cache (próximo refresh re-intenta)');
    return cached;
  }
}

// ─── Headers builder ────────────────────────────────────────────────────────

export function buildHeaders(template: Template): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const tpl = template.requestHeaders || {};
  for (const k of Object.keys(tpl)) {
    const lk = k.toLowerCase();
    if (lk.startsWith(':') || lk === 'cookie' || lk === 'host' || lk === 'content-length' || lk === 'content-type') continue;
    headers[k] = tpl[k];
  }
  return headers;
}

// ─── Parsers compartidos ────────────────────────────────────────────────────

export function money(m: any): number {
  if (!m) return 0;
  return (m.units || 0) + (m.nanos || 0) / 1e9;
}

export function toIso(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 1_000_000_000_000) return new Date(n).toISOString();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v;
  return null;
}

export function rowToObject(row: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const cell of row) obj[cell.key] = cell.value;
  return obj;
}

export function parseCustomerNote(note: string | null | undefined): {
  cedula_ruc: string | null;
  razon_social: string | null;
  email_canal?: string | null;
  email_real: string | null;
  direccion: string | null;
  medio_pago: string | null;
  prepagado: boolean | null;
  codigo_check_in: string | null;
  codigo_entrega: string | null;
} {
  if (!note) return {
    cedula_ruc: null, razon_social: null, email_real: null, direccion: null,
    medio_pago: null, prepagado: null, codigo_check_in: null, codigo_entrega: null,
  };
  return {
    cedula_ruc: note.match(/Tax ID:\s*(\d+)/i)?.[1]?.trim()
              || note.match(/Nro\.?:\s*(\d+)/i)?.[1]?.trim()
              || note.match(/CI:\s*(\d+)/i)?.[1]?.trim()
              || null,
    razon_social: note.match(/Facturar a empresa:\s*([^-|]+?)(?:\s*-|$)/i)?.[1]?.trim()
               || note.match(/Legal Entity Name:\s*([^|]+?)(?:\s*\||$)/i)?.[1]?.trim()
               || null,
    email_canal: note.match(/Email del Cliente:\s*([^\s|]+)/i)?.[1]?.trim() || null,
    email_real: note.match(/Email:\s*([^\s|]+@[^\s|]+)/i)?.[1]?.trim() || null,
    direccion: note.match(/Address:\s*(.+?)(?:\s*\||$)/i)?.[1]?.trim() || null,
    medio_pago: note.match(/Medio de pago:\s*([^|]+?)(?:\s*\||$)/i)?.[1]?.trim()
             || note.match(/Datos de pago:\s*([^.]+)/i)?.[1]?.trim()
             || null,
    prepagado: /Prepagado/i.test(note),
    codigo_check_in: note.match(/Código de check-in:\s*(\d+)/i)?.[1]?.trim() || null,
    codigo_entrega: note.match(/Código de Entrega:\s*(\d+)/i)?.[1]?.trim() || null,
  };
}

// ─── Retry con backoff exponencial ──────────────────────────────────────────

// ─── captureListTemplateResilient — para scripts que solo necesitan LIST ────
// Aplica el mismo enfoque A+C que captureBothTemplatesResilient pero solo
// para el template de listado (recover-otter-gap.ts, etc.).

export async function captureListTemplateResilient(
  page: Page,
  context: BrowserContext,
  email: string,
  password: string,
  depth: number = 0,
): Promise<Template> {
  if (depth >= 2) throw new Error('[captureList.depth] Re-login loop detectado (depth>=2)');

  const storageExists = fs.existsSync(STORAGE_STATE_PATH);

  await page.goto(ORDERS_TODAY_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  if (await detectLoginRequired(page)) {
    log('warn', `🔒 Sesión expirada (depth=${depth}, DOM) — re-login + retry`);
    clearStorageState();
    await loginOtter(page, email, password);
    await saveStorageState(context);
    return captureListTemplateResilient(page, context, email, password, depth + 1);
  }

  try {
    return await captureListTemplate(page);
  } catch (e: any) {
    const isZombie = e instanceof SessionExpiredError;
    const isZombieByStorage = storageExists && !(e instanceof Error && e.message.includes('net::ERR'));

    if (isZombie || isZombieByStorage) {
      const reason = isZombie ? 'zombie (401s detectados)' : 'storage previo + captura fallida';
      log('warn', `🔒 Re-login forzado en captureList (${reason}, depth=${depth})`);
      clearStorageState();
      await loginOtter(page, email, password);
      await saveStorageState(context);
      return captureListTemplateResilient(page, context, email, password, depth + 1);
    }
    throw e;
  }
}

export interface RetryOpts {
  attempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (err: any) => boolean;
  label?: string;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 500;
  const shouldRetry = opts.shouldRetry ?? (() => true);
  const label = opts.label ?? 'op';
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e: any) {
      lastErr = e;
      if (i === attempts - 1 || !shouldRetry(e)) break;
      const delay = base * Math.pow(3, i); // 500, 1500, 4500
      log('warn', `[retry.${label}] intento ${i + 1}/${attempts} falló (${e.message?.slice(0, 100)}), reintentando en ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
