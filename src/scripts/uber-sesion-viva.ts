#!/usr/bin/env tsx
/**
 * Mantiene viva la sesión de Uber y avisa por WhatsApp cuando algo se rompe.
 *
 * POR QUÉ EXISTE (incidente del 26 al 28-sep-2026)
 * La carga de Uber estuvo tres días muerta y nadie se enteró. Se descubrió porque
 * Daniel pidió un reporte y los datos se cortaban en el 23 de septiembre.
 *
 * La causa de fondo no fue "la sesión venció": fue que NO HABÍA HOLGURA. La cookie
 * `jwt-session` dura 24 horas justas y la carga corría una vez al día. Bastaba que
 * una corrida fallara para que la sesión muriera antes de la siguiente, y entonces
 * ya no había forma de recuperarla sola.
 *
 * QUÉ HACE ESTE GUARDIÁN
 *   1. Toca el portal cada pocas horas y guarda la sesión renovada → holgura real.
 *   2. Comprueba que la sesión SIRVE (una llamada de verdad), no que "responde".
 *   3. Si no sirve, vuelve a entrar solo con usuario y clave.
 *   4. Mira hasta qué día llegaron los pedidos, que es lo único que importa.
 *   5. Si no pudo arreglarlo, avisa por WhatsApp el mismo día.
 *
 * Sale con código 0 aunque avise: el aviso ES el resultado. Solo falla si no pudo
 * ni avisar.
 */
import { createClient } from '@supabase/supabase-js';
import { request as pwRequest, type APIRequestContext } from 'playwright';
import { cargarSesion, guardarSesion, horasDeVida, COOKIE_VITAL, type StorageState } from '../lib/uber-session.js';

const BASE = 'https://merchants.ubereats.com/manager';
const REZAGO_NORMAL_DIAS = 2;   // Uber publica con dos días de atraso, eso es normal
const ATRASO_QUE_PREOCUPA = 4;  // a partir de acá ya se perdió al menos una corrida
const VIDA_MINIMA_HORAS = 6;    // menos que esto y la próxima corrida no llega viva

const log = (ev: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));

const Q_JOBS = 'query GetReportJobs($limit: Int) {\n  reportJobs(limit: $limit) {\n    reportJobs {\n      jobUUID\n      jobStatus\n    }\n  }\n}\n';

/** La única prueba que vale: pedirle datos a Uber y ver si contesta datos. */
async function sesionSirve(api: APIRequestContext): Promise<{ sirve: boolean; detalle: string }> {
  try {
    const res = await api.post(`${BASE}/graphql?op=GetReportJobs`, {
      data: { operationName: 'GetReportJobs', variables: { limit: 1 }, query: Q_JOBS },
      timeout: 60_000,
    });
    const texto = await res.text();
    if (res.status() === 401 || res.status() === 403 || /\/login|auth\.uber\.com/i.test(texto)) {
      return { sirve: false, detalle: `Uber respondió ${res.status()} y pidió volver a entrar` };
    }
    if (!res.ok()) return { sirve: false, detalle: `Uber respondió ${res.status()}` };
    const json = JSON.parse(texto) as { data?: { reportJobs?: { reportJobs?: unknown[] } } };
    const hay = Array.isArray(json.data?.reportJobs?.reportJobs);
    return hay ? { sirve: true, detalle: 'Uber devolvió la lista de informes' }
               : { sirve: false, detalle: 'Uber contestó pero sin datos de informes' };
  } catch (e) {
    return { sirve: false, detalle: e instanceof Error ? e.message : String(e) };
  }
}

async function abrir(state: StorageState): Promise<APIRequestContext> {
  return pwRequest.newContext({
    storageState: state as Parameters<typeof pwRequest.newContext>[0] extends infer O
      ? (O extends { storageState?: infer S } ? S : never) : never,
    extraHTTPHeaders: { 'x-csrf-token': 'x', 'content-type': 'application/json' },
  });
}

/**
 * Vuelve a entrar con usuario y clave. Solo si hay credenciales configuradas.
 * Puede fallar si Uber pide verificación extra desde una dirección nueva: para eso
 * está el aviso, que es la red de seguridad de verdad.
 */
