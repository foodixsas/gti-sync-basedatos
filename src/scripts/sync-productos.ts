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
const PK_MAPPING_TABLE = 'gfc_matriz_productos_contifico_pk_mapping_productos';

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

// Estructuras de fórmula — coinciden con los types del dashboard
// (src/lib/types/productos.ts): FormulaPRO y FormulaCOP.
//
// IMPORTANTE: el payload del sync_queue usa los campos con nombres Foodix
// (cuenta_ingresos_id / cuenta_costo_id / cuenta_inventario_id) y una unión
// discriminada para tipo_formula (receta_fija | opciones_variables). El mapeo
// a los nombres internos de Django se hace al llenar el form.
interface FormulaItem {
  producto_id: string;        // api_id (alfanumérico) — se resuelve a django_pk
  cantidad: number;
  unidad_id?: string | null;  // api_id alfanumérico del catálogo unidades
}

type FormulaPRO = FormulaItem[];

interface RecetaFijaCOP {
  modo: 'receta_fija';
  detalles: FormulaItem[];
}

interface OpcionesVariablesCOP {
  modo: 'opciones_variables';
  opciones: Array<{
    nombre: string;
    seleccion: 'UN' | 'VA';   // Sólo Uno / Varios o Ninguno
    detalles: FormulaItem[];
  }>;
}

type FormulaCOP = RecetaFijaCOP | OpcionesVariablesCOP;

interface ProductoPayload {
  codigo: string;
  nombre?: string | null;
  descripcion?: string | null;
  codigo_auxiliar?: string | null;
  categoria_id?: string | null;
  unidad_id?: string | null;
  tipo_contifico?: 'PRO' | 'SER' | null;
  tipo_producto_contifico?: 'SIM' | 'PRO' | 'COP' | null;
  iva?: number | null;
  pvp1?: number | null;
  pvp2?: number | null;
  pvp3?: number | null;
  pvp_distribuidor?: number | null;
  stock_minimo?: number | null;
  lead_time?: number | null;
  para_pos?: boolean | null;
  para_venta?: boolean | null;
  para_compra?: boolean | null;
  inventariable?: boolean | null;
  // Cuentas — nombres Foodix. Mapeo a Django (se hace al llenar el form):
  //   cuenta_ingresos_id   → input[name="cuenta_venta_id"]  (label "Ingresos")
  //   cuenta_costo_id      → input[name="cuenta_compra_id"] (label "Costo")
  //   cuenta_inventario_id → input[name="cuenta_costo_id"]  (label "Inventario")
  cuenta_ingresos_id?: string | null;
  cuenta_costo_id?: string | null;
  cuenta_inventario_id?: string | null;
  // Fórmulas (según tipo_producto_contifico)
  formula?: FormulaPRO | null;
  tipo_formula?: FormulaCOP | null;
  // POS específicos — CSV de django_pk. null/'' = todos los POS
  pos_ids_csv?: string | null;
  // Flags NO enviados a Contifico — viven solo en Foodix. Si llegan, ignorar.
  aplica_delivery?: boolean | null;
  foto_url?: string | null;
}

// ─── Supabase client ───────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  db: { schema: QUEUE_SCHEMA },
});

// ─── PK Mapping API → Django ───────────────────────────────────────────────
// Contifico expone DOS sistemas de IDs distintos. La API REST usa
// alfanuméricos (xBleXogD1UkjodrN) almacenados en contifico_raw.cat_*. El
// form web usa enteros internos de Django (331140) en los inputs hidden
// como categoria_id, unidad_id, cuenta_*_id. Esta función traduce un
// payload con api_ids al equivalente con django_pks usando la tabla
// gfc_matriz_productos_contifico_pk_mapping_productos (popul vía workflow
// scrape-pk-mapping.yml).
//
// Si algún api_id no tiene mapping → throw, para que el row falle con
// mensaje claro pidiendo refrescar el scraper.
interface ResolvedPks {
  categoria: string | null;
  unidad: string | null;
  // Django-named: cuenta_venta = Ingresos, cuenta_compra = Costo, cuenta_costo = Inventario
  cuenta_venta: string | null;
  cuenta_compra: string | null;
  cuenta_costo: string | null;
  // Lookup por api_id (producto o unidad) para los items de fórmula
  // Clave: "entity_type:api_id" → django_pk string
  formula_lookup: Record<string, string>;
  // Lookup de nombres de unidad por api_id — necesario porque los inputs
  // visibles del form (formula_N-unidad, tipo_formula_N_M-unidad) toman el
  // NOMBRE textual ("Gramos", "Unidad"), no el pk. Los leemos de
  // contifico_raw.cat_unidades.
  unidad_nombres: Record<string, string>;  // api_id → nombre
}

