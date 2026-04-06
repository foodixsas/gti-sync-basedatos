import { chromium, type Page, type Download } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// ─── Config ────────────────────────────────────────────────────────────────
const CONTIFICO_URL = 'https://1793168604001.contifico.com';
const LOGIN_URL = `${CONTIFICO_URL}/sistema/accounts/login/`;
const MOVIMIENTOS_URL = `${CONTIFICO_URL}/sistema/inventario/movimiento/`;

const CONTIFICO_EMAIL = process.env.CONTIFICO_EMAIL!;
const CONTIFICO_PASSWORD = process.env.CONTIFICO_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MAPEO_CENTRO_COSTO: Record<string, string> = {
  'REAL': 'CHIOS REAL AUDIENCIA',
  'PORTUGAL': 'CHIOS PORTUGAL',
  'FLOREANA': 'CHIOS FLOREANA',
  'SIMON BOLON': 'SIMON BOLON REAL AUDIENCIA',
  'SANTO CACHON REAL': 'SANTO CACHON REAL AUDIENCIA',
  'SANTO CACHON PORTUGAL': 'SANTO CACHON PORTUGAL',
  'BODEGA PRINCIPAL': 'BODEGA PRINCIPAL',
  'PLANTA DE PRODUCCION': 'PLANTA DE PRODUCCION',
  'BODEGA MATERIA PRIMA': 'BODEGA MATERIA PRIMA',
  'BODEGA CALIDAD': 'BODEGA CALIDAD',
  'FOODIX FRIES': 'FOODIX FRIES',
};

// ─── Args ──────────────────────────────────────────────────────────────────
function parseArgs(): { desde: string; hasta: string } {
  const args = process.argv.slice(2);
  let desde = '01/2026', hasta = '04/2026';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--desde' && args[i + 1]) desde = args[i + 1];
    if (args[i] === '--hasta' && args[i + 1]) hasta = args[i + 1];
  }
  return { desde, hasta };
}

