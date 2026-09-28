/**
 * La sesión de Uber Eats Manager: de dónde sale y dónde se guarda.
 *
 * El problema que resuelve (28-sep-2026): la sesión vivía sólo en el secreto
 * UBER_STORAGE_STATE, que se escribe a mano desde el Mac. Cada corrida visitaba el
 * portal, Uber devolvía una cookie jwt-session fresca... y al terminar el proceso la
 * tiraba a la basura. A los diez días la del secreto venció, la carga murió con
 * HTTP 401 y estuvo tres días caída sin que nadie se enterara.
 *
 * La idea es simple: guardar el estado renovado al final de cada corrida que salió
 * bien. Mientras el pipeline corra a diario, la sesión no vence nunca.
 *
 * Orden de preferencia al abrir: lo guardado en Supabase (es lo más nuevo), después
 * el secreto, después el archivo local. El secreto queda como red de rescate para
 * arrancar de cero.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export type StorageState = { cookies?: Array<{ name: string; expires?: number }>; origins?: unknown[] };
export type OrigenSesion = 'corrida_renovada' | 'login_automatico' | 'export_manual';

const ARCHIVO = path.resolve(process.cwd(), 'uber-storage-state.json');
const CONSERVAR = 5; // historial corto: sirve para volver atrás un día, no para auditoría

const log = (ev: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));

// El tipo se infiere: tiparlo a mano choca con el schema personalizado.
function cliente() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: 'ubereats_raw' } });
}

/**
 * Cuándo muere la sesión de verdad. Tres candidatas, y solo una sirve — medido el
 * 28-sep-2026 comparando el estado guardado antes y después de tocar el portal:
 *
 *   __cf_bm         30 min   anti-bot de Cloudflare; se regenera sola. Mirar el
 *                            mínimo da un susto falso cada media hora.
 *   jwt-session      24 h    NO se renueva al visitar el portal: quedó clavada en
 *                            el mismo vencimiento entre dos corridas. Si fuera la
 *                            vital, la alerta gritaría todos los días sin motivo.
 *   jwt-session-uem   7 d    SÍ se renueva: pasó de vencer el 05-oct 18:34 a
 *                            vencer el 05-oct 19:11, que es la hora de la corrida
 *                            más siete días. Ventana deslizante. ESTA es la vital.
 *
 * Y explica el corte del 26 al 28-sep con exactitud: la sesión se exportó el 18 de
 * septiembre, esta cookie vencía siete días después (el 25) y la carga murió el 26.
 * Se renovaba en cada corrida... pero el proceso la tiraba al cerrar y volvía a leer
 * la del secreto, que envejecía sola hasta morir. Ese es el bucle que se rompió.
 */
export const COOKIE_VITAL = 'jwt-session-uem';

export function expiraPrimero(state: StorageState): Date | null {
  const vital = (state.cookies ?? []).find(c => c.name === COOKIE_VITAL);
  const ms = typeof vital?.expires === 'number' && vital.expires > 0 ? vital.expires * 1000 : null;
  return ms ? new Date(ms) : null;
}

/** Horas que le quedan de vida a la sesión. Negativo = ya venció. */
export function horasDeVida(state: StorageState): number | null {
  const e = expiraPrimero(state);
  return e ? (e.getTime() - Date.now()) / 3_600_000 : null;
}

/**
 * De dónde arranca la corrida. Devuelve también el origen para que el registro diga
 * con qué se entró: sin eso es imposible saber si la renovación automática sirvió.
 */
export async function cargarSesion(): Promise<{ state: StorageState; origen: string }> {
  const db = cliente();
  if (db) {
    const { data, error } = await db
      .from('uber_sesion')
      .select('storage_state, origen, guardado_at, expira_at')
      .order('guardado_at', { ascending: false })
      .limit(1);
    if (error) {
      // No se aborta: el secreto sigue siendo una salida válida. Pero queda dicho,
      // porque si esto falla en silencio volvemos al problema de origen.
      log('uber.sesion.lectura_falló', { error: error.message });
    } else if (data?.length) {
      const fila = data[0] as { storage_state: StorageState; origen: string; guardado_at: string; expira_at: string | null };
      log('uber.sesion.desde_base', {
        origen: fila.origen, guardado_at: fila.guardado_at, expira_at: fila.expira_at,
      });
      return { state: fila.storage_state, origen: `base:${fila.origen}` };
    }
  }

  const secreto = process.env.UBER_STORAGE_STATE;
  if (secreto) {
    log('uber.sesion.desde_secreto', {});
    return { state: JSON.parse(secreto) as StorageState, origen: 'secreto' };
  }

  if (fs.existsSync(ARCHIVO)) {
    log('uber.sesion.desde_archivo', { archivo: path.basename(ARCHIVO) });
    return { state: JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) as StorageState, origen: 'archivo' };
  }

  throw new Error('No hay sesión de Uber por ningún lado: ni en la base, ni en el secreto UBER_STORAGE_STATE, ni en uber-storage-state.json');
}

/**
 * Guarda el estado renovado. Se llama al final de toda corrida que funcionó: es lo
 * que mantiene viva la sesión sin que nadie intervenga.
 */
export async function guardarSesion(state: StorageState, origen: OrigenSesion): Promise<boolean> {
  const db = cliente();
  if (!db) { log('uber.sesion.sin_guardar', { motivo: 'faltan credenciales de Supabase' }); return false; }

  const expira = expiraPrimero(state);
  const cookies = state.cookies?.length ?? 0;
  if (!cookies) { log('uber.sesion.sin_guardar', { motivo: 'el estado no trae cookies' }); return false; }

  const { error } = await db.from('uber_sesion').insert({
    storage_state: state, origen, cookies,
    expira_at: expira ? expira.toISOString() : null,
  });
  if (error) { log('uber.sesion.guardado_falló', { error: error.message, origen }); return false; }

  log('uber.sesion.guardada', { origen, cookies, expira_at: expira?.toISOString() ?? null });

  // Podar: el historial largo sólo acumula cookies viejas, que son credenciales.
  const { data: viejas } = await db
    .from('uber_sesion').select('id').order('guardado_at', { ascending: false }).range(CONSERVAR, CONSERVAR + 50);
  const ids = (viejas ?? []).map(v => (v as { id: number }).id);
  if (ids.length) await db.from('uber_sesion').delete().in('id', ids);

  return true;
}
