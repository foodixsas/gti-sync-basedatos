#!/usr/bin/env tsx
/**
 * Robot diario de fórmulas con grupos (Contífico web → contifico_web.formula_linea).
 *
 * La API REST no expone la fórmula y el export Excel la aplana. La única fuente con
 * los grupos es el HTML de /sistema/inventario/producto/consultar/{pk}/:
 *   NE = No Elegible (fijo)   UN = Sólo Uno   VA = Varios o Ninguno
 * Este robot solo LEE y guarda. La regla de costeo va aparte.
 *
 * Sin navegador: login web en 3 pasos por HTTP (cuenta sin 2FA), igual que el portal.
 *   1. GET/POST /sistema/accounts/login/
 *   2. POST /sistema/accounts/login/empresa/ (empresa 19875)
 * El pk web NO es el id de la API: se resuelve por el buscador de productos y se
 * confirma con el JSON del producto (codigo + id_integracion). Se cachea.
 *
 * Uso:  npx tsx src/scripts/scrape-formulas.ts [CODIGO ...]   (sin códigos = todos los activos COP/PRO)
 * Env:  CONTIFICO_EMAIL, CONTIFICO_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://1793168604001.contifico.com';
const EMPRESA = '19875';
const PAUSA_MS = 200;
const LOTE = 50;
const TOPE_ERRORES = 0.1;

const log = (ev: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));
const dormir = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const normCod = (s: unknown) => String(s ?? '').trim().toUpperCase();
const desHtml = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

// ─── Sesión web ──────────────────────────────────────────────────────────────
const jar = new Map<string, string>();
async function web(ruta: string, init: RequestInit & { headers?: Record<string, string> } = {}, intentos = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(BASE + ruta, {
        redirect: 'manual', ...init,
        headers: {
          'User-Agent': 'Mozilla/5.0', Referer: `${BASE}/sistema/accounts/login/`,
          Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
          'X-CSRFToken': jar.get('csrftoken') ?? '', ...(init.headers ?? {}),
        },
      });
      for (const c of res.headers.getSetCookie()) {
        const kv = c.split(';')[0]; const j = kv.indexOf('=');
        jar.set(kv.slice(0, j), kv.slice(j + 1));
      }
      // Un 302 a login = la sesión se cayó; no tiene sentido seguir.
      const destino = res.headers.get('location') ?? '';
      if (res.status >= 300 && res.status < 400 && /accounts\/login/.test(destino)) {
        throw new Error(`Sesión web de Contífico caída (redirige a ${destino} en ${ruta})`);
      }
      if (res.status >= 500 && i < intentos) { await dormir(1500 * i); continue; }
      return res;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Sesión web')) throw e;
      if (i >= intentos) throw e;
      log('formulas.reintento', { ruta, intento: i, error: e instanceof Error ? e.message : String(e) });
      await dormir(1500 * i);
    }
  }
}

async function login(email: string, password: string) {
  const AJAX = { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' };
  await web('/sistema/accounts/login/');
  const r1 = await web('/sistema/accounts/login/', { method: 'POST', headers: AJAX,
    body: new URLSearchParams({ username: email, password, codigo_otp: '', csrfmiddlewaretoken: jar.get('csrftoken') ?? '' }) });
  const t1 = await r1.text();
  if (!r1.ok || /user_has_2fa"\s*:\s*true/.test(t1)) throw new Error(`Login Contífico falló (HTTP ${r1.status}): ${t1.slice(0, 200)}`);
  const r2 = await web('/sistema/accounts/login/empresa/', { method: 'POST', headers: AJAX,
    body: new URLSearchParams({ empresa: EMPRESA, next: '', contificoUno: 'false', csrfmiddlewaretoken: jar.get('csrftoken') ?? '' }) });
  const t2 = await r2.text();
  if (!r2.ok || !/url_redirect/.test(t2)) throw new Error(`Selección de empresa falló (HTTP ${r2.status}): ${t2.slice(0, 200)}`);
}

type ProductoJson = { id: number; codigo: string; nombre: string; tipo_producto: string; costo: number | null; id_integracion: string | null };
async function productoJson(pk: number): Promise<ProductoJson | null> {
  const res = await web(`/sistema/inventario/producto/${pk}/?format=json`, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const o = (JSON.parse(await res.text()) as { obj?: ProductoJson }).obj;
  return o ?? null;
}

/** Busca el pk web por código y lo confirma con el JSON (el buscador filtra por texto, no exacto). */
async function resolverPk(codigo: string, idApi: string): Promise<ProductoJson | null> {
  const res = await web(`/sistema/inventario/producto/seleccionar/?filtro=${encodeURIComponent(codigo)}`);
  const html = await res.text();
  const candidatos = [...new Set([...html.matchAll(/selectObj\((\d+)\)/g)].map(m => Number(m[1])))].slice(0, 15);
  let porCodigo: ProductoJson | null = null;
  for (const pk of candidatos) {
    await dormir(PAUSA_MS);
    const o = await productoJson(pk);
    if (!o || normCod(o.codigo) !== codigo) continue;
    if (o.id_integracion === idApi) return o;  // coincidencia exacta con la API
    porCodigo ??= o;
  }
  return porCodigo;
}

