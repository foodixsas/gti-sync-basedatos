#!/usr/bin/env tsx
/**
 * Pide los 8 informes de Operaciones y Opiniones de Uber Eats Manager y los baja.
 *
 * Sin navegador, igual que el de pedidos: SubmitReportJob por cada tipo, espera a
 * que queden COMPLETED y baja cada CSV. Los deja como `<REPORT_TYPE_...>.csv` para
 * que `import-uber-reports` sepa a qué tabla va cada uno.
 *
 * Cada informe tiene su propio rezago (Uber no cierra los datos al mismo ritmo),
 * así que el fin del rango se recorta por tipo.
 *
 * Uso:  npm run download-uber-reports                        → últimos 7 días
 *       npm run download-uber-reports 2026-06-01 2026-06-30  → rango (backfill)
 * Salida: tmp-uber-manager-probe/informes/
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { request as pwRequest, type APIRequestContext } from 'playwright';

const OUT = path.resolve(process.cwd(), 'tmp-uber-manager-probe', 'informes');
const MAX_DIAS_ATRAS = 188;
const BASE = 'https://merchants.ubereats.com/manager';
const LOCALE = 'es-419';

/** rezagoDias sale del bundle del portal (endDateOffset por tipo). */
const INFORMES = [
  { etiqueta: 'Precisión del pedido',                  tipo: 'REPORT_TYPE_INACCURATE_ORDERS_REPORT',    rezagoDias: 4 },
  { etiqueta: 'Artículos con errores',                 tipo: 'REPORT_TYPE_ITEMS_WITH_ERRORS_REPORT',    rezagoDias: 2 },
  { etiqueta: 'Pedidos con errores',                   tipo: 'REPORT_TYPE_ORDERS_WITH_ERRORS_REPORT',   rezagoDias: 4 },
  { etiqueta: 'Tiempo de inactividad',                 tipo: 'REPORT_TYPE_DOWNTIME_REPORT',             rezagoDias: 2 },
  { etiqueta: 'Detalles de la pausa',                  tipo: 'REPORT_TYPE_PAUSE_REPORT',                rezagoDias: 2 },
  { etiqueta: 'Disponibilidad del negocio',            tipo: 'REPORT_TYPE_STORE_AVAILABILITY_REPORT',   rezagoDias: 2 },
  { etiqueta: 'Opiniones de usuarios y repartidores',  tipo: 'REPORT_TYPE_EATER_COURIER_RATING_REPORT', rezagoDias: 2 },
  { etiqueta: 'Opiniones sobre artículos del menú',    tipo: 'REPORT_TYPE_MENU_ITEM_RATING_REPORT',     rezagoDias: 2 },
];

const Q_JOBS = 'query GetReportJobs($limit: Int) {\n  reportJobs(limit: $limit) {\n    reportJobs {\n      jobUUID\n      jobStatus\n      reportTypes\n      createdAtUnixMs\n      jobParams {\n        restaurantUUIDs\n        startAtLocal\n        endAtLocal\n      }\n    }\n  }\n}\n';
const M_SUBMIT = 'mutation SubmitReportJob($submitReportJobInput: SubmitReportJobInput!) {\n  submitReportJob(submitReportJobInput: $submitReportJobInput) {\n    status\n    message\n  }\n}\n';

const log = (ev: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));
const dormir = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const aLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
/** Nunca `new Date("YYYY-MM-DD")`: parsea UTC y en Ecuador resta un dia. */
const desdeISO = (x: string) => { const [y, m, d] = x.split('-').map(Number); return new Date(y, m - 1, d); };
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

type Job = { jobUUID: string; jobStatus: string; reportTypes: string[]; jobParams?: { restaurantUUIDs?: string[] } };

async function graphql<T>(api: APIRequestContext, op: string, query: string, variables: unknown): Promise<T> {
  const res = await api.post(`${BASE}/graphql?op=${op}`, { data: { operationName: op, variables, query }, timeout: 60_000 });
  const texto = await res.text();
  if (res.status() === 401 || res.status() === 403) throw new Error(`Sesión de Uber caducada (HTTP ${res.status()} en ${op})`);
  if (!res.ok() || /"errors"/.test(texto)) throw new Error(`${op} devolvió ${res.status()}: ${texto.slice(0, 300)}`);
  return JSON.parse(texto) as T;
}
const traerJobs = async (api: APIRequestContext): Promise<Job[]> =>
  (await graphql<{ data?: { reportJobs?: { reportJobs?: Job[] } } }>(api, 'GetReportJobs', Q_JOBS, { limit: 40 }))
    .data?.reportJobs?.reportJobs ?? [];

