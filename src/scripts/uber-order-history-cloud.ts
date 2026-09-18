#!/usr/bin/env tsx
/**
 * Pipeline de Uber Eats SIN navegador, para correr en GitHub Actions.
 *
 * Por qué existe: la versión local depende del Mac de Daniel encendido, porque usa
 * un perfil Chrome persistente. Pero desde que la descarga dejó de hacer clics, los
 * tres pasos son HTTP puro sobre el portal de comercios:
 *
 *   1. SubmitReportJob  → pide el informe "Historial de pedidos"
 *   2. GetReportJobs    → espera a que quede COMPLETED
 *   3. download-report  → baja el CSV
 *
 * Lo único que hace falta es la sesión, que llega en el secreto UBER_STORAGE_STATE
 * (el JSON de cookies que produce `npm run export-uber-session` en el Mac).
 * El CSV se deja en tmp-uber-manager-probe/ y lo carga `import-uber-orders`.
 *
 * Si la sesión caducó, el script lo dice con ese nombre: hay que volver a exportarla.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { request as pwRequest, type APIRequestContext } from 'playwright';

const OUT = path.resolve(process.cwd(), 'tmp-uber-manager-probe');
const BASE = 'https://merchants.ubereats.com/manager';
const TIPO = 'REPORT_TYPE_ORDER_HISTORY_REPORT';
const COMPLETADO = 'REPORT_JOB_STATUS_COMPLETED';
const MAX_DIAS_ATRAS = 188;
const REZAGO_DIAS = 2;
const LOCALE = 'es-419';

// Firma tomada del bundle del portal: reportJobs(limit, cursor, filters, orderBy).
// Acá alcanza con limit; pasar argumentos que no existen devuelve GRAPHQL_VALIDATION_FAILED.
const Q_JOBS = 'query GetReportJobs($limit: Int) {\n  reportJobs(limit: $limit) {\n    reportJobs {\n      jobUUID\n      jobStatus\n      reportTypes\n      createdAtUnixMs\n      jobParams {\n        restaurantUUIDs\n        startAtLocal\n        endAtLocal\n      }\n    }\n  }\n}\n';
const M_SUBMIT = 'mutation SubmitReportJob($submitReportJobInput: SubmitReportJobInput!) {\n  submitReportJob(submitReportJobInput: $submitReportJobInput) {\n    status\n    message\n  }\n}\n';

const log = (ev: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));

const dormir = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const aLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
/** Nunca `new Date("YYYY-MM-DD")`: parsea UTC y en Ecuador resta un día. */
const desdeISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

type ReportJob = {
  jobUUID: string; jobStatus: string; reportTypes: string[]; createdAtUnixMs: string;
  jobParams?: { restaurantUUIDs?: string[]; startAtLocal?: string; endAtLocal?: string };
};

async function abrirSesion(): Promise<APIRequestContext> {
  const secreto = process.env.UBER_STORAGE_STATE;
  const archivo = path.resolve(process.cwd(), 'uber-storage-state.json');
  if (!secreto && !fs.existsSync(archivo)) {
    throw new Error('Falta la sesión de Uber: definir el secreto UBER_STORAGE_STATE o dejar uber-storage-state.json en el repo local');
  }
  return pwRequest.newContext({
    storageState: secreto ? JSON.parse(secreto) : archivo,
    extraHTTPHeaders: { 'x-csrf-token': 'x', 'content-type': 'application/json' },
  });
}

async function graphql<T>(api: APIRequestContext, op: string, query: string, variables: unknown): Promise<T> {
  const res = await api.post(`${BASE}/graphql?op=${op}`, {
    data: { operationName: op, variables, query }, timeout: 60_000,
  });
  const texto = await res.text();
  if (/\/login|auth\.uber\.com/i.test(texto) || res.status() === 401 || res.status() === 403) {
    throw new Error(`Sesión de Uber caducada (HTTP ${res.status()} en ${op}). Volver a correr "npm run export-uber-session" en el Mac y actualizar el secreto UBER_STORAGE_STATE.`);
  }
  if (!res.ok() || /"errors"/.test(texto)) {
    throw new Error(`${op} devolvió ${res.status()}: ${texto.slice(0, 300)}`);
  }
  return JSON.parse(texto) as T;
}

const traerJobs = async (api: APIRequestContext): Promise<ReportJob[]> => {
  const r = await graphql<{ data?: { reportJobs?: { reportJobs?: ReportJob[] } } }>(
    api, 'GetReportJobs', Q_JOBS, { limit: 10 });
  return r.data?.reportJobs?.reportJobs ?? [];
};