// ─── Parser de la fórmula ────────────────────────────────────────────────────
type Linea = { grupo_orden: number; linea_orden: number; ingrediente_pk: number; cantidad: string; unidad: string };
type Grupo = { orden: number; nombre: string | null; tipo: 'NE' | 'UN' | 'VA' };

const atributos = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

export function parsearFormula(html: string): { grupos: Grupo[]; lineas: Linea[] } {
  const grupos = new Map<number, Grupo>();
  for (const m of html.matchAll(/<select[^>]*name="tipo_formula_(\d+)-seleccion"[^>]*>([\s\S]*?)<\/select>/g)) {
    const tipo = (m[2].match(/<option value="(NE|UN|VA)"\s+selected/)?.[1] ?? 'NE') as Grupo['tipo'];
    grupos.set(Number(m[1]), { orden: Number(m[1]), nombre: null, tipo });
  }
  const campos = new Map<string, Partial<Record<'pk' | 'cantidad' | 'unidad', string>>>();
  for (const tag of html.match(/<(?:input|select)[^>]*name="(?:tipo_formula|formula)[^"]*"[^>]*>/g) ?? []) {
    const a = atributos(tag); const n = a.name ?? '';
    if (n.includes('template') || n.includes('iddetalle')) continue;
    const g = n.match(/^tipo_formula_(\d+)-nombre$/);
    if (g) { const x = grupos.get(Number(g[1])); if (x) x.nombre = desHtml(a.value ?? ''); continue; }
    // Grupo fijo 0 ("FORMULA") viene como formula_{i}-…; los demás como tipo_formula_{g}_{i}-…
    const l = n.match(/^formula_(\d+)-(producto_detalle_id|cantidad|hidden_unidad)$/)
      ?? n.match(/^tipo_formula_(\d+_\d+)-(producto_detalle_id|cantidad|hidden_unidad)$/);
    if (!l) continue;
    const clave = l[1].includes('_') ? l[1] : `0_${l[1]}`;
    const campo = l[2] === 'producto_detalle_id' ? 'pk' : l[2] === 'cantidad' ? 'cantidad' : 'unidad';
    const cur = campos.get(clave) ?? {}; cur[campo] = a.value ?? ''; campos.set(clave, cur);
  }
  const lineas: Linea[] = [];
  for (const [clave, c] of campos) {
    const [g, i] = clave.split('_').map(Number);
    if (!c.pk || !/^\d+$/.test(c.pk)) continue;
    lineas.push({ grupo_orden: g, linea_orden: i, ingrediente_pk: Number(c.pk), cantidad: c.cantidad ?? '', unidad: c.unidad ?? '' });
  }
  if (lineas.some(l => l.grupo_orden === 0) && !grupos.has(0)) grupos.set(0, { orden: 0, nombre: 'FORMULA', tipo: 'NE' });
  return { grupos: [...grupos.values()], lineas: lineas.sort((a, b) => a.grupo_orden - b.grupo_orden || a.linea_orden - b.linea_orden) };
}

