// CHECK + ALERT — corre periódicamente (GH Actions cada 10 min).
// 1. Alerta de fallo: si el cron de GH Actions lleva >30 min sin insertar datos.
// 2. Resumen horario: una vez por hora, cuántos pedidos entraron + total del día.
// 3. Anomalía de volumen: si los pedidos caen < 30% de la media histórica (horario OK).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_FROM  = process.env.TWILIO_WHATSAPP_FROM!;
const ALERT_TO     = process.env.ALERT_WHATSAPP_TO!;
const TWILIO_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_SID || 'HXa258d95503bd7f60f2537e85d6fd250c';

const COOLDOWN_FALLO_MIN   = Number(process.env.ALERT_COOLDOWN_MIN || 60);
const UMBRAL_FALLO_MIN     = 30;   // gap máximo tolerable entre runs del cron
const COOLDOWN_RESUMEN_MIN = 55;   // envía resumen max 1 vez/hora

// Horario operativo de Chios Delivery (Ecuador)
const HORA_APERTURA = 12;   // 12:00 EC
const HORA_CIERRE   = 23;   // 23:59 EC

function ts(): string { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
function log(level: 'info' | 'warn' | 'error', msg: string): void {
  console.log(`[${ts()}] ${level.toUpperCase()}: ${msg}`);
}

function fechaEC(): string {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date()).replace(',', '');
}

function horaEC(): number {
  return Number(new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil', hour: 'numeric', hour12: false,
  }).format(new Date()));
}

interface AlertContent {
  titulo: string;
  lugar: string;
  severidad: string;
  fecha: string;
  detalle: string;
}

