#!/usr/bin/env tsx
/**
 * Pide UNA muestra chica de cada informe de Uber Eats Manager y reporta sus
 * columnas reales.
 *
 * Para qué: antes de diseñar tablas en Supabase hay que ver los encabezados de
 * verdad. Uber traduce los nombres y cambia la traducción, así que inventar la
 * estructura desde el nombre del informe es garantía de rehacerlo.
 *
 * Uso:  npm run sample-uber-reports
 * Salida: tmp-uber-manager-probe/muestra-informes.json (columnas por informe)
 *         + los CSV crudos, para poder mirar filas de ejemplo.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { request as pwRequest, type APIRequestContext } from 'playwright';

const OUT = path.resolve(process.cwd(), 'tmp-uber-manager-probe', 'muestras');
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

    // Muestra corta: 3 días por informe, respetando el rezago propio de cada uno.
    const pedidos = new Map<string, string>();  // tipo -> jobUUID
    for (const inf of INFORMES) {
      const fin = diasAtras(inf.rezagoDias);
      const ini = diasAtras(inf.rezagoDias + 3);
      const jobUUID = crypto.randomUUID();
      try {
        await graphql(api, 'SubmitReportJob', M_SUBMIT, {
          submitReportJobInput: {
            jobUUID, reportTypes: [inf.tipo],
            jobParams: { restaurantUUIDs: tiendas, startAtLocal: aLocal(ini), endAtLocal: aLocal(fin), locale: LOCALE },
          },
        });
        pedidos.set(inf.tipo, jobUUID);
        log('muestra.pedido', { informe: inf.etiqueta, tipo: inf.tipo });
      } catch (e) {
        // Un informe que la cuenta no tiene habilitado no debe tumbar a los otros.
        log('muestra.no_disponible', { informe: inf.etiqueta, motivo: e instanceof Error ? e.message.slice(0, 200) : String(e) });
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
        log('muestra.esperando', { listos: listos.size, de: pedidos.size, restanteS: Math.round((limite - Date.now()) / 1000) });
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
      const archivoCsv = path.join(OUT, `${inf.tipo}.csv`);
      fs.writeFileSync(archivoCsv, csv, 'utf8');
      resumen.push({
        informe: inf.etiqueta, tipo: inf.tipo, estado: 'ok',
        filas: Math.max(0, lineas.length - 1),
        columnas: (lineas[0] ?? '').split(',').length,
        encabezado: (lineas[0] ?? '').split(',').map(c => c.replace(/^﻿/, '').trim()),
        primeraFila: lineas[1] ?? null,
      });
    }

    fs.writeFileSync(path.join(OUT, 'muestra-informes.json'), JSON.stringify(resumen, null, 1));
    log('muestra.lista', { archivo: path.join(OUT, 'muestra-informes.json'), informes: resumen.length });
  } finally {
    await api.dispose();
  }
}

main().catch(error => {
  log('muestra.error', { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
