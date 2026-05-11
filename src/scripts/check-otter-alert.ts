// CHECK + ALERT — corre periódicamente (GH Actions cada 10 min).
// Lee otter_raw.v_polling_health. Si minutos_sin_inserts > UMBRAL y no hay alerta
// reciente dentro del cooldown, manda WhatsApp via Twilio y registra en alert_log.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!; // ej "whatsapp:+593994942631" (FOODIX prod)
const ALERT_TO = process.env.ALERT_WHATSAPP_TO!;       // ej "whatsapp:+5939XXXXXXXX"
// Template aprobado por Meta para alertas. Renderiza: 🚨 {{1}} | 📍 Tienda: {{2}} | ⚠️ Severidad: {{3}} | 🕐 Fecha: {{4}} | 💬 Comentario: {{5}}
const TWILIO_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_SID || 'HXa258d95503bd7f60f2537e85d6fd250c';

const COOLDOWN_MIN = Number(process.env.ALERT_COOLDOWN_MIN || 60);

// Estados de v_polling_health que disparan alerta crítica.
// DETENIDO: polling no está corriendo. COLGADO: heartbeat ausente > 3 min.
// "SIN_PEDIDOS_NUEVOS" NO dispara alerta crítica (puede ser hora valle legítima);
// el chequeo de anomalía vs histórico cubre ese caso por separado.
const ALERT_STATUSES = new Set(['DETENIDO', 'COLGADO']);

