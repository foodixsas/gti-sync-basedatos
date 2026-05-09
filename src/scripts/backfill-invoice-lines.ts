#!/usr/bin/env tsx
/**
 * Backfill de pedidosya_raw.invoice_lines desde ListOrders.
 * Rango: 2026-05-01 → hoy.
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const TEMPLATES_FILE = 'pedidosya-templates.json';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const VENDOR_GRID: Record<string, string> = {
  '238962': 'HZUU1Y',
  '210361': '4F3TTD',
  '210792': '4F3SJT',
  '528672': 'HRE4HC',
  '587373': 'HPQKWK',
  '480041': 'HAJUYT',
};

async function fetchPage(t: any, timeFrom: string, timeTo: string, pageToken?: string) {
  const body = {
    ...t.body,
    variables: {
      ...t.body.variables,
      params: {
        ...t.body.variables.params,
        pagination: { pageSize: 100, ...(pageToken ? { pageToken } : {}) },
        timeFrom,
        timeTo,
      },
    },
  };
  const r = await fetch(t.url, { method: 'POST', headers: t.headers, body: JSON.stringify(body) });
  if (r.status === 401) throw new Error('TOKEN_EXPIRED — ejecuta npm run pedidosya-auth-bootstrap primero');
  const j: any = await r.json();
  if (j.errors) throw new Error(`GraphQL error: ${JSON.stringify(j.errors).slice(0, 200)}`);
  return j.data?.orders?.listOrders;
}

function toRow(o: any, scrapeRunId: number) {
  const gross = parseFloat(o.subtotal ?? 0);
  const comm = parseFloat(o.billing?.commissionAmount ?? 0);
  return {
    order_display_id: String(o.orderId),
    grid_code: VENDOR_GRID[o.vendorId] || null,
    order_date: o.placedTimestamp || null,
    gross_amount: gross || null,
    commission_amount: comm || null,
    commission_pct: gross > 0 ? parseFloat((comm / gross * 100).toFixed(4)) : null,
    net_amount: parseFloat(o.billing?.netRevenue ?? 0) || null,
    order_status: o.orderStatus || null,
    raw_line: o,
    scrape_run_id: scrapeRunId,
  };
}

async function main() {
  if (!fs.existsSync(TEMPLATES_FILE)) throw new Error('pedidosya-templates.json no encontrado — ejecuta bootstrap-and-capture primero');
  const data = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
  const t = data.templates.gql_ListOrders;
  if (!t) throw new Error('Template ListOrders no encontrado');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: 'pedidosya_raw' as any },
    auth: { persistSession: false },
  });

  // Crear scrape_run
  const { data: run, error: runErr } = await supabase
    .from('scrape_runs')
    .insert({ tipo: 'invoice_lines_backfill', started_at: new Date().toISOString(), status: 'running' })
    .select('id').single();
  if (runErr || !run) throw new Error(`Error creando scrape_run: ${runErr?.message}`);
  const runId = run.id;
  console.log(`📊 scrape_run id=${runId}`);

  const timeFrom = '2026-05-01T05:00:00.000Z';
  const timeTo = new Date().toISOString();
  console.log(`📅 Rango: ${timeFrom.slice(0, 10)} → ${timeTo.slice(0, 10)}\n`);

  let pageToken: string | undefined;
  let totalInserted = 0;
  let page = 0;

  do {
    const lo = await fetchPage(t, timeFrom, timeTo, pageToken);
    if (!lo) break;
    const orders = lo.orders || [];
    pageToken = lo.nextPageToken || undefined;
    page++;

    if (orders.length === 0) break;

    const rows = orders.map((o: any) => toRow(o, runId));
    const { error } = await supabase
      .from('invoice_lines')
      .upsert(rows, { onConflict: 'order_display_id', ignoreDuplicates: false });

    if (error) {
      console.error(`❌ upsert pág ${page}: ${error.message}`);
    } else {
      totalInserted += rows.length;
      console.log(`   pág ${page}: ${rows.length} órdenes upserted (total: ${totalInserted})`);
    }
    await new Promise(r => setTimeout(r, 200));
  } while (pageToken);

  // Finalizar scrape_run
  await supabase.from('scrape_runs').update({
    finished_at: new Date().toISOString(),
    invoice_lines_nuev: totalInserted,
    status: 'ok',
  }).eq('id', runId);

  console.log(`\n✅ Completado: ${totalInserted} órdenes en pedidosya_raw.invoice_lines`);
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1); });
