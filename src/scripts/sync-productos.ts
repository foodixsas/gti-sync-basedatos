import { chromium, type Browser, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

// ─── Config ────────────────────────────────────────────────────────────────
const CONTIFICO_URL = 'https://1793168604001.contifico.com';
const LOGIN_URL = `${CONTIFICO_URL}/sistema/accounts/login/`;
const PRODUCTO_NUEVO_URL = `${CONTIFICO_URL}/sistema/inventario/producto/registrar2/`;

const CONTIFICO_EMAIL = process.env.CONTIFICO_EMAIL!;
const CONTIFICO_PASSWORD = process.env.CONTIFICO_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const QUEUE_TABLE = 'gfc_matriz_productos_sync_queue';
const QUEUE_SCHEMA = 'gfc_finanzas';

// Sentinela para "shelved" (PRO/COP no soportados v1): no se vuelve a pickear
// hasta v2 cuando se actualice el código que los soporte.
const SHELVED_NEXT_RETRY = '2099-12-31T00:00:00Z';

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface SyncQueueRow {
  id: string;
  producto_id: string;
  codigo: string;
  action: string;
  payload: ProductoPayload;
  status: string;
  attempts: number;
  max_attempts: number;
  contifico_id: string | null;
}

interface ProductoPayload {
  codigo: string;
  nombre?: string;
  descripcion?: string;
  codigo_auxiliar?: string;
  categoria_id?: string;
  unidad_id?: string;
  tipo_contifico?: 'PRO' | 'SER';
  tipo_producto_contifico?: 'SIM' | 'PRO' | 'COP';
  iva?: number;
  pvp1?: number;
  pvp2?: number;
  pvp3?: number;
  pvp_distribuidor?: number;
  stock_minimo?: number;
  lead_time?: number;
  para_pos?: boolean;
  para_venta?: boolean;
  para_compra?: boolean;
  inventariable?: boolean;
  cuenta_venta_id?: string;
  cuenta_compra_id?: string;
  cuenta_costo_id?: string;
}

// ─── Supabase client ───────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  db: { schema: QUEUE_SCHEMA },
});

