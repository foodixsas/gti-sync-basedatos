/**
 * Scraper de mapeo de IDs alfanuméricos (API REST de Contifico) hacia
 * enteros internos de Django (form web).
 *
 * Contifico expone DOS sistemas de IDs distintos para las mismas entidades:
 *   - API REST → IDs alfanuméricos: "xBleXogD1UkjodrN"  (ej: cat_unidades.id)
 *   - Form web → enteros Django:    331140              (ej: input[name="unidad_id"])
 *
 * Este script recorre los autocomplete endpoints del form web de Contifico,
 * extrae los pares { django_pk, nombre }, los matchea por nombre con las
 * tablas catálogo de contifico_raw para encontrar el api_id correspondiente,
 * y los UPSERT en gfc_finanzas.gfc_matriz_productos_contifico_pk_mapping_productos.
 *
 * Disparado por workflow scrape-pk-mapping.yml (manual + cron semanal).
 */

import { chromium, type Browser, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

// ─── Config ────────────────────────────────────────────────────────────────
const CONTIFICO_BASE = 'https://1793168604001.contifico.com';
const LOGIN_URL = `${CONTIFICO_BASE}/sistema/accounts/login/`;

const CONTIFICO_EMAIL = process.env.CONTIFICO_EMAIL || '';
const CONTIFICO_PASSWORD = process.env.CONTIFICO_PASSWORD || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const MAPPING_TABLE = 'gfc_matriz_productos_contifico_pk_mapping_productos';
const MAX_PAGES_SAFETY = 200; // hard cap defensivo

// ─── Supabase client ───────────────────────────────────────────────────────
// Default schema gfc_finanzas (donde está la mapping table). Para queries a
// contifico_raw usamos supabase.schema('contifico_raw') explícito.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'gfc_finanzas' },
});

// ─── Tipos ─────────────────────────────────────────────────────────────────
type EntityType = 'categoria' | 'unidad' | 'cuenta_contable';

interface EntityConfig {
  entity_type: EntityType;
  endpoint: string;       // path del autocomplete
  catalog_table: string;  // tabla en contifico_raw para resolver api_id por nombre
}

interface ScrapedEntry {
  django_pk: number;
  nombre: string;
}

interface MappingRow {
  entity_type: EntityType;
  api_id: string;
  django_pk: number;
  nombre: string;
}

// ─── Configuración de las entidades a scrapear ─────────────────────────────
// v1: solo las 3 entidades necesarias para crear un producto SIM.
// producto y empresa quedan para v2 cuando se necesiten.
const ENTITIES: EntityConfig[] = [
  {
    entity_type: 'unidad',
    endpoint: '/sistema/inventario/unidad/seleccionar/',
    catalog_table: 'cat_unidades',
  },
  {
    entity_type: 'categoria',
    endpoint: '/sistema/inventario/producto/categoria/seleccionar/',
    catalog_table: 'cat_categorias',
  },
  {
    entity_type: 'cuenta_contable',
    endpoint: '/sistema/contabilidad/cuenta/seleccionar/',
    catalog_table: 'cat_cuentas_contables',
  },
];