// ─── Principal ───────────────────────────────────────────────────────────────
async function main() {
  const { CONTIFICO_EMAIL, CONTIFICO_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!CONTIFICO_EMAIL || !CONTIFICO_PASSWORD) throw new Error('Faltan CONTIFICO_EMAIL/CONTIFICO_PASSWORD');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const runId = randomUUID(); const t0 = Date.now();
  await sb.rpc('fn_web_formula_run', { p_run_id: runId, p_terminado: false, p_ok: 0, p_error: 0, p_lineas: 0, p_detalle: {} });

  const soloCodigos = process.argv.slice(2).map(normCod).filter(Boolean);
  let q = sb.schema('contifico_raw').from('cat_productos').select('id,codigo,nombre,tipo_producto')
    .eq('estado', 'A').in('tipo_producto', ['COP', 'PRO']);
  if (soloCodigos.length) q = q.in('codigo', soloCodigos);
  const { data: productos, error: errProd } = await q;
  if (errProd) throw new Error(`cat_productos: ${errProd.message}`);
  if (!productos?.length) throw new Error('No hay productos activos COP/PRO que leer');

  const { data: cache, error: errCache } = await sb.rpc('fn_web_formula_pks');
  if (errCache) throw new Error(`fn_web_formula_pks: ${errCache.message}`);
  const pkPorCodigo = new Map<string, number>((cache as { codigo: string; pk_web: number }[]).map(r => [normCod(r.codigo), Number(r.pk_web)]));
  const codigoPorPk = new Map<number, { codigo: string; nombre: string }>(
    (cache as { codigo: string; pk_web: number; nombre: string }[]).map(r => [Number(r.pk_web), { codigo: r.codigo, nombre: r.nombre }]));

  await login(CONTIFICO_EMAIL, CONTIFICO_PASSWORD);
  log('formulas.inicio', { run_id: runId, productos: productos.length, pks_en_cache: pkPorCodigo.size });

  const errores: { codigo: string; motivo: string }[] = [];
  let ok = 0, sinFormula = 0, lineasTot = 0, pksNuevos = 0;
  const conteoTipos: Record<string, number> = { NE: 0, UN: 0, VA: 0 };
  let pendPks: Record<string, unknown>[] = []; let pendProd: string[] = []; let pendLineas: Record<string, unknown>[] = [];

  const guardar = async () => {
    if (!pendProd.length && !pendPks.length) return;
    const { data, error } = await sb.rpc('fn_web_formula_commit', { p_run_id: runId, p_pks: pendPks, p_productos: pendProd, p_lineas: pendLineas });
    if (error) throw new Error(`fn_web_formula_commit: ${error.message}`);
    lineasTot += (data as { lineas: number }).lineas;
    log('formulas.lote', { run_id: runId, ok, errores: errores.length, lineas: lineasTot, pks_nuevos: pksNuevos, dur_s: Math.round((Date.now() - t0) / 1000) });
    pendPks = []; pendProd = []; pendLineas = [];
  };
  const registrarPk = (o: ProductoJson) => {
    pendPks.push({ codigo: normCod(o.codigo), pk_web: o.id, id_integracion: o.id_integracion, nombre: o.nombre, tipo_producto: o.tipo_producto, costo: o.costo });
    pkPorCodigo.set(normCod(o.codigo), o.id); codigoPorPk.set(o.id, { codigo: normCod(o.codigo), nombre: o.nombre });
    pksNuevos++;
  };

  for (const p of productos) {
    const codigo = normCod(p.codigo);
    try {
      let pk = pkPorCodigo.get(codigo);
      if (!pk) {
        const o = await resolverPk(codigo, p.id);
        if (!o) { errores.push({ codigo, motivo: 'pk web no encontrado' }); continue; }
        registrarPk(o); pk = o.id;
      }
      await dormir(PAUSA_MS);
      const res = await web(`/sistema/inventario/producto/consultar/${pk}/`);
      if (!res.ok) { errores.push({ codigo, motivo: `HTTP ${res.status}` }); continue; }
      const html = await res.text();
      if (!html.includes('contenedor_tipo_formula') && !html.includes('formulaProduccion')) {
        errores.push({ codigo, motivo: 'la página no trae la sección de fórmula' }); continue;
      }
      const { grupos, lineas } = parsearFormula(html);
      if (!lineas.length) sinFormula++;
      for (const l of lineas) {
        if (!codigoPorPk.has(l.ingrediente_pk)) {
          await dormir(PAUSA_MS);
          const o = await productoJson(l.ingrediente_pk);
          if (o) registrarPk(o);
        }
        const ing = codigoPorPk.get(l.ingrediente_pk);
        const g = grupos.find(x => x.orden === l.grupo_orden) ?? { nombre: null, tipo: 'NE' as const };
        conteoTipos[g.tipo]++;
        pendLineas.push({
          producto_codigo: codigo, producto_pk: pk, grupo_orden: l.grupo_orden, grupo_nombre: g.nombre, grupo_tipo: g.tipo,
          linea_orden: l.linea_orden, ingrediente_pk: l.ingrediente_pk, ingrediente_codigo: ing?.codigo ?? null,
          ingrediente_nombre: ing?.nombre ?? null, cantidad: l.cantidad, unidad: l.unidad,
        });
      }
      pendProd.push(codigo); ok++;
      if (pendProd.length >= LOTE) await guardar();
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Sesión web')) throw e;
      errores.push({ codigo, motivo: e instanceof Error ? e.message.slice(0, 200) : String(e) });
    }
  }
  await guardar();

  const detalle = { productos: productos.length, ok, sin_formula: sinFormula, pks_nuevos: pksNuevos, lineas_por_tipo: conteoTipos,
    errores: errores.slice(0, 50), dur_s: Math.round((Date.now() - t0) / 1000) };
  await sb.rpc('fn_web_formula_run', { p_run_id: runId, p_terminado: true, p_ok: ok, p_error: errores.length, p_lineas: lineasTot, p_detalle: detalle });
  log('formulas.fin', { run_id: runId, lineas: lineasTot, ...detalle });
  if (errores.length / productos.length > TOPE_ERRORES) {
    throw new Error(`${errores.length} de ${productos.length} productos fallaron (tope ${TOPE_ERRORES * 100}%)`);
  }
}

if (process.argv[1]?.endsWith('scrape-formulas.ts')) {
  main().catch(e => {
    log('formulas.error', e instanceof Error ? { message: e.message, stack: e.stack } : { message: String(e) });
    process.exitCode = 1;
  });
}
