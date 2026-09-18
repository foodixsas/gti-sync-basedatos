#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const OUT = path.resolve(process.cwd(), 'tmp-uber-manager-probe');
const file = process.argv[2] || fs.readdirSync(OUT).filter(x => /order_history.*\.csv$/i.test(x)).sort().at(-1);
if (!file) throw new Error('No se encontró CSV de Historial de pedidos');
const csvPath = path.isAbsolute(file) ? file : path.join(OUT, file);

const log = (ev: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));
const clean = (v: unknown) => String(v ?? '').replace(/^\uFEFF/, '').trim();
const bool = (v: unknown) => /^(1|true|sí|si)$/i.test(clean(v));
const num = (v: unknown) => { const n = Number(clean(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const date = (v: unknown) => { const s = clean(v); return s ? s.slice(0, 10) : null; };
const timestamp = (v: unknown) => { const s = clean(v); return s ? s.slice(0, 19).replace('T', ' ') : null; };

async function main() {
  const raw = fs.readFileSync(csvPath);
  // raw:true es obligatorio. Con raw:false la librería reinterpreta las columnas de fecha
  // y devuelve el serial de Excel (46273.378) en vez de "2026-09-08 09:04:33.000".
  const workbook = XLSX.read(raw.toString('utf8'), { type: 'string', raw: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: true });
  if (!rows.length) throw new Error('El CSV no contiene filas');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, { db: { schema: 'ubereats_raw' } });
  const dates = (rows.map(r => date(r['Fecha del pedido'])).filter(Boolean) as string[]).sort();
  if (!dates.length) throw new Error('Ninguna fila trae "Fecha del pedido" legible');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const report = {
    period_start: dates[0], period_end: dates.at(-1), store_scope: 'Historial de pedidos',
    filename: path.basename(csvPath), file_sha256: hash,
    source_url: 'https://merchants.ubereats.com/manager/reports', raw_csv: raw.toString('utf8'),
  };
  const { count: antes } = await supabase.from('orders').select('*', { count: 'exact', head: true });

  const { data: inserted, error: reportError } = await supabase
    .from('order_history_reports')
    .upsert(report, { onConflict: 'file_sha256' })
    .select('id')
    .single();
  if (reportError) throw reportError;
  const reportId = inserted.id;
  // Uber traduce los encabezados y cambia la traducción sin avisar: el mismo informe
  // llegó como "Tienda"/"ID del pedido" y como "Restaurante"/"Código del pedido".
  // Por eso cada columna se busca por sus alias conocidos, no por un nombre fijo.
  // Además, Uber manda las tildes en forma descompuesta (NFD): 'único' del archivo
  // no es igual a 'único' escrito acá. Se comparan los nombres sin acentos.
  const norm = (k: string) => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const columnas = new Map<string, string>();
  for (const k of Object.keys(rows[0])) columnas.set(norm(clean(k)), k);
  const pick = (r: Record<string, unknown>, ...alias: string[]) => {
    for (const a of alias) {
      const real = columnas.get(norm(a));
      if (real !== undefined) return r[real];
    }
    return '';
  };
  const mapped = rows.map(r => ({
    report_id: reportId,
    store_name: clean(pick(r, 'Tienda', 'Restaurante')),
    external_store_id: clean(pick(r, 'ID de tienda externa', 'Código externo del restaurante')) || null,
    business_uuid: clean(pick(r, 'UUID del negocio', 'UUID de la tienda')),
    country_code: clean(pick(r, 'Código de país', 'Código del país')) || null,
    city: clean(pick(r, 'Ciudad')) || null,
    order_id: clean(pick(r, 'ID del pedido', 'Código del pedido')),
    order_uuid: clean(pick(r, 'UUID del pedido', 'Identificador único universal (UUID) del pedido')),
    order_status: clean(pick(r, 'Estado del pedido')) || null,
    delivery_status: clean(pick(r, 'Estado de la entrega', 'Estado de entrega')) || null,
    scheduled: bool(pick(r, '¿Está programado?')),
    completed: bool(pick(r, '¿Se ha completado?', '¿Está completo?')),
    cancelled_by: clean(pick(r, 'Cancelado por')) || null,
    item_count: num(pick(r, 'Número de artículos del menú', 'Cantidad de artículos del menú')),
    currency: clean(pick(r, 'Código de divisa', 'Código de la divisa')) || null,
    receipt_amount: num(pick(r, 'Valor del recibo')),
    order_date_local: date(pick(r, 'Fecha del pedido')),
    customer_order_at: timestamp(pick(r, 'Hora del pedido del cliente')),
    cancellation_at: timestamp(pick(r, 'Hora de cancelación')),
    merchant_accept_at: timestamp(pick(r, 'Hora de aceptación del comercio', 'Hora en que el comercio aceptó')),
    order_completed_at: timestamp(pick(r, 'Hora de finalización del pedido')),
    courier_arrival_at: timestamp(pick(r, 'Hora de llegada del repartidor')),
    courier_departure_at: timestamp(pick(r, 'El repartidor ha iniciado el viaje', 'Hora en que el repartidor inició el viaje')),
    courier_delivery_at: timestamp(pick(r, 'Hora de entrega del repartidor')),
    accept_minutes: num(pick(r, 'Tiempo para aceptar', 'Tiempo hasta que se aceptó el pedido')),
    prep_minutes_original: num(pick(r, 'Tiempo de preparación original', 'Tiempo original de preparación')),
    prep_time_increased: bool(pick(r, '¿Ha aumentado el tiempo de preparación?', '¿Aumentó el tiempo de preparación?')),
    prep_increase_minutes: num(pick(r, 'Aumento del tiempo de preparación', 'Mayor tiempo de preparación')),
    delivery_minutes: num(pick(r, 'Tiempo total de entrega')),
    fulfillment_minutes: num(pick(r, 'Tiempo total de preparación y entrega', 'Tiempo total de preparación y de entrega')),
    courier_wait_minutes: num(pick(r, 'Tiempo de espera del repartidor (restaurante)')),
    avoidable_wait_minutes: num(pick(r, 'Tiempo de espera evitable del repartidor (restaurante)', 'Tiempo de espera evitable del socio de la App (restaurante)')),
    user_wait_minutes: num(pick(r, 'Tiempo de espera del repartidor (usuario de Uber Eats)', 'Tiempo de espera del repartidor (cliente)')),
    total_prep_delivery_minutes: num(pick(r, 'Tiempo total de preparación y entrega', 'Tiempo total de preparación y de entrega')),
    duration_minutes: num(pick(r, 'Duración del pedido')),
    batch_type: clean(pick(r, 'Tipo de lote de entrega')) || null,
    fulfillment_type: clean(pick(r, 'Tipo de cumplimentación', 'Tipo de cumplimiento')) || null,
    order_channel: clean(pick(r, 'Canal de pedidos')) || null,
    uber_brand: clean(pick(r, 'Marca de Uber Eats')) || null,
    subscription_pass: clean(pick(r, 'Pase de suscripción')) || null,
    workflow_uuid: clean(pick(r, 'UUID del flujo de trabajo', 'Identificador universal (UUID) del flujo de trabajo')) || null,
    raw_row: r,
  }));

  // Si Uber vuelve a renombrar una columna clave, esto lo dice en vez de guardar NULLs.
  const sinTienda = mapped.filter(m => !m.store_name).length;
  const sinUuid = mapped.filter(m => !m.order_uuid).length;
  if (sinTienda || sinUuid) {
    throw new Error(`Encabezados no reconocidos: ${sinTienda} filas sin tienda y ${sinUuid} sin UUID. Columnas recibidas: ${Object.keys(rows[0]).join(' | ')}`);
  }
  const ISO_TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
  const malformado = mapped.find(m => !ISO_TS.test(String(m.customer_order_at)));
  if (malformado) {
    throw new Error(`"Hora del pedido del cliente" no llegó como fecha ISO: ${JSON.stringify(malformado.customer_order_at)} (pedido ${malformado.order_id})`);
  }

  for (let i = 0; i < mapped.length; i += 500) {
    const { error } = await supabase.from('orders').upsert(mapped.slice(i, i + 500), { onConflict: 'business_uuid,order_uuid' });
    if (error) throw error;
  }
  await supabase.from('order_history_reports').update({ rows_loaded: mapped.length }).eq('id', reportId);

  // Latido con producción medida: sin esto no se distingue "corrió y no había nada nuevo"
  // de "corrió y no guardó nada".
  const { count: despues } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  const { data: ultimo } = await supabase
    .from('orders').select('customer_order_at')
    .order('customer_order_at', { ascending: false }).limit(1).maybeSingle();

  log('uber.order_history.imported', {
    file: path.basename(csvPath), reportId,
    filasCsv: mapped.length,
    filasNuevas: (despues ?? 0) - (antes ?? 0),
    filasEnTabla: despues ?? 0,
    ultimoPedido: ultimo?.customer_order_at ?? null,
    periodStart: report.period_start, periodEnd: report.period_end,
  });
}

main().catch(error => {
  // Los errores de Supabase son objetos planos ({message, details, hint, code}):
  // String(error) los convierte en "[object Object]" y el diagnóstico se pierde.
  const detalle = error instanceof Error
    ? { message: error.message, stack: error.stack }
    : (error && typeof error === 'object' ? { ...error } : { message: String(error) });
  log('uber.order_history.import_error', detalle);
  process.exitCode = 1;
});