// ─── Login a Contifico ─────────────────────────────────────────────────────
async function loginContifico(page: Page): Promise<void> {
  console.log('🔐 Login a Contifico...');
  // 'load' en vez de 'networkidle' — Contifico tiene long-polling/keep-alive
  // (mismo fix que sync-productos.ts y scrape-costos.ts).
  await page.goto(LOGIN_URL, { waitUntil: 'load', timeout: 60000 });
  await page.fill('input[name="username"], input[type="email"], #id_username', CONTIFICO_EMAIL);
  await page.fill('input[name="password"], input[type="password"], #id_password', CONTIFICO_PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL('**/sistema/**', { timeout: 30000 });
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  console.log('✅ Login OK');
}

// ─── Fetch + parse de una página del autocomplete ──────────────────────────
//
// Usa page.request en vez de fetch() dentro de page.evaluate, porque
// Contifico hace navegaciones internas tras el login (long-polling, redirects)
// que destruyen el execution context del page mientras evaluate está
// corriendo. APIRequestContext de Playwright comparte las cookies del
// browser context pero no depende del page navigation state.
//
// El parsing del HTML lo hacemos en Node con regex (sin DOM disponible
// fuera del browser context) — el formato es estable: <a id="N">NOMBRE</a>.
async function fetchPage(page: Page, endpoint: string, pagina: number): Promise<{ entries: ScrapedEntry[]; total_pages: number }> {
  const url = `${CONTIFICO_BASE}${endpoint}?term=&pagina=${pagina}`;
  const response = await page.request.get(url);
  if (!response.ok()) {
    throw new Error(`HTTP ${response.status()} en ${endpoint}?pagina=${pagina}`);
  }
  const html = await response.text();

  // Extraer anchors <a id="NUMERO">NOMBRE</a> con regex
  const entries: ScrapedEntry[] = [];
  const anchorRegex = /<a[^>]*\bid=["'](\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRegex.exec(html)) !== null) {
    const pk = parseInt(m[1], 10);
    // Limpiar tags HTML internos y whitespace del nombre
    const rawName = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (rawName && pk > 0) {
      entries.push({ django_pk: pk, nombre: rawName });
    }
  }

  // Detectar total de páginas del texto "Página X de Y"
  const pagiMatch = html.match(/P[áa]gina\s+(\d+)\s+de\s+(\d+)/i);
  const total_pages = pagiMatch ? parseInt(pagiMatch[2], 10) : 1;

  return { entries, total_pages };
}

// ─── Scraper de UNA entidad completa ───────────────────────────────────────
async function scrapeEntity(page: Page, cfg: EntityConfig): Promise<{ inserted: number; skipped: string[] }> {
  console.log(`\n📋 ${cfg.entity_type}`);

  // 1. Recolectar TODAS las entries iterando paginación
  const collected: ScrapedEntry[] = [];
  let pagina = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { entries, total_pages } = await fetchPage(page, cfg.endpoint, pagina);
    collected.push(...entries);
    console.log(`   página ${pagina}/${total_pages}: ${entries.length} entries`);

    if (pagina >= total_pages) break;
    pagina++;
    if (pagina > MAX_PAGES_SAFETY) {
      console.warn(`   ⚠️  hit MAX_PAGES_SAFETY (${MAX_PAGES_SAFETY}), parando`);
      break;
    }
    // Pausa anti-detección
    await page.waitForTimeout(300);
  }
  console.log(`   total recolectado: ${collected.length}`);

  // 2. Leer la tabla catálogo de contifico_raw para resolver api_id por nombre
  const { data: catalog, error: catErr } = await supabase
    .schema('contifico_raw')
    .from(cfg.catalog_table)
    .select('id, nombre');

  if (catErr || !catalog) {
    throw new Error(`Error leyendo ${cfg.catalog_table}: ${catErr?.message ?? 'no data'}`);
  }
  console.log(`   catálogo ${cfg.catalog_table}: ${catalog.length} filas`);

  // Map de búsqueda nombre lowercased + trimmed → api_id
  const nameMap = new Map<string, string>();
  for (const row of catalog as Array<{ id: string; nombre: string | null }>) {
    if (row.nombre && row.id) {
      const key = row.nombre.replace(/\s+/g, ' ').trim().toLowerCase();
      nameMap.set(key, row.id);
    }
  }

  // 3. Para cada scraped entry, encontrar api_id matchando por nombre
  const skipped: string[] = [];
  const upsertRows: MappingRow[] = [];
  for (const entry of collected) {
    const key = entry.nombre.replace(/\s+/g, ' ').trim().toLowerCase();
    const apiId = nameMap.get(key);
    if (!apiId) {
      skipped.push(entry.nombre);
      continue;
    }
    upsertRows.push({
      entity_type: cfg.entity_type,
      api_id: apiId,
      django_pk: entry.django_pk,
      nombre: entry.nombre,
    });
  }

  // 4. UPSERT en mapping table (idempotente: refresca updated_at)
  if (upsertRows.length > 0) {
    const { error: upErr } = await supabase
      .from(MAPPING_TABLE)
      .upsert(upsertRows, { onConflict: 'entity_type,api_id' });
    if (upErr) {
      throw new Error(`Error upsert ${cfg.entity_type}: ${upErr.message}`);
    }
  }

  console.log(`   ✅ ${upsertRows.length} mapeos guardados, ${skipped.length} skipped`);
  if (skipped.length > 0 && skipped.length <= 15) {
    console.log(`      skipped names: ${JSON.stringify(skipped)}`);
  } else if (skipped.length > 15) {
    console.log(`      first 15 skipped: ${JSON.stringify(skipped.slice(0, 15))}`);
  }

  return { inserted: upsertRows.length, skipped };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('\n🚀 Scrape PK Mapping → ' + MAPPING_TABLE);

  if (!CONTIFICO_EMAIL || !CONTIFICO_PASSWORD) {
    console.error('❌ CONTIFICO_EMAIL y CONTIFICO_PASSWORD son requeridos');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
    process.exit(1);
  }

  let browser: Browser | null = null;
  let totalInserted = 0;
  let totalSkipped = 0;

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

    for (const cfg of ENTITIES) {
      const r = await scrapeEntity(page, cfg);
      totalInserted += r.inserted;
      totalSkipped += r.skipped.length;
    }
  } catch (err) {
    console.error('\n❌ Error fatal:', err);
    throw err;
  } finally {
    if (browser) await browser.close();
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`📊 RESUMEN`);
  console.log(`   Mapeos guardados: ${totalInserted}`);
  console.log(`   Skipped (sin match en cat_*): ${totalSkipped}`);
  console.log(`════════════════════════════════════════\n`);
}

main().catch((e) => {
  console.error('❌ fatal:', e);
  process.exit(1);
});