async function sendWhatsApp(content: AlertContent): Promise<{ ok: boolean; sid?: string; error?: string; raw?: any }> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !ALERT_TO) {
    return { ok: false, error: 'Faltan creds Twilio o ALERT_WHATSAPP_TO' };
  }
  const url  = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  const vars = JSON.stringify({
    '1': content.titulo.slice(0, 200),
    '2': content.lugar.slice(0, 200),
    '3': content.severidad.slice(0, 100),
    '4': content.fecha.slice(0, 100),
    '5': content.detalle.slice(0, 500),
  });
  const body = new URLSearchParams({
    From: TWILIO_FROM, To: ALERT_TO,
    ContentSid: TWILIO_TEMPLATE_SID, ContentVariables: vars,
  });
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = await resp.json();
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}: ${JSON.stringify(json).slice(0, 200)}`, raw: json };
    return { ok: true, sid: json.sid, raw: json };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function logAlert(supabase: any, type: string, value: number, content: AlertContent, result: { ok: boolean; sid?: string; error?: string; raw?: any }) {
  await (supabase.schema('otter_raw' as any) as any)
    .from('alert_log')
    .insert({
      alert_type: type,
      metric_value: value,
      message: JSON.stringify(content),
      channel: 'whatsapp',
      delivery_status: result.ok ? `twilio_sid:${result.sid}` : `failed:${result.error?.slice(0, 200)}`,
      raw_response: result.raw,
    });
}

async function hasCooldown(supabase: any, type: string, cooldownMin: number): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMin * 60_000).toISOString();
  const { data } = await (supabase.schema('otter_raw' as any) as any)
    .from('alert_log')
    .select('alert_id')
    .like('alert_type', type.includes('%') ? type : `${type}%`)
    .gte('alerted_at', since)
    .limit(1);
  return !!(data && data.length > 0);
}

// ─── 1. Alerta de fallo del cron ────────────────────────────────────────────
// Verifica cuándo fue el último run de GH Actions que insertó datos.
// Si el gap supera UMBRAL_FALLO_MIN → alerta crítica.

async function checkCronHealth(supabase: any): Promise<void> {
  log('info', `▶ Check cron GH Actions (umbral=${UMBRAL_FALLO_MIN}min)`);

  const { data: lastRun, error } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_scrape_runs')
    .select('started_at, ended_at, status, pedidos_count, host_name')
    .eq('run_type', 'backfill')
    .eq('status', 'completed')
    .like('notes', 'Recovery gap%')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    log('warn', `[cron.health] Error leyendo runs: ${error.message}`);
    return;
  }

  if (!lastRun) {
    log('warn', '[cron.health] Sin runs de backfill históricos — sistema nuevo o error');
    return;
  }

  const minutos = (Date.now() - new Date(lastRun.ended_at).getTime()) / 60_000;
  log('info', `📊 Último cron exitoso: hace ${minutos.toFixed(0)} min | pedidos=${lastRun.pedidos_count} | host=${lastRun.host_name}`);

  if (minutos <= UMBRAL_FALLO_MIN) {
    log('info', `✓ Cron sano (${minutos.toFixed(0)}min ≤ umbral ${UMBRAL_FALLO_MIN}min)`);
    return;
  }

  // Cooldown para no spam
  if (await hasCooldown(supabase, 'cron_fallo', COOLDOWN_FALLO_MIN)) {
    log('info', `⏸ Alerta cron en cooldown (${COOLDOWN_FALLO_MIN}min). Skip.`);
    return;
  }

  const content: AlertContent = {
    titulo: `Otter cron sin datos — ${minutos.toFixed(0)} min`,
    lugar: 'GH Actions cloud (gti-sync-basedatos)',
    severidad: 'Crítica',
    fecha: fechaEC(),
    detalle: `El cron de GH Actions lleva ${minutos.toFixed(0)} min sin insertar pedidos. Último run exitoso: ${new Date(lastRun.ended_at).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}. Revisar: foodixsas/gti-sync-basedatos → Actions → "Otter cloud polling safety net".`,
  };

  log('warn', `🚨 ALERTA CRON: ${minutos.toFixed(0)} min sin datos`);
  const result = await sendWhatsApp(content);
  await logAlert(supabase, 'cron_fallo', minutos, content, result);

  if (result.ok) {
    log('info', `✓ WhatsApp enviado (sid=${result.sid})`);
  } else {
    log('error', `❌ Twilio falló: ${result.error}`);
  }
}

// ─── 2. Resumen horario ──────────────────────────────────────────────────────
// Se envía una vez por hora (cooldown 55 min) durante horario operativo.
// Incluye: pedidos de la última hora, total del día, último pedido hace N min.

async function sendHourlySummary(supabase: any): Promise<void> {
  const hora = horaEC();

  // Fuera de horario operativo: solo enviar si hay pedidos en la última hora
  // (puede haber pedidos nocturnos esporádicos que igualmente vale reportar)
  const enHorario = hora >= HORA_APERTURA && hora <= HORA_CIERRE;

  // Cooldown de 55 min para enviar máximo 1 resumen por hora
  if (await hasCooldown(supabase, 'hourly_summary', COOLDOWN_RESUMEN_MIN)) {
    log('info', `⏸ Resumen horario en cooldown (${COOLDOWN_RESUMEN_MIN}min). Skip.`);
    return;
  }

  // Pedidos de la última hora
  const haceUnaHora = new Date(Date.now() - 60 * 60_000)
    .toISOString().replace('T', ' ').replace('Z', '');

  const { data: ultHoraRows, error: e1 } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_pedidos')
    .select('ts_reference_local, total_with_tip')
    .gte('ts_reference_local', haceUnaHora)
    .eq('is_test', false);

  if (e1) { log('warn', `[summary.ultHora] ${e1.message}`); return; }

  const ultHoraCount = ultHoraRows?.length ?? 0;
  const ultHoraTotal = (ultHoraRows ?? []).reduce((s: number, r: any) => s + Number(r.total_with_tip || 0), 0);

  // Fuera de horario y 0 pedidos → no tiene sentido enviar
  if (!enHorario && ultHoraCount === 0) {
    log('info', `↳ Fuera de horario y 0 pedidos — skip resumen`);
    return;
  }

  // Total del día (Ecuador)
  const hoyEC = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
  const { data: diaRows, error: e2 } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_pedidos')
    .select('total_with_tip')
    .gte('ts_reference_local', hoyEC)
    .eq('is_test', false);

  if (e2) { log('warn', `[summary.dia] ${e2.message}`); return; }

  const diaCount = diaRows?.length ?? 0;
  const diaTotal = (diaRows ?? []).reduce((s: number, r: any) => s + Number(r.total_with_tip || 0), 0);

  // Último pedido
  const { data: ultimoPedido } = await (supabase.schema('otter_raw' as any) as any)
    .from('otter_pedidos')
    .select('ts_reference_local, ofo_slug')
    .eq('is_test', false)
    .order('ts_reference_local', { ascending: false })
    .limit(1)
    .maybeSingle();

  const minUltPedido = ultimoPedido
    ? Math.round((Date.now() - new Date(`${ultimoPedido.ts_reference_local}Z`).getTime()) / 60_000)
    : null;

  const detalle = [
    `Última hora: ${ultHoraCount} pedidos ($${ultHoraTotal.toFixed(2)})`,
    `Total hoy: ${diaCount} pedidos ($${diaTotal.toFixed(2)})`,
    minUltPedido !== null
      ? `Último pedido: hace ${minUltPedido} min (${ultimoPedido.ofo_slug})`
      : 'Sin pedidos registrados aún hoy',
  ].join(' | ');

  const content: AlertContent = {
    titulo: `Reporte horario — ${hora}:00 EC`,
    lugar: 'Chios Delivery (Otter)',
    severidad: 'Info',
    fecha: fechaEC(),
    detalle,
  };

  log('info', `📬 Enviando resumen horario: ${detalle}`);
  const result = await sendWhatsApp(content);
  await logAlert(supabase, 'hourly_summary', ultHoraCount, content, result);

  if (result.ok) {
    log('info', `✓ Resumen horario enviado (sid=${result.sid})`);
  } else {
    log('error', `❌ Twilio falló en resumen horario: ${result.error}`);
  }
}

// ─── 3. Anomalía de volumen ──────────────────────────────────────────────────

async function checkAnomalyVolumen(supabase: any): Promise<void> {
  const { data: anom, error: aErr } = await (supabase.schema('otter_raw' as any) as any)
    .from('v_volumen_anomalia')
    .select('*')
    .limit(1)
    .single();

  if (aErr || !anom) {
    log('warn', `[anomaly.read] ${aErr?.message || 'sin data'}`);
    return;
  }

  log('info', `📈 anomalia.estado=${anom.estado} actual=${anom.pedidos_actuales} esperado=${anom.pedidos_esperados} pct=${anom.pct_vs_esperado}`);

  if (anom.estado !== 'anomaly_low_volume') return;

  if (await hasCooldown(supabase, 'anomaly_low_volume', 60)) {
    log('info', `⏸ Anomalía en cooldown. Skip.`);
    return;
  }

  const content: AlertContent = {
    titulo: 'Otter — volumen anómalo',
    lugar: 'Pipeline ingesta Chios',
    severidad: 'Anomalía',
    fecha: fechaEC(),
    detalle: `Última hora: ${anom.pedidos_actuales} pedidos vs media histórica ${anom.pedidos_esperados} (solo ${anom.pct_vs_esperado}% de lo esperado). El cron puede correr pero algo bloquea la ingesta. Revisar Otter o canales de delivery.`,
  };

  log('warn', `📉 ALERTA ANOMALÍA: ${anom.pct_vs_esperado}% de esperado`);
  const result = await sendWhatsApp(content);
  await logAlert(supabase, 'anomaly_low_volume', anom.pct_vs_esperado, content, result);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('error', 'Faltan creds Supabase');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // Modo test: envía un WhatsApp de prueba sin verificar nada
  if (process.env.SEND_TEST === 'true') {
    log('info', '🧪 SEND_TEST=true → enviando WhatsApp de prueba');
    const content: AlertContent = {
      titulo: 'PRUEBA - Otter alert system',
      lugar: 'FOODIX GH Actions + Twilio Production',
      severidad: 'Test',
      fecha: fechaEC(),
      detalle: 'Si recibes este mensaje, la cadena GH Actions → Twilio Production → WhatsApp funciona correctamente. Alertas activas: fallo del cron (>30 min sin datos) + resumen horario.',
    };
    const result = await sendWhatsApp(content);
    log(result.ok ? 'info' : 'error', `Twilio: ${result.ok ? 'OK sid=' + result.sid : 'FAIL ' + result.error}`);
    await logAlert(supabase, 'test', 0, content, result);
    if (!result.ok) process.exit(1);
    return;
  }

  // 1. Fallo del cron de GH Actions (principal, siempre verificar)
  await checkCronHealth(supabase);

  // 2. Resumen horario (una vez por hora durante horario operativo)
  await sendHourlySummary(supabase);

  // 3. Anomalía de volumen (solo en horario operativo cuando hay histórico)
  const hora = horaEC();
  if (hora >= HORA_APERTURA && hora <= HORA_CIERRE) {
    await checkAnomalyVolumen(supabase);
  } else {
    log('info', `↳ Fuera de horario (${hora}:xx EC) — skip anomalía`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