async function volverAEntrar(): Promise<StorageState | null> {
  const email = process.env.UBEREATS_EMAIL;
  const password = process.env.UBEREATS_PASSWORD;
  const pin = process.env.UBEREATS_PIN;
  if (!email || !password) { log('uber.guardian.sin_credenciales', {}); return null; }

  const { chromium } = await import('playwright');
  const navegador = await chromium.launch({ headless: true });
  try {
    const ctx = await navegador.newContext({ locale: 'es-419' });
    const pagina = await ctx.newPage();
    await pagina.goto(`${BASE}/reports`, { waitUntil: 'domcontentloaded', timeout: 90_000 });

    const escribir = async (selector: string, valor: string) => {
      await pagina.waitForSelector(selector, { timeout: 30_000 });
      await pagina.fill(selector, valor);
      await pagina.keyboard.press('Enter');
      await pagina.waitForTimeout(3_000);
    };

    if (/auth\.uber\.com|login/i.test(pagina.url())) {
      await escribir('input[name="email"], input#PHONE_NUMBER_or_EMAIL_ADDRESS', email);
      await escribir('input[type="password"], input#PASSWORD', password).catch(() => {});
      if (pin) {
        // El PIN llega dígito por dígito en campos separados.
        const campos = pagina.locator('input[autocomplete="one-time-code"], input[name^="PIN"]');
        const n = await campos.count().catch(() => 0);
        if (n > 1) { for (let i = 0; i < Math.min(n, pin.length); i++) await campos.nth(i).fill(pin[i]); }
        else if (n === 1) { await campos.first().fill(pin); }
        await pagina.keyboard.press('Enter');
        await pagina.waitForTimeout(8_000);
      }
    }

    await pagina.goto(`${BASE}/reports`, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
    const state = await ctx.storageState() as StorageState;
    const tieneVital = (state.cookies ?? []).some(c => c.name === COOKIE_VITAL);
    log('uber.guardian.login', { cookies: state.cookies?.length ?? 0, tiene_cookie_vital: tieneVital });
    return tieneVital ? state : null;
  } catch (e) {
    log('uber.guardian.login_falló', { message: e instanceof Error ? e.message : String(e) });
    return null;
  } finally {
    await navegador.close();
  }
}

/** Hasta qué día llegaron los pedidos. Es la medida de salida, no del pulso. */
async function atrasoDeDatos(): Promise<{ ultimo: string | null; diasAtras: number | null }> {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ultimo: null, diasAtras: null };
  const db = createClient(url, key, { db: { schema: 'ubereats_raw' } });
  const { data, error } = await db
    .from('uber_pedidos').select('order_date_local')
    .order('order_date_local', { ascending: false }).limit(1);
  if (error || !data?.length) { log('uber.guardian.atraso_no_medido', { error: error?.message }); return { ultimo: null, diasAtras: null }; }
  const ultimo = (data[0] as { order_date_local: string }).order_date_local;
  const [y, m, d] = ultimo.split('-').map(Number);           // nunca new Date("YYYY-MM-DD")
  const dias = Math.round((Date.now() - new Date(y, m - 1, d).getTime()) / 86_400_000);
  return { ultimo, diasAtras: dias };
}

async function avisar(texto: string): Promise<boolean> {
  const url = process.env.WHATSAPP_BOT_URL, llave = process.env.WHATSAPP_BOT_API_KEY;
  const grupo = process.env.ALERTAS_GRUPO_JID;
  if (!url || !llave || !grupo) { log('uber.guardian.aviso_sin_config', {}); return false; }
  try {
    const r = await fetch(`${url}/api/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${llave}`, 'content-type': 'application/json' },
      body: JSON.stringify({ groupId: grupo, to: grupo, message: texto, tipo: 'grupo' }),
    });
    log('uber.guardian.aviso', { status: r.status, ok: r.ok });
    return r.ok;
  } catch (e) {
    log('uber.guardian.aviso_falló', { message: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

async function main() {
  const t0 = Date.now();
  let { state } = await cargarSesion();
  let api = await abrir(state);
  let prueba = await sesionSirve(api);
  let reentro = false;

  if (!prueba.sirve) {
    log('uber.guardian.sesion_caida', { detalle: prueba.detalle });
    await api.dispose();
    const nueva = await volverAEntrar();
    if (nueva) {
      state = nueva; api = await abrir(state); prueba = await sesionSirve(api); reentro = prueba.sirve;
      if (reentro) await guardarSesion(state, 'login_automatico');
    } else {
      api = await abrir(state);
    }
  }

  if (prueba.sirve) {
    // Tocar el portal es lo que renueva jwt-session. Guardarla es lo que da holgura.
    await api.get(`${BASE}/reports`, { timeout: 60_000 }).catch(() => null);
    const renovada = await api.storageState() as StorageState;
    await guardarSesion(renovada, reentro ? 'login_automatico' : 'corrida_renovada');
    state = renovada;
  }
  await api.dispose();

  const vida = horasDeVida(state);
  const { ultimo, diasAtras } = await atrasoDeDatos();

  // Latido en TODA ejecución, aunque no pase nada: sin esto es imposible distinguir
  // "no disparó nunca" de "disparó y estaba todo bien".
  log('uber.guardian.latido', {
    sesion_sirve: prueba.sirve, detalle: prueba.detalle, reentro_automatico: reentro,
    horas_de_vida: vida === null ? null : Math.round(vida * 10) / 10,
    ultimo_pedido: ultimo, dias_de_atraso: diasAtras, dur_ms: Date.now() - t0,
  });

  const problemas: string[] = [];
  if (!prueba.sirve) problemas.push(`• La conexión con Uber está caída y no logré entrar solo.\n  _${prueba.detalle}_`);
  else if (vida !== null && vida < VIDA_MINIMA_HORAS) problemas.push(`• La llave de acceso caduca en ${vida.toFixed(1)} horas y no se está renovando.`);
  if (diasAtras !== null && diasAtras > ATRASO_QUE_PREOCUPA) {
    problemas.push(`• Los pedidos llegan solo hasta el *${ultimo}*, van ${diasAtras} días de atraso (lo normal son ${REZAGO_NORMAL_DIAS}).`);
  }

  if (!problemas.length) { log('uber.guardian.todo_bien', { ultimo_pedido: ultimo }); return; }

  const mensaje = [
    '🔌 *Uber dejó de sincronizar*', '',
    ...problemas, '',
    reentro ? '_Entré de nuevo automáticamente, pero conviene revisar._'
            : '_Hace falta volver a entrar a Uber Eats Manager a mano._',
    '', '👉 *Siguiente paso*',
    'Avísale a Claude en el chat para que lo reconecte.',
  ].join('\n');

  const enviado = await avisar(mensaje);
  if (!enviado) { log('uber.guardian.aviso_no_salio', { problemas: problemas.length }); process.exitCode = 1; }
}

main().catch(error => {
  log('uber.guardian.error', { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
