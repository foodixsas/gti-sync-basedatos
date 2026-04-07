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
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"], input[type="email"], #id_username', CONTIFICO_EMAIL);
  await page.fill('input[name="password"], input[type="password"], #id_password', CONTIFICO_PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL('**/sistema/**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  console.log('✅ Login OK');
}

// ─── Llenado del form ──────────────────────────────────────────────────────
async function setHiddenValue(page: Page, name: string, value: string): Promise<void> {
  // Para campos hidden + quicksearch (categoria_id, unidad_id, cuenta_venta_id,
  // cuenta_compra_id, cuenta_costo_id) seteamos directamente el value del input
  // hidden vía JS. Si Contifico valida server-side que el quicksearch widget se
  // haya disparado en el front, este approach FALLARÁ y habrá que migrar a
  // simular el click + búsqueda + selección del resultado en el popup.
  // TODO[v2]: validar comportamiento real con el primer producto de prueba en GHA.
  await page.evaluate(({ n, v }) => {
    const el = document.querySelector(`input[name="${n}"]`) as HTMLInputElement | null;
    if (el) {
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { n: name, v: value });
}

async function llenarFormProducto(page: Page, payload: ProductoPayload): Promise<void> {
  await page.goto(PRODUCTO_NUEVO_URL, { waitUntil: 'networkidle', timeout: 60000 });
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

  // ── Precios ──
  if (payload.pvp1 != null) await page.fill('input[name="pvp1"]', String(payload.pvp1));
  if (payload.pvp2 != null) await page.fill('input[name="pvp2"]', String(payload.pvp2));
  if (payload.pvp3 != null) await page.fill('input[name="pvp3"]', String(payload.pvp3));
  if (payload.pvp_distribuidor != null) {
    await page.fill('input[name="pvp_distribuidor"]', String(payload.pvp_distribuidor));
  }

  // ── Impuestos ──
  // IVA: opciones del select son '15', '5', '0', '-1' (string). Default 15.
  const ivaValue = String(payload.iva ?? 15);
  await page.selectOption('select[name="iva"]', ivaValue);

  // ── Contabilidad ──
  // Los checkboxes controlan la visibilidad de su cuenta asociada. Los checkeamos
  // y luego seteamos el hidden de la cuenta correspondiente.
  if (payload.para_venta) {
    await page.check('input[name="para_venta"]');
    if (payload.cuenta_venta_id) {
      await setHiddenValue(page, 'cuenta_venta_id', payload.cuenta_venta_id);
    }
  }
  if (payload.para_compra) {
    await page.check('input[name="para_compra"]');
    if (payload.cuenta_compra_id) {
      await setHiddenValue(page, 'cuenta_compra_id', payload.cuenta_compra_id);
    }
  }
  if (payload.inventariable) {
    await page.check('input[name="inventariable"]');
    if (payload.cuenta_costo_id) {
      await setHiddenValue(page, 'cuenta_costo_id', payload.cuenta_costo_id);
    }
  }
  if (payload.stock_minimo != null) {
    await page.fill('input[name="minimo"]', String(payload.stock_minimo));
  }

  // ── Configuraciones ──
  if (payload.para_pos) {
    await page.check('input[name="para_pos"]');
  }
  if (payload.lead_time != null) {
    await page.fill('input[name="dias_plazo"]', String(payload.lead_time));
  }

  // ── Submit ──
  // Llamamos GrabarProducto() directamente para evitar bugs de selector del botón.
  // Es la función global que Contifico expone (= document.forms.productoForm.submit()).
  await page.evaluate(() => {
    const w = window as unknown as { GrabarProducto?: () => void };
    if (typeof w.GrabarProducto === 'function') {
      w.GrabarProducto();
    } else {
      (document.forms as unknown as Record<string, HTMLFormElement>).productoForm.submit();
    }
  });

  // Esperar a que la URL cambie (Contifico redirige tras crear). Si hay error
  // de validación, el form se queda en /registrar2/ y este wait timeoutea.
  await page.waitForURL((url) => !url.toString().includes('/registrar2/'), {
    timeout: 30000,
  });
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
            error_message: msg.slice(0, 500),
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