function generateMonths(desde: string, hasta: string): { inicio: string; fin: string; batch: string }[] {
  const [mDesde, yDesde] = desde.split('/').map(Number);
  const [mHasta, yHasta] = hasta.split('/').map(Number);
  const months: { inicio: string; fin: string; batch: string }[] = [];

  let y = yDesde, m = mDesde;
  while (y < yHasta || (y === yHasta && m <= mHasta)) {
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, '0');
    const yy = String(y);
    months.push({
      inicio: `01/${mm}/${yy}`,
      fin: `${lastDay}/${mm}/${yy}`,
      batch: `${yy}-${mm}`,
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// ─── Login ─────────────────────────────────────────────────────────────────
async function login(page: Page): Promise<void> {
  console.log('🔐 Logging in to Contifico...');
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"], input[type="email"], #id_username', CONTIFICO_EMAIL);
  await page.fill('input[name="password"], input[type="password"], #id_password', CONTIFICO_PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL('**/sistema/**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  console.log('✅ Login exitoso');
}

// ─── Download Excel ────────────────────────────────────────────────────────
async function downloadExcelForMonth(
  page: Page,
  inicio: string,
  fin: string,
  downloadDir: string
): Promise<string | null> {
  console.log(`📥 Descargando: ${inicio} → ${fin}`);

  await page.goto(MOVIMIENTOS_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Select Tipo = ING (find the select that has ING option, not the empresa select)
  await page.evaluate(() => {
    const selects = document.querySelectorAll('select');
    for (const sel of selects) {
      const options = sel.querySelectorAll('option');
      for (const opt of options) {
        if (opt.value === 'ING') {
          sel.value = 'ING';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }
    }
  });

  // Set dates
  await page.evaluate(({ inicio, fin }) => {
    const fechaInicio = document.getElementById('id_fecha_inicio') as HTMLInputElement;
    const fechaFin = document.getElementById('id_fecha_fin') as HTMLInputElement;
    if (fechaInicio) fechaInicio.value = inicio;
    if (fechaFin) fechaFin.value = fin;
  }, { inicio, fin });

  // Click Consultar
  await page.evaluate(() => {
    const fn = (window as any).cambiarPagina;
    if (fn) fn(1);
  });
  await page.waitForLoadState('load');
  await page.waitForTimeout(5000);

  // Check if there are results
  const rowCount = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
  if (rowCount === 0) {
    console.log('  ⚠️ Sin resultados para este período');
    return null;
  }
  console.log(`  📊 ${rowCount} movimientos encontrados`);

  // Click Excel Detallado and wait for download
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.evaluate(() => {
    const fn = (window as any).exportarExcelPorProducto;
    if (fn) fn(document.querySelector('a'));
  });

  let download: Download;
  try {
    download = await downloadPromise;
  } catch {
    console.log('  ❌ Timeout esperando descarga');
    return null;
  }

  const filePath = path.join(downloadDir, `${inicio.replace(/\//g, '-')}.xls`);
  await download.saveAs(filePath);
  console.log(`  ✅ Descargado: ${filePath}`);
  return filePath;
}

// ─── Parse Excel ───────────────────────────────────────────────────────────
interface ExcelRow {
  codigo: string;
  fecha: string;
  tipo: string;
  bodega_destino: string;
  descripcion: string;
  codigo_prod: string;
  nombre_prod: string;
  categoria_prod: string;
  unidad: string;
  cantidad: number;
  valor_unitario: number;
  valor_total: number;
  pvp: number;
  centro_costo: string;
  centro_costo_nombre: string;
  scrape_batch: string;
}

function parseDateContifico(raw: string): string {
  // DD/MM/YY or DD/MM/YYYY → YYYY-MM-DD
  const parts = raw.split('/');
  if (parts.length !== 3) return raw;
  const [d, m, y] = parts;
  const fullYear = y.length === 2 ? `20${y}` : y;
  return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseExcel(filePath: string, batch: string): ExcelRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find header row (contains 'Fecha', 'Codigo', etc.)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const row = raw[i];
    if (row && row.some((c: any) => String(c).trim() === 'Fecha') && row.some((c: any) => String(c).trim() === 'Codigo')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    console.log('  ⚠️ No se encontró header en el Excel');
    return [];
  }

  const headers = raw[headerIdx].map((h: any) => String(h || '').trim());
  const colIdx = (name: string) => headers.indexOf(name);

  const rows: ExcelRow[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || !r[colIdx('Codigo')]) continue;

    const fechaRaw = String(r[colIdx('Fecha')] || '');
    const centroCosto = String(r[colIdx('Centro de costo')] || '').trim();

    rows.push({
      codigo: String(r[colIdx('Codigo')] || '').trim(),
      fecha: parseDateContifico(fechaRaw),
      tipo: String(r[colIdx('Tipo')] || 'ING').trim(),
      bodega_destino: String(r[colIdx('BodegaDestino')] || '').trim(),
      descripcion: String(r[colIdx('Descripción')] || r[colIdx('Descripcion')] || '').trim(),
      codigo_prod: String(r[colIdx('Codigo Prod.')] || '').trim(),
      nombre_prod: String(r[colIdx('Nombre Prod.')] || '').trim(),
      categoria_prod: String(r[colIdx('Categoria Prod.')] || '').trim(),
      unidad: String(r[colIdx('Unidad')] || '').trim(),
      cantidad: Number(r[colIdx('Cantidad')] || 0),
      valor_unitario: Number(r[colIdx('Valor Unitario')] || 0),
      valor_total: Number(r[colIdx('Valor Total')] || 0),
      pvp: Number(r[colIdx('PVP')] || 0),
      centro_costo: centroCosto,
      centro_costo_nombre: MAPEO_CENTRO_COSTO[centroCosto] || centroCosto,
      scrape_batch: batch,
    });
  }
  return rows;
}

// ─── Upsert to Supabase ────────────────────────────────────────────────────
async function upsertToSupabase(rows: ExcelRow[]): Promise<{ inserted: number; errors: number }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  let inserted = 0, errors = 0;
  const BATCH_SIZE = 200;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase.rpc('fn_upsert_contif_scrape', {
      p_rows: JSON.stringify(batch),
    });

    if (error) {
      console.error(`  ❌ Batch error at ${i}:`, error.message);
      errors += batch.length;
    } else {
      const result = data as { inserted: number };
      inserted += result.inserted;
    }
  }
  return { inserted, errors };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const { desde, hasta } = parseArgs();
  console.log(`\n🚀 Scrape Costos Contifico`);
  console.log(`   Desde: ${desde} → Hasta: ${hasta}\n`);

  if (!CONTIFICO_EMAIL || !CONTIFICO_PASSWORD) {
    console.error('❌ CONTIFICO_EMAIL y CONTIFICO_PASSWORD son requeridos');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
    process.exit(1);
  }

  const months = generateMonths(desde, hasta);
  console.log(`📅 ${months.length} meses a procesar\n`);

  const downloadDir = path.join(process.cwd(), 'tmp-downloads');
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  let totalInserted = 0, totalErrors = 0, totalMonths = 0;

  try {
    await login(page);

    for (const month of months) {
      console.log(`\n── Mes: ${month.batch} ──────────────────────────`);

      const filePath = await downloadExcelForMonth(page, month.inicio, month.fin, downloadDir);
      if (!filePath) continue;

      const rows = parseExcel(filePath, month.batch);
      console.log(`  📝 ${rows.length} líneas parseadas`);

      if (rows.length > 0) {
        const costoReal = rows.filter(r => r.valor_total > 0).length;
        const costoCero = rows.filter(r => r.valor_total === 0).length;
        console.log(`  💰 Con costo real: ${costoReal} | Con $0: ${costoCero} (${(costoCero / rows.length * 100).toFixed(1)}%)`);

        const { inserted, errors } = await upsertToSupabase(rows);
        totalInserted += inserted;
        totalErrors += errors;
        console.log(`  ✅ Supabase: ${inserted} insertados, ${errors} errores`);
      }

      totalMonths++;

      // Cleanup file
      fs.unlinkSync(filePath);

      // Anti-detection pause (5-10 seconds random)
      const pause = 5000 + Math.random() * 5000;
      console.log(`  ⏳ Pausa ${(pause / 1000).toFixed(1)}s...`);
      await page.waitForTimeout(pause);
    }
  } catch (err) {
    console.error('\n❌ Error fatal:', err);
  } finally {
    await browser.close();
    // Cleanup download dir
    if (fs.existsSync(downloadDir)) fs.rmSync(downloadDir, { recursive: true });
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`📊 RESUMEN`);
  console.log(`   Meses procesados: ${totalMonths}/${months.length}`);
  console.log(`   Registros insertados: ${totalInserted}`);
  console.log(`   Errores: ${totalErrors}`);
  console.log(`════════════════════════════════════════\n`);
}

main().catch(console.error);