function ts(): string { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
function log(level: 'info' | 'warn' | 'error', msg: string): void {
  console.log(`[${ts()}] ${level.toUpperCase()}: ${msg}`);
}

interface AlertContent {
  titulo: string;       // {{1}} ej: "Otter polling DETENIDO"
  lugar: string;        // {{2}} ej: "Servidor FOODIX (mac local)"
  severidad: string;    // {{3}} ej: "Crítica" | "Anomalía"
  fecha: string;        // {{4}} ej: "11/05/2026 16:10:00"
  detalle: string;      // {{5}} texto largo libre
}

async function sendWhatsApp(content: AlertContent): Promise<{ ok: boolean; sid?: string; error?: string; raw?: any }> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !ALERT_TO) {
    return { ok: false, error: 'Faltan creds Twilio o ALERT_WHATSAPP_TO' };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  const contentVariables = JSON.stringify({
    '1': content.titulo.slice(0, 200),
    '2': content.lugar.slice(0, 200),
    '3': content.severidad.slice(0, 100),
    '4': content.fecha.slice(0, 100),
    '5': content.detalle.slice(0, 500),
  });
  const body = new URLSearchParams({
    From: TWILIO_FROM,
    To: ALERT_TO,
    ContentSid: TWILIO_TEMPLATE_SID,
    ContentVariables: contentVariables,
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

function fechaEC(): string {
  // Formato dd/mm/yyyy HH:MM:SS en timezone Ecuador
  const d = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Guayaquil',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  };
  return new Intl.DateTimeFormat('es-EC', opts).format(d).replace(',', '');
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('error', 'Faltan creds Supabase');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // Test mode: salta todas las validaciones y manda un WhatsApp de prueba.
  // Útil para validar que las creds Twilio + número destino funcionan.
  if (process.env.SEND_TEST === 'true') {
    log('info', '🧪 SEND_TEST=true → enviando WhatsApp de prueba');
    const testContent: AlertContent = {
      titulo: 'PRUEBA - Otter alert system',
      lugar: 'Servidor FOODIX',
      severidad: 'Test',
      fecha: fechaEC(),
      detalle: 'Si recibes este mensaje, la cadena Supabase → GH Actions → Twilio Production con template aprobado funciona correctamente. Las alertas reales solo dispararán cuando v_polling_health reporte DETENIDO o COLGADO.',
    };
    const result = await sendWhatsApp(testContent);
    log(result.ok ? 'info' : 'error', `Twilio: ${result.ok ? 'OK sid=' + result.sid : 'FAIL ' + result.error}`);
    await (supabase.schema('otter_raw' as any) as any)
      .from('alert_log')
      .insert({
        alert_type: 'test',
        metric_value: 0,
        message: JSON.stringify(testContent),
        channel: 'whatsapp',
        delivery_status: result.ok ? `twilio_sid:${result.sid}` : `failed:${result.error?.slice(0, 200)}`,
        raw_response: result.raw,
      });
    if (!result.ok) process.exit(1);
    return;
  }

  log('info', `▶ Check polling health (alerta si status ∈ ${Array.from(ALERT_STATUSES).join(',')} | cooldown=${COOLDOWN_MIN}min)`);

  const { data: health, error: hErr } = await (supabase.schema('otter_raw' as any) as any)
    .from('v_polling_health')
    .select('*')
    .limit(1)
    .single();

  if (hErr || !health) {
    log('error', `[health.read] ${hErr?.message || 'sin data'}`);
    // El fallo de leer la vista TAMBIÉN merece alerta (algo grave)
    await sendWhatsApp({
      titulo: 'Otter — Falla leyendo health view',
      lugar: 'Supabase',
      severidad: 'Crítica',
      fecha: fechaEC(),
      detalle: `No se pudo consultar v_polling_health: ${hErr?.message || 'desconocido'}. El sistema de alertas no puede operar hasta que se resuelva.`,
    });
    process.exit(1);
  }

  const minutos = Number(health.minutos_sin_inserts ?? 0);
  const minutosHb = Number(health.minutos_sin_heartbeat ?? 0);
  const polling = String(health.health_status ?? '?');
  log('info', `📊 health_status=${polling} | sin_inserts=${minutos.toFixed(0)}min | sin_heartbeat=${minutosHb.toFixed(0)}min | last_ts=${health.last_ts_pedido || '?'}`);

  if (!ALERT_STATUSES.has(polling)) {
    log('info', `✓ Status no crítico (${polling}). Sin alerta de polling.`);
    // Solo chequear anomalía cuando polling status === 'OK'.
    // Si está en SIN_PEDIDOS_NUEVOS, la "anomalía de volumen" sería duplicar la misma señal:
    // v_polling_health ya nos dice "no hay datos recientes". No vale spamear con la misma info.
    if (polling === 'OK') {
      await checkAnomalyVolumen(supabase as any);
    } else {
      log('info', `↳ Skip check de anomalía (polling=${polling} ya implica baja ingesta)`);
    }
    return;
  }

  // Cooldown: ¿hay alerta reciente de cualquier estado de polling?
  const cooldownIso = new Date(Date.now() - COOLDOWN_MIN * 60_000).toISOString();
  const { data: recent } = await (supabase.schema('otter_raw' as any) as any)
    .from('alert_log')
    .select('alert_id, alerted_at, metric_value')
    .like('alert_type', 'polling_%')
    .gte('alerted_at', cooldownIso)
    .order('alerted_at', { ascending: false })
    .limit(1);

  if (recent && recent.length > 0) {
    log('info', `⏸ En cooldown — última alerta hace ${Math.round((Date.now() - new Date(recent[0].alerted_at).getTime()) / 60_000)}min (cooldown=${COOLDOWN_MIN}min). Skip.`);
    return;
  }

  const content: AlertContent = {
    titulo: `Otter polling ${polling}`,
    lugar: `${health.host_name || 'mac local'} pid=${health.process_pid || '?'}`,
    severidad: 'Crítica',
    fecha: fechaEC(),
    detalle: `Sin heartbeat ${minutosHb.toFixed(0)} min. Sin inserts ${minutos.toFixed(0)} min. Último pedido: ${health.last_ts_pedido || 'desconocido'}. Revisar launchd en Mac o disparar GH Actions safety net.`,
  };

  log('warn', `🚨 DISPARANDO ALERTA: status=${polling}`);
  const result = await sendWhatsApp(content);

  await (supabase.schema('otter_raw' as any) as any)
    .from('alert_log')
    .insert({
      alert_type: `polling_${polling.toLowerCase()}`,
      metric_value: minutosHb,
      message: JSON.stringify(content),
      channel: 'whatsapp',
      delivery_status: result.ok ? `twilio_sid:${result.sid}` : `failed:${result.error?.slice(0, 200)}`,
      raw_response: result.raw,
    });

  if (!result.ok) {
    log('error', `❌ Twilio falló: ${result.error}`);
    process.exit(1);
  }
  log('info', `✓ WhatsApp enviado (sid=${result.sid})`);

  await checkAnomalyVolumen(supabase as any);
}

async function checkAnomalyVolumen(supabase: any) {
  // P2-J: además de polling_down, alertar si volumen de pedidos de la última hora
  // cae < 30% de la media histórica para mismo día/hora (señal de problema oculto:
  // polling corre pero Otter responde [] o filtro mal aplicado).
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

  // Cooldown propio para anomalías
  const cooldownIso = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: recent } = await (supabase.schema('otter_raw' as any) as any)
    .from('alert_log')
    .select('alert_id, alerted_at')
    .eq('alert_type', 'anomaly_low_volume')
    .gte('alerted_at', cooldownIso)
    .order('alerted_at', { ascending: false })
    .limit(1);

  if (recent && recent.length > 0) {
    log('info', `⏸ Anomalía en cooldown.`);
    return;
  }

  const content: AlertContent = {
    titulo: 'Otter — volumen anómalo',
    lugar: 'Pipeline ingesta',
    severidad: 'Anomalía',
    fecha: fechaEC(),
    detalle: `Última hora: ${anom.pedidos_actuales} pedidos vs media histórica ${anom.pedidos_esperados} (solo ${anom.pct_vs_esperado}% de lo esperado). Polling puede estar corriendo pero algo bloquea la ingesta. Revisar canales Otter / filtros.`,
  };

  log('warn', `📉 DISPARANDO ALERTA ANOMALÍA: ${anom.pct_vs_esperado}% de esperado`);
  const result = await sendWhatsApp(content);

  await (supabase.schema('otter_raw' as any) as any)
    .from('alert_log')
    .insert({
      alert_type: 'anomaly_low_volume',
      metric_value: anom.pct_vs_esperado,
      message: JSON.stringify(content),
      channel: 'whatsapp',
      delivery_status: result.ok ? `twilio_sid:${result.sid}` : `failed:${result.error?.slice(0, 200)}`,
      raw_response: result.raw,
    });
}

main().catch(e => { console.error(e); process.exit(1); });