async function main() {
  const [argIni, argFin] = process.argv.slice(2);
  const fin = argFin ? desdeISO(argFin) : diasAtras(REZAGO_DIAS);
  const ini = argIni ? desdeISO(argIni) : diasAtras(REZAGO_DIAS + 7);
  if (ini < diasAtras(MAX_DIAS_ATRAS)) throw new Error(`Uber sólo acepta ${MAX_DIAS_ATRAS} días de historia`);
  if (fin > diasAtras(REZAGO_DIAS)) throw new Error(`Uber cierra los datos con ${REZAGO_DIAS} días de rezago`);

  fs.mkdirSync(OUT, { recursive: true, mode: 0o700 });
  const api = await abrirSesion();

  try {
    let jobs = await traerJobs(api);
    if (!jobs.length) throw new Error('GetReportJobs no devolvió informes: sin eso no se sabe qué tiendas pedir');

    // Las tiendas NO se hardcodean: salen del último informe listado.
    const tiendas = jobs[0]?.jobParams?.restaurantUUIDs ?? [];
    if (!tiendas.length) throw new Error('El último informe no trae restaurantUUIDs');

    const mismoRango = (j: ReportJob) =>
      j.reportTypes?.includes(TIPO)
      && j.jobParams?.startAtLocal === aLocal(ini)
      && j.jobParams?.endAtLocal === aLocal(fin);

    let job = jobs.find(j => mismoRango(j) && j.jobStatus !== 'REPORT_JOB_STATUS_EXPIRED');
    if (job) {
      log('uber.cloud.ya_pedido', { jobUUID: job.jobUUID, estado: job.jobStatus });
    } else {
      const jobUUID = crypto.randomUUID();
      await graphql(api, 'SubmitReportJob', M_SUBMIT, {
        submitReportJobInput: {
          jobUUID,
          reportTypes: [TIPO],
          jobParams: { restaurantUUIDs: tiendas, startAtLocal: aLocal(ini), endAtLocal: aLocal(fin), locale: LOCALE },
        },
      });
      log('uber.cloud.pedido', { jobUUID, tiendas: tiendas.length, periodo: `${aLocal(ini).slice(0, 10)}..${aLocal(fin).slice(0, 10)}` });
    }

    // Uber tarda minutos. Se espera acá porque el runner de GitHub es efímero:
    // si salimos sin el CSV, nadie vuelve a buscarlo hasta mañana.
    const esperaMax = Number(process.env.UBER_ESPERA_MAX_S ?? 900) * 1000;
    const limite = Date.now() + esperaMax;
    let intentos = 0;
    while (Date.now() < limite) {
      jobs = await traerJobs(api);
      job = jobs.find(j => mismoRango(j) && j.jobStatus === COMPLETADO);
      if (job) break;
      intentos++;
      log('uber.cloud.esperando', { intentos, restanteS: Math.round((limite - Date.now()) / 1000) });
      await dormir(30_000);
    }

    if (!job) {
      // No es un fallo del pipeline: mañana la ventana de 7 días vuelve a cubrir estas fechas.
      log('uber.cloud.sin_informe_aun', { esperadoS: esperaMax / 1000 });
      return;
    }

    const res = await api.get(`${BASE}/download-report?reportJobUUID=${job.jobUUID}`, { timeout: 120_000 });
    if (!res.ok()) throw new Error(`download-report devolvió ${res.status()} para ${job.jobUUID}`);
    const csv = await res.text();

    // El encabezado llega traducido y Uber cambia la traducción: acá sólo se verifica
    // que sea el informe correcto. El mapeo con alias lo hace import-uber-orders.
    const encabezado = csv.split(/\r?\n/, 1)[0] ?? '';
    if (!/(UUID|identificador).{0,60}pedido|Order UUID/i.test(encabezado)) {
      throw new Error(`La respuesta no parece el CSV de Historial de pedidos: ${csv.slice(0, 200)}`);
    }

    const destino = path.join(OUT, `${Date.now()}_${job.jobUUID}_order_history_local_v2_${aLocal(ini).slice(0, 10)}_${aLocal(fin).slice(0, 10)}.csv`);
    fs.writeFileSync(destino, csv, 'utf8');
    log('uber.cloud.descargado', {
      jobUUID: job.jobUUID, path: destino,
      filas: Math.max(0, csv.trim().split(/\r?\n/).length - 1),
    });
  } finally {
    await api.dispose();
  }
}

main().catch(error => {
  log('uber.cloud.error', { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
