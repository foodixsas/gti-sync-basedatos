/**
 * scrape-mov-inventario.ts — Export "Detalle Movimientos Inventario" del sistema web de Contifico
 * → contifico_web.mov_inventario_detalle (fuente única de movimientos con costo real por línea).
 *
 * Cómo funciona:
 *   1. Login con usuario/clave (Playwright, un solo login por corrida).
 *   2. Por cada "slice" (rango de fechas × tipo × origen) hace GET al export con las cookies de la sesión
 *      (`page.request.get`) — sin abrir pantallas ni clics — y recibe el .xls.
 *   3. Valida el encabezado (19 columnas exactas: si Contifico cambia el formato, falla en rojo).
 *   4. Normaliza filas → RPC fn_web_mov_stage (lotes) → RPC fn_web_mov_commit (reemplazo por documento,
 *      cabeceras, fantasmas y latido en contifico_web.sync_log). Un slice vacío también deja latido.
 *   5. Slices: ventas POS (EGR × origen DOC) van POR DÍA (es el 98 % del volumen); el resto por semana
 *      y por (tipo × origen) para que cada fila lleve su origen como dato del filtro, no deducido del texto.
 *
 * Uso:
 *   tsx src/scripts/scrape-mov-inventario.ts                                  # diario: ayer y hoy (hora Ecuador)
 *   tsx src/scripts/scrape-mov-inventario.ts --desde 01/07/2026 --hasta 31/07/2026 --modo backfill
 *   tsx src/scripts/scrape-mov-inventario.ts --desde 03/08/2026 --hasta 14/08/2026 --solo EGR:MAN --dry
 *
 * Salida: exit 0 si todos los slices OK; exit 1 si alguno falló; exit 2 si Contifico bloqueó (403/429/login caído).
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// ─── Config ────────────────────────────────────────────────────────────────
const CONTIFICO_URL = 'https://1793168604001.contifico.com';
const LOGIN_URL = `${CONTIFICO_URL}/sistema/accounts/login/`;
const EXPORT_URL = `${CONTIFICO_URL}/sistema/inventario/movimiento/`;

const CONTIFICO_EMAIL = process.env.CONTIFICO_EMAIL!;
const CONTIFICO_PASSWORD = process.env.CONTIFICO_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TIPOS = ['ING', 'EGR', 'TRA', 'AJU'] as const;
const ORIGENES = ['DOC', 'PRO', 'MAN', 'IMP', 'API', 'AUT', 'ORP', 'MED', 'LIQ'] as const;
const HEAVY: [string, string] = ['EGR', 'DOC']; // ventas POS: por día

// Columnas EXACTAS del export (si cambia el encabezado, el scraper falla en rojo)
const EXPECTED_COLS = [
  'Fecha', 'Codigo', 'Tipo', 'Bodega Origen', 'BodegaDestino', 'Descripción', 'Cantidad', 'Unidad',
  'Codigo Prod.', 'Nombre Prod.', 'Serie', 'PVP', 'Valor Unitario', 'Valor Total', 'Referencia',
  'Centro de costo', 'Proyecto', 'Categoria Prod.', 'Orden Compra Venta',
];

const STAGE_BATCH = 1000;
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000; // ventas de un día puede tardar minutos
const PAUSE_LIGHT_MS: [number, number] = [2000, 5000];
const PAUSE_HEAVY_MS: [number, number] = [5000, 10000];

// ─── Args ──────────────────────────────────────────────────────────────────
interface Args { desde: string; hasta: string; modo: string; solo?: string; dry: boolean; keepFiles: boolean; }

function todayEcuador(): Date {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmtDMY(d: Date): string { return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; }
function fmtISO(d: Date): string { return d.toISOString().slice(0, 10); }
function parseDMY(s: string): Date { const [d, m, y] = s.split('/').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r; }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string) => { const i = a.indexOf(k); return i >= 0 && a[i + 1] ? a[i + 1] : undefined; };
  const hoy = todayEcuador();
  const desde = get('--desde') ?? fmtDMY(addDays(hoy, -1));
  const hasta = get('--hasta') ?? fmtDMY(hoy);
  const modo = get('--modo') ?? (get('--desde') ? 'manual' : 'diario');
  return { desde, hasta, modo, solo: get('--solo'), dry: a.includes('--dry'), keepFiles: a.includes('--keep-files') };
}

// ─── Slices ────────────────────────────────────────────────────────────────
interface Slice { desde: Date; hasta: Date; tipo: string; origen: string; heavy: boolean; }

export function buildSlices(desde: Date, hasta: Date, solo?: string): Slice[] {
  const slices: Slice[] = [];
  const combos: [string, string][] = [];
  for (const t of TIPOS) for (const o of ORIGENES) combos.push([t, o]);
  const filtered = solo ? combos.filter(([t, o]) => `${t}:${o}` === solo.toUpperCase()) : combos;

  for (const [tipo, origen] of filtered) {
    const heavy = tipo === HEAVY[0] && origen === HEAVY[1];
    if (heavy) {
      for (let d = new Date(desde); d <= hasta; d = addDays(d, 1)) slices.push({ desde: d, hasta: d, tipo, origen, heavy: true });
    } else {
      for (let d = new Date(desde); d <= hasta; d = addDays(d, 7)) {
        const fin = addDays(d, 6) > hasta ? hasta : addDays(d, 6);
        slices.push({ desde: d, hasta: fin, tipo, origen, heavy: false });
      }
    }
  }
  // livianos primero (rápidos), pesados al final
  return slices.sort((a, b) => Number(a.heavy) - Number(b.heavy) || a.desde.getTime() - b.desde.getTime());
}

export function exportUrl(s: Slice): string {
  const q = new URLSearchParams({ excel: '2', fecha_inicio: fmtDMY(s.desde), fecha_fin: fmtDMY(s.hasta), tipo: s.tipo, origen: s.origen });
  return `${EXPORT_URL}?${q.toString()}`;
}

// ─── Login ─────────────────────────────────────────────────────────────────
async function login(page: Page): Promise<void> {
  console.log('🔐 Login Contifico…');
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"], input[type="email"], #id_username', CONTIFICO_EMAIL);
  await page.fill('input[name="password"], input[type="password"], #id_password', CONTIFICO_PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL('**/sistema/**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  console.log('✅ Login OK');
}

// ─── Parse ─────────────────────────────────────────────────────────────────
interface Row {
  fecha: string; codigo: string; tipo: string; origen: string; bodega_origen: string; bodega_destino: string; descripcion: string;
  cantidad: number | null; unidad: string; codigo_prod: string; nombre_prod: string; serie: string;
  pvp: number | null; valor_unitario: number | null; valor_total: number | null;
  referencia: string; referencia_tipo: string; referencia_num: string;
  centro_costo: string; proyecto: string; categoria_prod: string; orden_compra_venta: string; row_num: number;
}

function toStr(v: any): string { return v === null || v === undefined ? '' : String(v).trim(); }
function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}
function isoFromContifico(raw: any): string | null {
  const s = toStr(raw);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function parseReferencia(ref: string): { tipo: string; num: string } {
  const m = ref.match(/^([A-Z]{2,5})\s+(.+)$/);
  return m ? { tipo: m[1], num: m[2].trim() } : { tipo: '', num: ref };
}

type ParseResult = { ok: true; rows: Row[]; extraCols: string[] } | { ok: false; error: string };

export function parseXls(buf: Buffer, slice: Slice): ParseResult {
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(buf, { type: 'buffer' }); } catch (e) { return { ok: false, error: `xls ilegible: ${(e as Error).message}` }; }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { ok: false, error: 'xls sin hojas' };
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  let headerIdx = -1;
  for (let i = 0; i < Math.min(12, raw.length); i++) {
    const r = raw[i] ?? [];
    if (r.some((c: any) => toStr(c) === 'Fecha') && r.some((c: any) => toStr(c) === 'Codigo')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return { ok: false, error: 'header no encontrado (¿login expirado o formato nuevo?)' };
  const headers = raw[headerIdx].map((h: any) => toStr(h));
  const missing = EXPECTED_COLS.filter((c) => !headers.includes(c));
  if (missing.length) return { ok: false, error: `columnas faltantes en export: ${missing.join(', ')} | header=${headers.join('|')}` };
  const extraCols = headers.filter((h) => h && !EXPECTED_COLS.includes(h));
  const ix = (name: string) => headers.indexOf(name);

  const rows: Row[] = [];
  const rowNum = new Map<string, number>();
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i]; if (!r) continue;
    const codigo = toStr(r[ix('Codigo')]);
    const fecha = isoFromContifico(r[ix('Fecha')]);
    if (!codigo || !fecha) continue; // filas de título/pie/vacías
    const n = (rowNum.get(codigo) ?? 0) + 1; rowNum.set(codigo, n);
    const referencia = toStr(r[ix('Referencia')]);
    const ref = parseReferencia(referencia);
    rows.push({
      fecha, codigo, tipo: toStr(r[ix('Tipo')]) || slice.tipo, origen: slice.origen,
      bodega_origen: toStr(r[ix('Bodega Origen')]), bodega_destino: toStr(r[ix('BodegaDestino')]),
      descripcion: toStr(r[ix('Descripción')]), cantidad: toNum(r[ix('Cantidad')]), unidad: toStr(r[ix('Unidad')]),
      codigo_prod: toStr(r[ix('Codigo Prod.')]), nombre_prod: toStr(r[ix('Nombre Prod.')]), serie: toStr(r[ix('Serie')]),
      pvp: toNum(r[ix('PVP')]), valor_unitario: toNum(r[ix('Valor Unitario')]), valor_total: toNum(r[ix('Valor Total')]),
      referencia, referencia_tipo: ref.tipo, referencia_num: ref.num,
      centro_costo: toStr(r[ix('Centro de costo')]), proyecto: toStr(r[ix('Proyecto')]),
      categoria_prod: toStr(r[ix('Categoria Prod.')]), orden_compra_venta: toStr(r[ix('Orden Compra Venta')]),
      row_num: n,
    });
  }
  return { ok: true, rows, extraCols };
}

// ─── Main ──────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = ([a, b]: [number, number]) => a + Math.floor(Math.random() * (b - a));

async function main() {
  const args = parseArgs();
  for (const [k, v] of Object.entries({ CONTIFICO_EMAIL, CONTIFICO_PASSWORD, SUPABASE_URL, SUPABASE_KEY })) {
    if (!v) { console.error(`❌ Falta variable de entorno ${k}`); process.exit(1); }
  }
  const desde = parseDMY(args.desde), hasta = parseDMY(args.hasta);
  if (!(desde <= hasta)) { console.error('❌ --desde debe ser ≤ --hasta'); process.exit(1); }
  const runId = randomUUID();
  const slices = buildSlices(desde, hasta, args.solo);
  const t0 = Date.now();
  console.log(`▶ scrape-mov-inventario run=${runId} modo=${args.modo} ${args.desde}→${args.hasta} slices=${slices.length} (pesados=${slices.filter((s) => s.heavy).length}) dry=${args.dry}`);

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const tmpDir = path.join(process.cwd(), 'tmp', 'mov-inventario'); if (args.keepFiles) fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await login(page);

  let ok = 0, fail = 0, filasTotal = 0, docsTotal = 0, blocked = false, relogins = 0;

  const logFail = async (s: Slice, status: number | null, bytes: number | null, durMs: number, error: string) => {
    console.log(`  ❌ ${s.tipo}:${s.origen} ${fmtDMY(s.desde)}→${fmtDMY(s.hasta)} ${error}`);
    if (args.dry) return;
    await supabase.rpc('fn_web_mov_log', {
      p_run_id: runId, p_fecha_desde: fmtISO(s.desde), p_fecha_hasta: fmtISO(s.hasta), p_tipo: s.tipo, p_origen: s.origen,
      p_modo: args.modo, p_ok: false, p_http_status: status, p_bytes: bytes, p_dur_ms: durMs, p_error: error.slice(0, 500), p_meta: { url: exportUrl(s) },
    });
  };

  for (let i = 0; i < slices.length && !blocked; i++) {
    const s = slices[i];
    const url = exportUrl(s);
    const label = `[${i + 1}/${slices.length}] ${s.tipo}:${s.origen} ${fmtDMY(s.desde)}→${fmtDMY(s.hasta)}`;
    const ts = Date.now();
    let status: number | null = null, buf: Buffer | null = null, ctype = '';
    for (let attempt = 1; attempt <= 2 && !buf; attempt++) {
      try {
        const resp = await context.request.get(url, { timeout: REQUEST_TIMEOUT_MS });
        status = resp.status(); ctype = resp.headers()['content-type'] ?? '';
        const body = await resp.body();
        if (status === 403 || status === 429) { blocked = true; await logFail(s, status, body.length, Date.now() - ts, `bloqueo HTTP ${status}`); break; }
        if (status !== 200) { if (attempt === 2) await logFail(s, status, body.length, Date.now() - ts, `HTTP ${status}`); else await sleep(30000); continue; }
        if (ctype.includes('text/html')) {
          const html = body.toString('utf8');
          if (html.includes('id_username') || html.includes('accounts/login')) {
            if (relogins >= 2) { blocked = true; await logFail(s, status, body.length, Date.now() - ts, 'sesión caída y relogin agotado'); break; }
            relogins++; console.log('  ⚠️ sesión expirada → relogin'); await login(page); continue;
          }
          if (attempt === 2) await logFail(s, status, body.length, Date.now() - ts, `HTML en vez de xls (${html.includes('Lo sentimos') ? 'error 500 Contifico' : 'desconocido'})`); else await sleep(30000);
          continue;
        }
        buf = body;
      } catch (e) {
        if (attempt === 2) await logFail(s, status, null, Date.now() - ts, `excepción: ${(e as Error).message}`); else await sleep(30000);
      }
    }
    if (!buf) { fail++; await sleep(rand(s.heavy ? PAUSE_HEAVY_MS : PAUSE_LIGHT_MS)); continue; }
    const durDl = Date.now() - ts;
    if (args.keepFiles) fs.writeFileSync(path.join(tmpDir, `${s.tipo}_${s.origen}_${fmtISO(s.desde)}_${fmtISO(s.hasta)}.xls`), buf);

    const parsed = parseXls(buf, s);
    if (!parsed.ok) { fail++; await logFail(s, status, buf.length, durDl, parsed.error); if (parsed.error.startsWith('columnas faltantes')) { blocked = true; } await sleep(rand(PAUSE_LIGHT_MS)); continue; }
    if (parsed.extraCols.length) console.log(`  ℹ️ columnas nuevas en export (ignoradas): ${parsed.extraCols.join(', ')}`);

    if (args.dry) {
      const docs = new Set(parsed.rows.map((r) => r.codigo)).size;
      console.log(`${label} DRY status=${status} bytes=${buf.length} filas=${parsed.rows.length} docs=${docs} ${durDl}ms`);
      ok++; filasTotal += parsed.rows.length; docsTotal += docs;
      await sleep(rand(s.heavy ? PAUSE_HEAVY_MS : PAUSE_LIGHT_MS)); continue;
    }

    // stage en lotes
    let stageErr: string | null = null;
    for (let j = 0; j < parsed.rows.length && !stageErr; j += STAGE_BATCH) {
      const { error } = await supabase.rpc('fn_web_mov_stage', { p_run_id: runId, p_rows: parsed.rows.slice(j, j + STAGE_BATCH) });
      if (error) stageErr = `stage: ${error.message}`;
    }
    if (stageErr) { fail++; await logFail(s, status, buf.length, Date.now() - ts, stageErr); await sleep(rand(PAUSE_LIGHT_MS)); continue; }

    const { data, error } = await supabase.rpc('fn_web_mov_commit', {
      p_run_id: runId, p_fecha_desde: fmtISO(s.desde), p_fecha_hasta: fmtISO(s.hasta), p_tipo: s.tipo, p_origen: s.origen,
      p_modo: args.modo, p_http_status: status, p_bytes: buf.length, p_dur_ms: Date.now() - ts,
      p_meta: { url, filas_archivo: parsed.rows.length, extra_cols: parsed.extraCols },
    });
    if (error) { fail++; await logFail(s, status, buf.length, Date.now() - ts, `commit: ${error.message}`); await sleep(rand(PAUSE_LIGHT_MS)); continue; }
    ok++; filasTotal += data?.filas ?? 0; docsTotal += data?.docs ?? 0;
    console.log(`${label} status=${status} bytes=${buf.length} filas=${data?.filas} docs=${data?.docs} (+${data?.nuevos} ~${data?.actualizados} -${data?.borrados}) ${Date.now() - ts}ms`);
    await sleep(rand(s.heavy ? PAUSE_HEAVY_MS : PAUSE_LIGHT_MS));
  }

  await browser.close();
  const summary = { run_id: runId, modo: args.modo, desde: args.desde, hasta: args.hasta, slices: slices.length, ok, fail, blocked, filas: filasTotal, docs: docsTotal, dur_min: Math.round((Date.now() - t0) / 60000) };
  console.log(`■ RESUMEN ${JSON.stringify(summary)}`);
  process.exit(blocked ? 2 : fail > 0 ? 1 : 0);
}

if (!process.env.SCRAPE_NO_MAIN) main().catch((e) => { console.error('❌ fatal', e); process.exit(1); });
