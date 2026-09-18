#!/usr/bin/env tsx
/**
 * Pide a Uber Eats Manager un informe "Historial de pedidos".
 *
 * Por qué existe: los informes de Uber expiran a los ~2 días y la cuenta no tiene
 * ninguno recurrente configurado. Sin este paso, la descarga diaria se queda sin
 * fuente. Antes esto se hacía a mano desde Informes > Crear un reporte.
 *
 * No se usa la UI: se llama la misma mutación GraphQL que dispara el portal
 * (`SubmitReportJob`), con el formato leído del bundle del propio Uber Manager.
 * Límites del informe según ese bundle: startDateOffset 188 días, endDateOffset 2
 * (Uber cierra los datos con 2 días de rezago).
 *
 * Uso:  npm run request-uber-orders                              → últimos 7 días disponibles
 *       npm run request-uber-orders 2026-06-01 2026-06-30        → rango explícito (backfill)
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';

const PROFILE = path.resolve(process.cwd(), 'tmp-uber-manager-profile');
const TIPO = 'REPORT_TYPE_ORDER_HISTORY_REPORT';
const MAX_DIAS_ATRAS = 188;
const REZAGO_DIAS = 2;
const LOCALE = 'es-419';

const MUTACION = 'mutation SubmitReportJob($submitReportJobInput: SubmitReportJobInput!) {\n  submitReportJob(submitReportJobInput: $submitReportJobInput) {\n    status\n    message\n  }\n}\n';

const log = (ev: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));

const waitHuman = (min = 600, max = 1500) => new Promise<void>(r =>
  setTimeout(r, Math.floor(min + Math.random() * (max - min))));

/** Uber espera 'YYYY-MM-DDT00:00:00' en hora local del negocio, sin zona. */
const aLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
/** Nunca `new Date("YYYY-MM-DD")`: eso parsea UTC y en Ecuador resta un día. */
const desdeISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

type ReportJob = {
  jobUUID: string;
  jobStatus: string;
  reportTypes: string[];
  jobParams?: { restaurantUUIDs?: string[]; startAtLocal?: string; endAtLocal?: string };
};

async function main() {
  const [argIni, argFin] = process.argv.slice(2);
  const fin = argFin ? desdeISO(argFin) : diasAtras(REZAGO_DIAS);
  const ini = argIni ? desdeISO(argIni) : diasAtras(REZAGO_DIAS + 7);

  if (ini < diasAtras(MAX_DIAS_ATRAS)) {
    throw new Error(`Uber sólo acepta ${MAX_DIAS_ATRAS} días de historia; ${aLocal(ini).slice(0, 10)} queda fuera`);
  }
  if (fin > diasAtras(REZAGO_DIAS)) {
    throw new Error(`Uber cierra los datos con ${REZAGO_DIAS} días de rezago; ${aLocal(fin).slice(0, 10)} todavía no está disponible`);
  }

  const browser = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: false, viewport: null,
    locale: 'es-EC', timezoneId: 'America/Guayaquil',
  });
  const page = await browser.newPage();

  // Las tiendas NO se hardcodean: se toman del último informe que el portal ya lista.
  let jobs: ReportJob[] | null = null;
  let headers: Record<string, string> | null = null;
  page.on('request', r => { if (/op=GetReportJobs/.test(r.url()) && !headers) headers = r.headers(); });
  page.on('response', async r => {
    if (!/op=GetReportJobs/.test(r.url()) || jobs) return;
    try { jobs = (await r.json())?.data?.reportJobs?.reportJobs ?? null; }
    catch (e) { log('uber.request.jobs_ilegibles', { message: e instanceof Error ? e.message : String(e) }); }
  });

  try {
    await page.goto('https://merchants.ubereats.com/manager/reports', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (/\/login|auth\.uber\.com/i.test(page.url())) {
      throw new Error(`Sesión de Uber caducada: el portal redirigió a ${page.url()}`);
    }

    const limite = Date.now() + 30_000;
    while (!jobs && Date.now() < limite) await new Promise(r => setTimeout(r, 500));
    // `jobs` lo llena un listener, así que TypeScript lo estrecha a never tras el bucle.
    const lista = jobs as ReportJob[] | null;
    if (!lista?.length) throw new Error('GetReportJobs no devolvió informes: sin eso no se sabe qué tiendas pedir');

    const tiendas = lista[0]?.jobParams?.restaurantUUIDs ?? [];
    if (!tiendas.length) throw new Error('El último informe no trae restaurantUUIDs');

    // Idempotencia: si ya hay un informe vivo para ese mismo rango, no se pide otro.
    const yaExiste = lista.find(j =>
      j.reportTypes?.includes(TIPO)
      && j.jobStatus !== 'REPORT_JOB_STATUS_EXPIRED'
      && j.jobParams?.startAtLocal === aLocal(ini)
      && j.jobParams?.endAtLocal === aLocal(fin));
    if (yaExiste) {
      log('uber.request.ya_pedido', {
        jobUUID: yaExiste.jobUUID, estado: yaExiste.jobStatus,
        periodo: `${aLocal(ini).slice(0, 10)}..${aLocal(fin).slice(0, 10)}`,
      });
      return;
    }

    const input = {
      jobUUID: crypto.randomUUID(),
      reportTypes: [TIPO],
      jobParams: {
        restaurantUUIDs: tiendas,
        startAtLocal: aLocal(ini),
        endAtLocal: aLocal(fin),
        // OJO: 'es' (España) devuelve otros encabezados ("Restaurante", "Código del
        // pedido") y el import no los reconoce. El portal usa es-419 (Latinoamérica),
        // que es el que produce "Tienda" / "ID del pedido".
        locale: LOCALE,
      },
    };

    await waitHuman();
    const res = await page.request.post('https://merchants.ubereats.com/manager/graphql?op=SubmitReportJob', {
      headers: { 'content-type': 'application/json', 'x-csrf-token': String(headers?.['x-csrf-token'] ?? 'x') },
      data: { operationName: 'SubmitReportJob', variables: { submitReportJobInput: input }, query: MUTACION },
      timeout: 60_000,
    });
    const cuerpo = await res.text();
    if (!res.ok() || /"errors"/.test(cuerpo)) {
      throw new Error(`SubmitReportJob devolvió ${res.status()}: ${cuerpo.slice(0, 400)}`);
    }

    log('uber.request.pedido', {
      jobUUID: input.jobUUID,
      tiendas: tiendas.length,
      periodo: `${aLocal(ini).slice(0, 10)}..${aLocal(fin).slice(0, 10)}`,
      respuesta: cuerpo.slice(0, 200),
    });
  } catch (error) {
    log('uber.request.error', { url: page.url(), message: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch(error => {
  log('uber.request.fatal', { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