async function main() {
  fs.mkdirSync(OUT, { recursive: true, mode: 0o700 });
  const secreto = process.env.UBER_STORAGE_STATE;
  const archivo = path.resolve(process.cwd(), 'uber-storage-state.json');
  if (!secreto && !fs.existsSync(archivo)) throw new Error('Falta la sesión de Uber');
  const api = await pwRequest.newContext({
    storageState: secreto ? JSON.parse(secreto) : archivo,
    extraHTTPHeaders: { 'x-csrf-token': 'x', 'content-type': 'application/json' },
  });

  try {
    const previos = await traerJobs(api);
    const tiendas = previos[0]?.jobParams?.restaurantUUIDs ?? [];
    if (!tiendas.length) throw new Error('No se pudo leer la lista de tiendas de ningún informe previo');

    // Rango por argumento (backfill) o los últimos 7 días disponibles.
    // Cada informe tiene su propio rezago, así que el fin se recorta por tipo:
    // pedir una fecha que Uber todavía no cerró devuelve "Invalid or missing arguments".
    const [argIni, argFin] = process.argv.slice(2).filter(Boolean);
    const pedidos = new Map<string, string>();  // tipo -> jobUUID
    for (const inf of INFORMES) {
      const finPedido = argFin ? desdeISO(argFin) : diasAtras(inf.rezagoDias);
      const topeFin = diasAtras(inf.rezagoDias);
      const fin = finPedido > topeFin ? topeFin : finPedido;
      const iniPedido = argIni ? desdeISO(argIni) : diasAtras(inf.rezagoDias + 7);
      const topeIni = diasAtras(MAX_DIAS_ATRAS);
      const ini = iniPedido < topeIni ? topeIni : iniPedido;
      if (ini >= fin) { log('informes.rango_vacio', { informe: inf.etiqueta }); continue; }
      const jobUUID = crypto.randomUUID();
      try {
        await graphql(api, 'SubmitReportJob', M_SUBMIT, {
          submitReportJobInput: {
            jobUUID, reportTypes: [inf.tipo],
            jobParams: { restaurantUUIDs: tiendas, startAtLocal: aLocal(ini), endAtLocal: aLocal(fin), locale: LOCALE },
          },
        });
        pedidos.set(inf.tipo, jobUUID);
        log('informes.pedido', { informe: inf.etiqueta, tipo: inf.tipo });
      } catch (e) {
        // Un informe que la cuenta no tiene habilitado no debe tumbar a los otros.
        log('informes.no_disponible', { informe: inf.etiqueta, motivo: e instanceof Error ? e.message.slice(0, 200) : String(e) });
      }
      await dormir(1200);
    }

    const limite = Date.now() + Number(process.env.UBER_ESPERA_MAX_S ?? 900) * 1000;
    const listos = new Map<string, string>();
    while (listos.size < pedidos.size && Date.now() < limite) {
      const jobs = await traerJobs(api);
      for (const [tipo, uuid] of pedidos) {
        if (listos.has(tipo)) continue;
        const j = jobs.find(x => x.jobUUID === uuid);
        if (j?.jobStatus === 'REPORT_JOB_STATUS_COMPLETED') listos.set(tipo, uuid);
      }
      if (listos.size < pedidos.size) {
        log('informes.esperando', { listos: listos.size, de: pedidos.size, restanteS: Math.round((limite - Date.now()) / 1000) });
        await dormir(30_000);
      }
    }

    const resumen: Record<string, unknown>[] = [];
    for (const inf of INFORMES) {
      const uuid = listos.get(inf.tipo);
      if (!uuid) { resumen.push({ informe: inf.etiqueta, tipo: inf.tipo, estado: 'no llegó a tiempo o no disponible' }); continue; }
      const res = await api.get(`${BASE}/download-report?reportJobUUID=${uuid}`, { timeout: 120_000 });
      if (!res.ok()) { resumen.push({ informe: inf.etiqueta, tipo: inf.tipo, estado: `descarga ${res.status()}` }); continue; }
      const csv = await res.text();
      const lineas = csv.trim().split(/\r?\n/);
      const archivoCsv = path.join(OUT, `${inf.tipo}.csv`);  // el importador lo busca por tipo
      fs.writeFileSync(archivoCsv, csv, 'utf8');
      resumen.push({
        informe: inf.etiqueta, tipo: inf.tipo, estado: 'ok',
        filas: Math.max(0, lineas.length - 1),
        columnas: (lineas[0] ?? '').split(',').length,
        encabezado: (lineas[0] ?? '').split(',').map(c => c.replace(/^﻿/, '').trim()),
        primeraFila: lineas[1] ?? null,
      });
    }

    fs.writeFileSync(path.join(OUT, 'informes-descargados.json'), JSON.stringify(resumen, null, 1));
    log('informes.lista', { archivo: path.join(OUT, 'informes-descargados.json'), informes: resumen.length });
  } finally {
    await api.dispose();
  }
}

main().catch(error => {
  log('informes.error', { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