// ─── Login ─────────────────────────────────────────────────────────────────
async function loginContifico(page: Page): Promise<void> {
  console.log('🔐 Login a Contifico...');
  // Usar 'load' en vez de 'networkidle' — Contifico tiene long-polling/keep-alive
  // que nunca llega a estado idle. Mismo fix que se aplicó en scrape-costos.ts
  // (commit fc6213b "Fix timeout — use 'load' instead of 'networkidle'").
  await page.goto(LOGIN_URL, { waitUntil: 'load', timeout: 60000 });
  await page.fill('input[name="username"], input[type="email"], #id_username', CONTIFICO_EMAIL);
  await page.fill('input[name="password"], input[type="password"], #id_password', CONTIFICO_PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL('**/sistema/**', { timeout: 30000 });
  await page.waitForLoadState('load');
  await page.waitForTimeout(2000);
  console.log('✅ Login OK');
}

// ─── Llenado del form ──────────────────────────────────────────────────────
/**
 * Fill defensivo: solo escribe si el input está visible. Contifico tiene
 * secciones del form que se ocultan según los checkboxes (para_venta /
 * para_compra / inventariable). Tratar de fill un input invisible
 * timeoutea Playwright. En vez de meter gates por sección, hacemos el
 * gating en runtime: si no se ve, se skipea con un warning.
 */
async function fillIfVisible(page: Page, selector: string, value: string): Promise<boolean> {
  const loc = page.locator(selector).first();
  try {
    if (await loc.isVisible({ timeout: 1000 })) {
      await loc.fill(value);
      return true;
    }
  } catch {
    // selector no encontrado o no visible — skip
  }
  console.log(`   ⚠️  skip ${selector} (no visible)`);
  return false;
}

async function setHiddenValue(page: Page, name: string, value: string): Promise<void> {
  // Para campos hidden + quicksearch (categoria_id, unidad_id, cuenta_venta_id,
  // cuenta_compra_id, cuenta_costo_id) seteamos directamente el value del input
  // hidden vía JS. Si Contifico valida server-side que el quicksearch widget se
  // haya disparado en el front, este approach FALLARÁ y habrá que migrar a
  // simular el click + búsqueda + selección del resultado en el popup.
  // TODO[v2]: validar comportamiento real con el primer producto de prueba en GHA.
  // Sin arrow function dentro del evaluate (tsx/esbuild __name issue)
  await page.evaluate(function (args: { n: string; v: string }) {
    const el = document.querySelector('input[name="' + args.n + '"]') as HTMLInputElement | null;
    if (el) {
      el.value = args.v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { n: name, v: value });
}

async function llenarFormProducto(page: Page, payload: ProductoPayload): Promise<void> {
  // 'load' en vez de 'networkidle' — ver nota en loginContifico.
  await page.goto(PRODUCTO_NUEVO_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('form[name="productoForm"]', { timeout: 15000 });

  // ── Datos generales ──
  await page.fill('input[name="codigo"]', payload.codigo);
  if (payload.codigo_auxiliar) {
    await page.fill('input[name="codigo_auxiliar"]', payload.codigo_auxiliar);
  }
  if (payload.nombre) {
    await page.fill('input[name="nombre"]', payload.nombre);
  }

  // Tipo (Producto/Servicio) y subtipo. Disparamos change para que
  // handlerComboTipo() ajuste la visibilidad de las secciones del form.
  const tipo = payload.tipo_contifico ?? 'PRO';
  await page.selectOption('select[name="tipo"]', tipo);
  if (tipo === 'PRO') {
    const tipoProducto = payload.tipo_producto_contifico ?? 'SIM';
    await page.selectOption('select[name="tipo_producto"]', tipoProducto);
  }

  // Categoría y unidad — hidden + quicksearch
  if (payload.categoria_id) {
    await setHiddenValue(page, 'categoria_id', payload.categoria_id);
  }
  if (payload.unidad_id && tipo === 'PRO') {
    await setHiddenValue(page, 'unidad_id', payload.unidad_id);
  }

  if (payload.descripcion) {
    await page.fill('textarea[name="descripcion"]', payload.descripcion);
  }

  // ── Precios ── (todos pueden estar ocultos si Para Venta no aplica)
  if (payload.pvp1 != null) await fillIfVisible(page, 'input[name="pvp1"]', String(payload.pvp1));
  if (payload.pvp2 != null) await fillIfVisible(page, 'input[name="pvp2"]', String(payload.pvp2));
  if (payload.pvp3 != null) await fillIfVisible(page, 'input[name="pvp3"]', String(payload.pvp3));
  if (payload.pvp_distribuidor != null) {
    await fillIfVisible(page, 'input[name="pvp_distribuidor"]', String(payload.pvp_distribuidor));
  }

  // ── Impuestos ──
  // IVA: opciones del select son '15', '5', '0', '-1' (string). Default 15.
  const ivaValue = String(payload.iva ?? 15);
  await page.selectOption('select[name="iva"]', ivaValue);

  // ── Contabilidad ──
  // Los checkboxes controlan la visibilidad de su cuenta asociada. Contifico
  // los auto-marca cuando se setea la categoría según las cuentas que esa
  // categoría tiene. Por eso debemos forzar el estado EXACTO que el payload
  // pide — checkear si true, deschekear si false. Si solo checkeáramos
  // cuando true, los auto-marcados quedarían activos y romperían validación.
  async function setCheckbox(name: string, on: boolean) {
    // Contifico envuelve los checkboxes en widgets custom (bootstrap-switch /
    // iCheck) que ocultan el <input> real con display:none. Playwright no puede
    // .check() un elemento invisible, así que seteamos .checked vía JS y
    // disparamos los eventos change/click para que el handler de Contifico
    // sincronice el wrapper UI y la lógica de visibilidad de las cuentas.
    await page.evaluate(function (args: { n: string; on: boolean }) {
      const el = document.querySelector('input[name="' + args.n + '"]') as HTMLInputElement | null;
      if (!el) return;
      if (el.checked !== args.on) {
        el.checked = args.on;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('click', { bubbles: true }));
      }
    }, { n: name, on });
  }

  await setCheckbox('para_venta', payload.para_venta === true);
  await setCheckbox('para_compra', payload.para_compra === true);
  await setCheckbox('inventariable', payload.inventariable === true);

  // Las cuentas se setean SOLO si su flag está activo
  if (payload.para_venta && payload.cuenta_venta_id) {
    await setHiddenValue(page, 'cuenta_venta_id', payload.cuenta_venta_id);
  }
  if (payload.para_compra && payload.cuenta_compra_id) {
    await setHiddenValue(page, 'cuenta_compra_id', payload.cuenta_compra_id);
  }
  if (payload.inventariable && payload.cuenta_costo_id) {
    await setHiddenValue(page, 'cuenta_costo_id', payload.cuenta_costo_id);
  }
  if (payload.stock_minimo != null) {
    await fillIfVisible(page, 'input[name="minimo"]', String(payload.stock_minimo));
  }

  // ── Configuraciones ──
  if (payload.para_pos) {
    // para_pos checkbox también puede estar oculto si la sección POS no aplica
    const posLoc = page.locator('input[name="para_pos"]').first();
    if (await posLoc.isVisible({ timeout: 1000 }).catch(() => false)) {
      await posLoc.check();
    }
  }
  if (payload.lead_time != null) {
    await fillIfVisible(page, 'input[name="dias_plazo"]', String(payload.lead_time));
  }

  // ── Submit ──
  // Llamamos GrabarProducto() directamente para evitar bugs de selector del botón.
  // Es la función global que Contifico expone (= document.forms.productoForm.submit()).
  // Sin arrow function (tsx/esbuild __name issue)
  await page.evaluate(function () {
    const w = window as unknown as { GrabarProducto?: () => void };
    if (typeof w.GrabarProducto === 'function') {
      w.GrabarProducto();
    } else {
      (document.forms as unknown as Record<string, HTMLFormElement>).productoForm.submit();
    }
  });

  // Esperar a que la URL cambie (Contifico redirige tras crear). Si hay error
  // de validación, el form se queda en /registrar2/ y este wait timeoutea.
  // En caso de timeout, capturamos las validaciones visibles para diagnóstico.
  // ── Defaults defensivos para campos integer hidden ──
  // Contifico mantiene en el HTML campos como dias_plazo, costo_maximo,
  // porcentaje_ice, etc. aunque la sección "Inventariable" esté apagada.
  // Django los valida en POST como IntegerField y rechaza valores vacíos
  // con "Introduzca un número entero". Set defaults seguros antes de submit.
  await page.evaluate(function () {
    const form = document.querySelector('form[name="productoForm"]');
    if (!form) return;
    // Lista de campos integer-typed conocidos de Contifico que pueden estar vacíos
    const intFields = ['dias_plazo', 'costo_maximo', 'porcentaje_ice', 'valor_ice', 'minimo'];
    intFields.forEach(function (name) {
      const el = form.querySelector('input[name="' + name + '"]') as HTMLInputElement | null;
      if (el && (el.value || '').trim() === '') {
        el.value = '0';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    // Red de seguridad: cualquier input[type="number"] vacío en el form → 0
    const numInputs = form.querySelectorAll('input[type="number"]');
    for (let i = 0; i < numInputs.length; i++) {
      const el = numInputs[i] as HTMLInputElement;
      if ((el.value || '').trim() === '') {
        el.value = '0';
      }
    }
  });

  // Antes de esperar la navegación, snapshot del estado del form en consola
  // para diagnosticar si el submit funcionó o si quedó bloqueado por validación.
  await page.waitForTimeout(2000); // dar tiempo a que JS de validación corra
  // IMPORTANTE: dentro de page.evaluate NO usar arrow functions ni helpers
  // nombrados — tsx/esbuild las compila con __name() helper que no existe
  // en el browser context (UtilityScript). Usar function() declarations o
  // inline puro. Por eso este bloque está escrito tan plano.
  const preWaitDiag = await page.evaluate(function () {
    const errors: string[] = [];
    const errSel = '.alert-danger, .errorlist li, .has-error label, .field-error, span.error, .text-danger';
    const errNodes = document.querySelectorAll(errSel);
    for (let i = 0; i < errNodes.length; i++) {
      const el = errNodes[i];
      const raw = el.textContent || '';
      const cleaned = raw.replace(/\s+/g, ' ').trim();
      if (cleaned) errors.push(cleaned.substring(0, 300));
    }
    const invalidNodes = document.querySelectorAll('input.is-invalid, input.has-error, .has-error input, .has-error select');
    for (let i = 0; i < invalidNodes.length; i++) {
      const el = invalidNodes[i] as HTMLInputElement;
      if (el.name) errors.push('invalid:' + el.name);
    }
    const required: Record<string, string> = {};
    const reqNodes = document.querySelectorAll('input[required], select[required]');
    for (let i = 0; i < reqNodes.length; i++) {
      const e = reqNodes[i] as HTMLInputElement;
      if (e.name) required[e.name] = (e.value || '').substring(0, 50);
    }
    return {
      url: window.location.href,
      errors: errors.slice(0, 15),
      required_fields_state: required,
    };
  }).catch(function (e) { return { error: e instanceof Error ? e.message : 'evaluate failed' }; });
  console.log('🔍 PRE-WAIT DIAG:', JSON.stringify(preWaitDiag));

  try {
    await page.waitForURL((url) => !url.toString().includes('/registrar2/'), {
      timeout: 30000,
    });
  } catch (err) {
    const shortMsg = err instanceof Error ? err.message.split('\n')[0] : 'waitForURL error';
    throw new Error(shortMsg + ' | preDiag=' + JSON.stringify(preWaitDiag).slice(0, 1500));
  }
}

// ─── Backoff ───────────────────────────────────────────────────────────────
function calcularNextRetry(attempts: number): Date {
  // Backoff exponencial: 5min, 15min, 1h, 6h, 24h (alineado con la spec del paso 14)
  const delaysSec = [5 * 60, 15 * 60, 60 * 60, 6 * 60 * 60, 24 * 60 * 60];
  const idx = Math.min(attempts - 1, delaysSec.length - 1);
  const sec = delaysSec[Math.max(idx, 0)];
  return new Date(Date.now() + sec * 1000);
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('\n🚀 Sync Productos → Contifico');

  if (!CONTIFICO_EMAIL || !CONTIFICO_PASSWORD) {
    console.error('❌ CONTIFICO_EMAIL y CONTIFICO_PASSWORD son requeridos');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
    process.exit(1);
  }

  // Lee la cola: solo create + pending (no in_progress, evita doble pick) +
  // attempts < max_attempts + next_retry_at vencido o nulo.
  const nowIso = new Date().toISOString();
  const { data: queue, error: qErr } = await supabase
    .from(QUEUE_TABLE)
    .select('id, producto_id, codigo, action, payload, status, attempts, max_attempts, contifico_id')
    .eq('status', 'pending')
    .eq('action', 'create')
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(50);

  if (qErr) {
    console.error('❌ Error consultando cola:', qErr.message);
    process.exit(1);
  }

  const rows = (queue ?? []) as SyncQueueRow[];
  if (rows.length === 0) {
    console.log('📭 Cola vacía, nada que hacer');
    return;
  }

  // Filter en código: descarta los que ya alcanzaron max_attempts (defensa
  // adicional al filtro SQL, por si attempts == max_attempts quedó pending).
  const procesables = rows.filter((r) => r.attempts < r.max_attempts);
  console.log(`📋 ${procesables.length} productos a procesar (${rows.length - procesables.length} descartados por max_attempts)`);

  if (procesables.length === 0) return;

  let browser: Browser | null = null;
  let okCount = 0;
  let failCount = 0;
  let skipCount = 0;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    await loginContifico(page);

    for (const row of procesables) {
      const payload = row.payload;
      const tipoProducto = payload.tipo_producto_contifico ?? 'SIM';

      // SKIP tipos PRO/COP en v1 — sin incrementar attempts
      if (tipoProducto !== 'SIM') {
        const msg = `tipo ${tipoProducto} no soportado v1`;
        console.log(`⏭  [${row.codigo}] ${msg}`);
        await supabase
          .from(QUEUE_TABLE)
          .update({
            error_message: msg,
            last_attempt_at: new Date().toISOString(),
            // Shelved hasta v2: no se vuelve a pickear (next_retry_at lejano)
            next_retry_at: SHELVED_NEXT_RETRY,
          })
          .eq('id', row.id);
        skipCount++;
        continue;
      }

      // Marcamos in_progress para evitar doble pick si dos runs corren paralelos
      await supabase
        .from(QUEUE_TABLE)
        .update({
          status: 'in_progress',
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      try {
        console.log(`▶  [${row.codigo}] creando en Contifico...`);
        await llenarFormProducto(page, payload);
        console.log(`✅ [${row.codigo}] creado OK`);

        await supabase
          .from(QUEUE_TABLE)
          .update({
            status: 'success',
            completed_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            error_message: null,
            next_retry_at: null,
          })
          .eq('id', row.id);
        okCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'error desconocido';
        const newAttempts = row.attempts + 1;
        const isFinal = newAttempts >= row.max_attempts;
        const finalStatus = isFinal ? 'permanent_failed' : 'pending';

        console.error(`❌ [${row.codigo}] intento ${newAttempts}/${row.max_attempts}: ${msg}`);

        await supabase
          .from(QUEUE_TABLE)
          .update({
            status: finalStatus,
            attempts: newAttempts,
            error_message: msg.slice(0, 2000),
            last_attempt_at: new Date().toISOString(),
            next_retry_at: isFinal ? null : calcularNextRetry(newAttempts).toISOString(),
          })
          .eq('id', row.id);
        failCount++;
      }

      // Pausa anti-detección entre productos
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.error('\n❌ Error fatal:', err);
    throw err;
  } finally {
    if (browser) await browser.close();
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`📊 RESUMEN`);
  console.log(`   Creados OK: ${okCount}`);
  console.log(`   Fallos: ${failCount}`);
  console.log(`   Skip (PRO/COP): ${skipCount}`);
  console.log(`════════════════════════════════════════\n`);
}

main().catch((e) => {
  console.error('❌ fatal:', e);
  process.exit(1);
});