async function resolveDjangoPks(payload: ProductoPayload): Promise<ResolvedPks> {
  // Foodix → Django mapping de cuentas (los nombres Django son los del input
  // HTML del form, y son CONTRA-intuitivos por historia del bug 18.M):
  //   Foodix cuenta_ingresos_id   → Django cuenta_venta_id   (label "Ingresos")
  //   Foodix cuenta_costo_id      → Django cuenta_compra_id  (label "Costo")
  //   Foodix cuenta_inventario_id → Django cuenta_costo_id   (label "Inventario")
  const need: Array<{ entity_type: string; api_id: string; field?: keyof Omit<ResolvedPks, 'formula_lookup' | 'unidad_nombres'> }> = [];
  if (payload.categoria_id) need.push({ entity_type: 'categoria', api_id: payload.categoria_id, field: 'categoria' });
  if (payload.unidad_id) need.push({ entity_type: 'unidad', api_id: payload.unidad_id, field: 'unidad' });
  if (payload.cuenta_ingresos_id) need.push({ entity_type: 'cuenta_contable', api_id: payload.cuenta_ingresos_id, field: 'cuenta_venta' });
  if (payload.cuenta_costo_id) need.push({ entity_type: 'cuenta_contable', api_id: payload.cuenta_costo_id, field: 'cuenta_compra' });
  if (payload.cuenta_inventario_id) need.push({ entity_type: 'cuenta_contable', api_id: payload.cuenta_inventario_id, field: 'cuenta_costo' });

  // Items de fórmula (PRO) — cada uno con producto_id y unidad_id
  const formulaItems: FormulaItem[] = [];
  if (payload.tipo_producto_contifico === 'PRO' && payload.formula) {
    formulaItems.push(...payload.formula);
  }
  // Items de fórmula COP — union discriminada: aplanar detalles según modo
  if (payload.tipo_producto_contifico === 'COP' && payload.tipo_formula) {
    if (payload.tipo_formula.modo === 'receta_fija') {
      formulaItems.push(...payload.tipo_formula.detalles);
    } else if (payload.tipo_formula.modo === 'opciones_variables') {
      for (const grupo of payload.tipo_formula.opciones) {
        if (grupo.detalles) formulaItems.push(...grupo.detalles);
      }
    }
  }
  for (const item of formulaItems) {
    if (item.producto_id) need.push({ entity_type: 'producto', api_id: item.producto_id });
    if (item.unidad_id) need.push({ entity_type: 'unidad', api_id: item.unidad_id });
  }

  const result: ResolvedPks = {
    categoria: null,
    unidad: null,
    cuenta_venta: null,
    cuenta_compra: null,
    cuenta_costo: null,
    formula_lookup: {},
    unidad_nombres: {},
  };

  if (need.length === 0) return result;

  // Una query por entity_type para minimizar round-trips
  const byType: Record<string, Set<string>> = {};
  for (const n of need) {
    if (!byType[n.entity_type]) byType[n.entity_type] = new Set();
    byType[n.entity_type].add(n.api_id);
  }

  const resolved = new Map<string, number>(); // key = entity_type:api_id
  for (const [entity_type, apiIdsSet] of Object.entries(byType)) {
    const apiIds = Array.from(apiIdsSet);
    const { data, error } = await supabase
      .from(PK_MAPPING_TABLE)
      .select('api_id, django_pk')
      .eq('entity_type', entity_type)
      .in('api_id', apiIds);
    if (error) {
      throw new Error(`Error consultando ${PK_MAPPING_TABLE}[${entity_type}]: ${error.message}`);
    }
    for (const row of (data ?? []) as Array<{ api_id: string; django_pk: number }>) {
      resolved.set(`${entity_type}:${row.api_id}`, row.django_pk);
    }
  }

  // Verificar que TODOS los api_ids necesarios se resolvieron
  const missing: string[] = [];
  for (const n of need) {
    const key = `${n.entity_type}:${n.api_id}`;
    const pk = resolved.get(key);
    if (pk == null) {
      missing.push(key);
    } else if (n.field) {
      result[n.field] = String(pk);
    }
  }

  // Llenar el formula_lookup con TODOS los resolved (categoría/cuentas ya están
  // en campos dedicados pero incluirlos no molesta)
  resolved.forEach(function (pk, key) {
    result.formula_lookup[key] = String(pk);
  });

  if (missing.length > 0) {
    throw new Error(
      `PK mapping faltante para: ${missing.join(', ')}. Refrescar scraper scrape-pk-mapping.yml`
    );
  }

  // ── Lookup de nombres de unidad desde contifico_raw.cat_unidades ──
  // Los inputs visibles del form (formula_N-unidad, tipo_formula_N_M-unidad)
  // toman el nombre textual ("Gramos", "Unidad"), no el pk. Los leemos en
  // una sola query para todos los api_ids de unidad que aparezcan.
  const unidadApiIds = new Set<string>();
  if (payload.unidad_id) unidadApiIds.add(payload.unidad_id);
  for (const item of formulaItems) {
    if (item.unidad_id) unidadApiIds.add(item.unidad_id);
  }
  if (unidadApiIds.size > 0) {
    const { data: uData, error: uErr } = await supabase
      .schema('contifico_raw')
      .from('cat_unidades')
      .select('id, nombre')
      .in('id', Array.from(unidadApiIds));
    if (uErr) {
      throw new Error(`Error leyendo contifico_raw.cat_unidades: ${uErr.message}`);
    }
    for (const row of (uData ?? []) as Array<{ id: string; nombre: string }>) {
      result.unidad_nombres[row.id] = row.nombre;
    }
  }

  return result;
}

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
  // ── 0. Auto-corrección de flags según reglas server-side de Contifico ──
  // Estas validaciones NO se disparan en el cliente; si violas las reglas el
  // submit falla con error genérico. Ver memoria contifico_form_inventory.md
  // sección "Reglas de servidor".
  const tipo = (payload.tipo_contifico ?? 'PRO') as 'PRO' | 'SER';
  const tipoProducto = tipo === 'PRO' ? (payload.tipo_producto_contifico ?? 'SIM') : null;

  // SER: no mandar tipo_producto, inventariable, minimo, factor*
  // COP: no mandar inventariable, minimo, factor*
  const aplicaInventariable = tipo === 'PRO' && tipoProducto !== 'COP';

  // Empezamos del payload y corregimos en memoria
  let paraVenta = payload.para_venta === true;
  let paraCompra = payload.para_compra === true;
  let inventariable = payload.inventariable === true;

  // Regla: PRO (producción) requiere inventariable=true
  if (tipoProducto === 'PRO' && aplicaInventariable && !inventariable) {
    console.log('   ⚠️  auto-corregir: tipo_producto=PRO requiere inventariable=true');
    inventariable = true;
  }
  // Regla: inventariable=true requiere para_compra=true
  if (aplicaInventariable && inventariable && !paraCompra) {
    console.log('   ⚠️  auto-corregir: inventariable=true requiere para_compra=true');
    paraCompra = true;
  }
  // Si no aplica inventariable (SER o COP) → forzar false
  if (!aplicaInventariable) {
    inventariable = false;
  }

  // ── 0.b Resolver IDs alfanuméricos → enteros Django ANTES de tocar el form
  // Si esto falla, el row se marca como error sin haber abierto el form.
  const pks = await resolveDjangoPks(payload);
  console.log(`   🔑 PKs resueltas: cat=${pks.categoria} und=${pks.unidad} cv=${pks.cuenta_venta} cc=${pks.cuenta_compra} cco=${pks.cuenta_costo}`);
  console.log(`   🏷️  tipo=${tipo} tipo_producto=${tipoProducto ?? '(n/a)'} flags: venta=${paraVenta} compra=${paraCompra} inv=${inventariable}`);

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
  await page.selectOption('select[name="tipo"]', tipo);
  if (tipo === 'PRO' && tipoProducto) {
    await page.selectOption('select[name="tipo_producto"]', tipoProducto);
  }

  // Categoría y unidad — hidden + quicksearch
  // Usamos los django_pk resueltos del mapping table, NO los api_ids del payload
  if (pks.categoria) {
    await setHiddenValue(page, 'categoria_id', pks.categoria);
  }
  if (pks.unidad && tipo === 'PRO') {
    await setHiddenValue(page, 'unidad_id', pks.unidad);
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

  await setCheckbox('para_venta', paraVenta);
  await setCheckbox('para_compra', paraCompra);
  // inventariable solo aplica en PRO no-COP. En SER/COP el checkbox no está
  // en el DOM (handlerComboTipo lo oculta), pero igual seteamos el estado.
  if (aplicaInventariable) {
    await setCheckbox('inventariable', inventariable);
  }

  // ── Cuentas (hidden + autocomplete jQuery UI) ──
  // Mapping Foodix → Django (ver memoria contifico_form_inventory.md 18.M):
  //   cuenta_ingresos_id   → Django cuenta_venta_id   (label "Ingresos")
  //   cuenta_costo_id      → Django cuenta_compra_id  (label "Costo")
  //   cuenta_inventario_id → Django cuenta_costo_id   (label "Inventario")
  // Las cuentas se setean SOLO si su flag está activo.
  if (paraVenta && pks.cuenta_venta) {
    await setHiddenValue(page, 'cuenta_venta_id', pks.cuenta_venta);
  }
  if (paraCompra && pks.cuenta_compra) {
    await setHiddenValue(page, 'cuenta_compra_id', pks.cuenta_compra);
  }
  if (aplicaInventariable && inventariable && pks.cuenta_costo) {
    await setHiddenValue(page, 'cuenta_costo_id', pks.cuenta_costo);
  }
  // Stock mínimo SOLO si aplica (no en SER ni COP)
  if (aplicaInventariable && payload.stock_minimo != null) {
    await fillIfVisible(page, 'input[name="minimo"]', String(payload.stock_minimo));
  }

  // ── Configuraciones → Sección POS ──
  // Flujo (ver memoria contifico_form_inventory.md sección "Cascada de para_pos"
  // y 18.R "POS específicos: pos_input es CSV de pks"):
  //  - para_pos=false → no tocar nada de POS
  //  - para_pos=true + pos_ids_csv vacío/null → todos_pos queda en true (default)
  //  - para_pos=true + pos_ids_csv con valores → desmarcar todos_pos e inyectar
  //    el CSV directamente en input[name="pos_input"] (es un text input con
  //    CSV de django_pk, NO un autocomplete con chips).
  const paraPos = payload.para_pos === true;
  const posCsvTrim = (payload.pos_ids_csv ?? '').trim();
  if (paraPos) {
    await setCheckbox('para_pos', true);
    if (posCsvTrim !== '') {
      // Desmarcar todos_pos para habilitar el selector específico,
      // luego inyectar el CSV en el hidden input pos_input.
      await setCheckbox('todos_pos', false);
      await page.evaluate(function (csv: string) {
        const inp = document.querySelector('input[name="pos_input"]') as HTMLInputElement | null;
        if (inp) {
          inp.value = csv;
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, posCsvTrim);
      console.log(`   🏪 POS específicos: ${posCsvTrim}`);
    } else {
      console.log('   🏪 POS: todos (todos_pos=true)');
    }
  }
  if (payload.lead_time != null) {
    await fillIfVisible(page, 'input[name="dias_plazo"]', String(payload.lead_time));
  }

  // ── Fórmulas (PRO y COP) ──
  // Contifico NO usa formsets estándar Django (no hay TOTAL_FORMS). La
  // serialización la hace GrabarProducto() en JS, que lee el DOM y arma el
  // POST por name="...". Para soportar N filas/grupos/detalles reutilizamos
  // los pre-renderizados del form y, para los adicionales, inyectamos inputs
  // hidden con el naming correcto.
  //
  // ═════════════════════════════════════════════════════════════════════════
  // NAMING EMPÍRICO (verificado con Chrome MCP navegando el form real,
  // ver memoria contifico_form_inventory.md — sección "Convención Django
  // del formset", abril 2026). La doc anterior del Lote 3 tenía los índices
  // y el sufijo iddetalle mal; esta sección refleja la verdad del DOM real.
  // ═════════════════════════════════════════════════════════════════════════
  //
  // PRO — fórmula plana:
  //   formula_1-*  ← PRE-RENDERIZADO al cambiar tipo_producto a PRO
  //   formula_2-*  ← click "Agregar Detalle" (a.btn_agregarFormula)
  //   formula_3-*, ...
  //   N empieza en 1, incremental, SIN sufijo iddetalle.
  //
  // COP — grupos × detalles:
  //   tipo_formula_1-nombre="FORMULA"  ← PRE-LLENADO con default
  //   tipo_formula_1-seleccion="NE"    ← PRE-LLENADO con default (NE es válido)
  //   tipo_formula_1_iddetalle-*       ← PRIMER detalle del grupo 1 (sufijo LITERAL "iddetalle")
  //   tipo_formula_1_1-*               ← segundo detalle del grupo 1
  //   tipo_formula_1_2-*               ← tercer detalle del grupo 1
  //
  //   tipo_formula_2-nombre/seleccion  ← grupo #2 al click "Agregar Opción Variable"
  //   tipo_formula_2_iddetalle-*       ← primer detalle del grupo 2 (también con "iddetalle")
  //   tipo_formula_2_1-*               ← segundo detalle del grupo 2
  //
  // Modo receta_fija (HAMB001): un solo grupo, dejar FORMULA/NE como default.
  // Modo opciones_variables (COMB001): overwrite nombre y seleccion del grupo 1
  // con el nombre real y UN/VA. NE solo es válido en el modo receta_fija.
  //
  // Helper que inyecta/actualiza un input hidden en el form productoForm.
  // Si ya existe input con ese name (caso pre-renderizado), actualiza value.
  // Si no existe, crea un <input type="hidden"> nuevo appendido al form.
  async function injectHidden(name: string, value: string): Promise<void> {
    await page.evaluate(function (args: { n: string; v: string }) {
      const form = document.querySelector('form[name="productoForm"]') as HTMLFormElement | null;
      if (!form) return;
      const el = form.querySelector('[name="' + args.n + '"]') as HTMLInputElement | HTMLSelectElement | null;
      if (el) {
        if (el instanceof HTMLSelectElement) {
          // Si el select no tiene la opción deseada, crearla antes de seleccionar
          let found = false;
          for (let i = 0; i < el.options.length; i++) {
            if (el.options[i].value === args.v) { found = true; break; }
          }
          if (!found) {
            const opt = document.createElement('option');
            opt.value = args.v;
            opt.text = args.v;
            opt.selected = true;
            el.appendChild(opt);
          }
          el.value = args.v;
        } else {
          (el as HTMLInputElement).value = args.v;
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        const inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = args.n;
        inp.value = args.v;
        form.appendChild(inp);
      }
    }, { n: name, v: value });
  }

  // Helper: llena los 4 inputs de una fila de fórmula/detalle con el prefix
  // dado. Resuelve unidad (nombre textual primero, fallback a pk).
  async function fillRow(prefix: string, item: { producto_id: string; cantidad: number; unidad_id?: string | null }, fallbackUnidadApi?: string | null): Promise<void> {
    const productoPk = item.producto_id ? pks.formula_lookup['producto:' + item.producto_id] : null;
    if (!productoPk) {
      throw new Error(`${prefix}.producto_id no resuelto: ${item.producto_id}`);
    }
    const unidadApi = item.unidad_id ?? fallbackUnidadApi ?? null;
    const unidadPk = unidadApi ? (pks.formula_lookup['unidad:' + unidadApi] ?? null) : pks.unidad;
    const unidadNombre = unidadApi ? (pks.unidad_nombres[unidadApi] ?? '') : '';
    await injectHidden(`${prefix}-producto_detalle_id`, productoPk);
    await injectHidden(`${prefix}-cantidad`, String(item.cantidad));
    // Los inputs de unidad del form leen nombre textual ("Gramos", "Unidad").
    // hidden_unidad es el espejo sincronizado con el campo visible.
    if (unidadNombre) {
      await injectHidden(`${prefix}-unidad`, unidadNombre);
      await injectHidden(`${prefix}-hidden_unidad`, unidadNombre);
    } else if (unidadPk) {
      // Fallback: si no hay nombre, mandamos el pk en ambos
      await injectHidden(`${prefix}-unidad`, unidadPk);
      await injectHidden(`${prefix}-hidden_unidad`, unidadPk);
    }
    console.log(`      • ${prefix}: producto=${productoPk} cant=${item.cantidad} unidad=${unidadNombre || unidadPk || '(vacío)'}`);
  }

  // ── PRO — fórmula plana 1-indexed ──
  // formula_1 es la fila pre-renderizada al cambiar tipo_producto a PRO.
  // Para N > 1, inyectamos formula_2, formula_3, ... como inputs hidden.
  if (tipoProducto === 'PRO' && payload.formula && payload.formula.length > 0) {
    console.log(`   🧪 PRO: ${payload.formula.length} ingredientes (formula_1..${payload.formula.length})`);
    for (let i = 0; i < payload.formula.length; i++) {
      const item = payload.formula[i];
      const n = i + 1;  // 1-indexed
      await fillRow(`formula_${n}`, item, payload.unidad_id);
    }
  }

  // ── COP — dos modos con naming 1-indexed + sufijo literal "iddetalle" ──
  if (tipoProducto === 'COP' && payload.tipo_formula) {
    const tf = payload.tipo_formula;

    if (tf.modo === 'receta_fija') {
      // HAMB001: un solo grupo, nombre/seleccion quedan en default (FORMULA/NE).
      // No tocamos tipo_formula_1-nombre ni tipo_formula_1-seleccion.
      console.log(`   🧪 COP receta_fija: ${tf.detalles.length} detalles en grupo 1 (FORMULA/NE default)`);
      for (let m = 0; m < tf.detalles.length; m++) {
        const det = tf.detalles[m];
        // Primer detalle usa sufijo literal "iddetalle"; siguientes usan m=1,2,...
        const detSuffix = m === 0 ? 'iddetalle' : String(m);
        await fillRow(`tipo_formula_1_${detSuffix}`, det, payload.unidad_id);
      }
    } else if (tf.modo === 'opciones_variables') {
      // COMB001: múltiples grupos. El grupo 1 reutiliza tipo_formula_1 pero
      // OVERWRITE nombre y seleccion (el default FORMULA/NE no aplica aquí —
      // NE solo es válido en receta_fija).
      console.log(`   🧪 COP opciones_variables: ${tf.opciones.length} grupos`);
      for (let k = 0; k < tf.opciones.length; k++) {
        const grupo = tf.opciones[k];
        const n = k + 1;  // grupos 1-indexed
        // Overwrite nombre y seleccion del grupo (el grupo 1 reemplaza los defaults).
        await injectHidden(`tipo_formula_${n}-nombre`, grupo.nombre);
        await injectHidden(`tipo_formula_${n}-seleccion`, grupo.seleccion);
        console.log(`      ▸ grupo ${n} "${grupo.nombre}" (${grupo.seleccion}) — ${grupo.detalles.length} detalles`);
        for (let m = 0; m < grupo.detalles.length; m++) {
          const det = grupo.detalles[m];
          // Primer detalle usa sufijo literal "iddetalle"; siguientes m=1,2,...
          const detSuffix = m === 0 ? 'iddetalle' : String(m);
          await fillRow(`tipo_formula_${n}_${detSuffix}`, det, payload.unidad_id);
        }
      }
    }
  }

  // ── Defaults defensivos para campos integer hidden ──
  // Contifico mantiene en el HTML campos como dias_plazo, costo_maximo,
  // porcentaje_ice, etc. aunque la sección "Inventariable" esté apagada.
  // Django los valida en POST como IntegerField y rechaza valores vacíos
  // con "Introduzca un número entero". Set defaults seguros ANTES del submit.
  // CRÍTICO: este bloque DEBE ir antes del submit. Si va después,
  // GrabarProducto() ya disparó la navegación y page.evaluate crashea con
  // "Execution context destroyed". Bug histórico al implementar PRO/COP.
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
  // En caso de timeout, capturamos el estado del form para diagnóstico (DESPUÉS
  // del timeout, no antes — antes el DOM puede estar en transición).
  // IMPORTANTE: dentro de page.evaluate NO usar arrow functions ni helpers
  // nombrados — tsx/esbuild las compila con __name() helper que no existe
  // en el browser context (UtilityScript). Usar function() declarations o
  // inline puro. Por eso este bloque está escrito tan plano.
  try {
    await page.waitForURL((url) => !url.toString().includes('/registrar2/'), {
      timeout: 30000,
    });
  } catch (err) {
    // El wait timeoutea → form se quedó en /registrar2/. Capturar estado
    // FINAL del form para diagnosticar (página ya settled).
    await page.waitForTimeout(500);
    const diag = await page.evaluate(function () {
      const errors: string[] = [];
      const errSel = '.alert-danger, .errorlist li, .has-error label, .field-error, span.error, .text-danger, .errornote, .ui-state-error, .toast-error, .notify-error';
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
      // Body text fragment para capturar errores que no usen los selectores conocidos
      const bodyText = (document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim();
      const bodySnippet = bodyText.length > 600 ? bodyText.substring(0, 600) : bodyText;
      return {
        url: window.location.href,
        errors: errors.slice(0, 15),
        required_fields_state: required,
        body_snippet: bodySnippet,
      };
    }).catch(function (e) { return { error: e instanceof Error ? e.message : 'evaluate failed' }; });
    console.log('🔍 POST-TIMEOUT DIAG:', JSON.stringify(diag));
    const shortMsg = err instanceof Error ? err.message.split('\n')[0] : 'waitForURL error';
    throw new Error(shortMsg + ' | diag=' + JSON.stringify(diag).slice(0, 1500));
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
  //
  // Env var opcional ONLY_PRODUCTO_ID: si está seteada, filtra la cola a ese
  // producto_id puntual. Útil para tests E2E aislados (headed local) sin
  // procesar otros rows pending de la cola.
  const onlyProductoId = process.env.ONLY_PRODUCTO_ID?.trim() || null;
  if (onlyProductoId) {
    console.log(`🎯 ONLY_PRODUCTO_ID=${onlyProductoId} (filtro aislado activo)`);
  }
  const nowIso = new Date().toISOString();
  let queueQuery = supabase
    .from(QUEUE_TABLE)
    .select('id, producto_id, codigo, action, payload, status, attempts, max_attempts, contifico_id')
    .eq('status', 'pending')
    .eq('action', 'create')
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(50);
  if (onlyProductoId) {
    queueQuery = queueQuery.eq('producto_id', onlyProductoId);
  }
  const { data: queue, error: qErr } = await queueQuery;

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

  try {
    // HEADLESS=false permite correr headed local para debugging visual del
    // form Contifico. En GitHub Actions (default) corre headless.
    const runHeadless = process.env.HEADLESS !== 'false';
    if (!runHeadless) {
      console.log('👁️  HEADLESS=false → corriendo headed (debug visual)');
    }
    browser = await chromium.launch({
      headless: runHeadless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    await loginContifico(page);

    for (const row of procesables) {
      const payload = row.payload;
      // SIM, PRO, COP y SER soportados. Las fórmulas (PRO ilimitada, COP en
      // modo receta_fija o opciones_variables), las cuentas contables con
      // mapping Foodix→Django, los POS específicos vía CSV y la auto-corrección
      // de flags según reglas server de Contifico se manejan dentro de
      // llenarFormProducto.

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

        // Extraer contifico_id del URL de redirect post-submit.
        // Después de GrabarProducto(), Contifico redirige a
        // /sistema/inventario/producto/consultar/NNNNNN/ donde NNNNNN es el
        // django_pk del producto recién creado. Lo guardamos para trazabilidad.
        let contificoId: string | null = null;
        const currentUrl = page.url();
        const idMatch = currentUrl.match(/\/producto\/consultar\/(\d+)\//);
        if (idMatch) {
          contificoId = idMatch[1];
          console.log(`✅ [${row.codigo}] creado OK, contifico_id=${contificoId}`);
        } else {
          console.log(`✅ [${row.codigo}] creado OK (sin id en URL: ${currentUrl.slice(-60)})`);
        }

        await supabase
          .from(QUEUE_TABLE)
          .update({
            status: 'success',
            completed_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            error_message: null,
            next_retry_at: null,
            contifico_id: contificoId,
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
  console.log(`════════════════════════════════════════\n`);
}

main().catch((e) => {
  console.error('❌ fatal:', e);
  process.exit(1);
});
