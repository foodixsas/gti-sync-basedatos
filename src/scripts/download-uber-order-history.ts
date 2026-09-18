#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PROFILE = path.resolve(process.cwd(), 'tmp-uber-manager-profile');
const OUT = path.resolve(process.cwd(), 'tmp-uber-manager-probe');
fs.mkdirSync(OUT, { recursive: true, mode: 0o700 });

const TIPO_HISTORIAL = 'REPORT_TYPE_ORDER_HISTORY_REPORT';
const COMPLETADO = 'REPORT_JOB_STATUS_COMPLETED';

const waitHuman = (min = 500, max = 1200) => new Promise<void>(resolve =>
  setTimeout(resolve, Math.floor(min + Math.random() * (max - min))));

function log(ev: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));
}

type ReportJob = {
  jobUUID: string;
  createdAtUnixMs: string;
  jobStatus: string;
  reportTypes: string[];
  jobParams?: { startAtLocal?: string; endAtLocal?: string };
};

async function main() {
  // Corrida desatendida: no entrar siempre al mismo minuto ni al mismo segundo.
  if (process.env.UBER_JITTER_MS) {
    const jitter = Math.floor(Math.random() * Number(process.env.UBER_JITTER_MS));
    log('uber.order_history.jitter', { esperaMs: jitter });
    await new Promise(r => setTimeout(r, jitter));
  }

  const browser = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: false, viewport: null,
    locale: 'es-EC', timezoneId: 'America/Guayaquil', acceptDownloads: true,
    args: ['--start-maximized'],
  });
  const page = await browser.newPage();

  // La lista de informes la sirve esta operación GraphQL. Es la fuente del jobUUID.
  // NO se hace clic en "Descargar archivo CSV": ese botón abre una pestaña que al
  // cerrarse se lleva el navegador entero (verificado 18-sep, el contexto muere ~0,5 s
  // después del download). Con el UUID se baja el CSV por HTTP y no hay pestaña.
  let jobs: ReportJob[] | null = null;
  page.on('response', async r => {
    if (!/op=GetReportJobs/.test(r.url()) || jobs) return;
    try {
      const cuerpo = await r.json();
      jobs = cuerpo?.data?.reportJobs?.reportJobs ?? null;
    } catch (e) {
      log('uber.order_history.jobs_ilegibles', { message: e instanceof Error ? e.message : String(e) });
    }
  });

  try {
    await page.goto('https://merchants.ubereats.com/manager/reports', {
      waitUntil: 'domcontentloaded', timeout: 60_000,
    });
    await waitHuman(2500, 4500);

    if (/\/login|auth\.uber\.com/i.test(page.url())) {
      throw new Error(`Sesión de Uber caducada: el portal redirigió a ${page.url()}. Relogear el perfil corriendo "npm run download-uber-orders" y completando el login a mano.`);
    }

    // Un visitante real mira la página antes de bajar nada.
    await page.mouse.move(400 + Math.random() * 300, 300 + Math.random() * 200);
    await page.mouse.wheel(0, 200 + Math.random() * 300);
    await waitHuman(1200, 2600);

    const limite = Date.now() + 25_000;
    while (!jobs && Date.now() < limite) await new Promise(r => setTimeout(r, 500));
    if (!jobs) throw new Error('El portal cargó pero nunca respondió GetReportJobs — revisar si cambió la operación GraphQL');

    fs.writeFileSync(path.join(OUT, 'reports-page.txt'), (await page.locator('body').innerText()).slice(0, 50_000));

    const historial = (jobs as ReportJob[])
      .filter(j => j.reportTypes?.includes(TIPO_HISTORIAL) && j.jobStatus === COMPLETADO)
      .sort((a, b) => Number(b.createdAtUnixMs) - Number(a.createdAtUnixMs));

    log('uber.order_history.jobs', {
      total: (jobs as ReportJob[]).length,
      historialCompletados: historial.length,
      // Los informes de Uber expiran: si esto llega a 0 es que no hay uno recurrente.
      tipos: [...new Set((jobs as ReportJob[]).flatMap(j => j.reportTypes.map(t => t.replace('REPORT_TYPE_', ''))))],
    });

    if (!historial.length) {
      throw new Error('No hay ningún informe "Historial de pedidos" vigente (los de Uber expiran a los ~2 días). Hace falta un informe programado recurrente en Informes > Programado.');
    }

    const job = historial[0];
    const desde = (job.jobParams?.startAtLocal ?? '').slice(0, 10);
    const hasta = (job.jobParams?.endAtLocal ?? '').slice(0, 10);

    await waitHuman();
    const url = `https://merchants.ubereats.com/manager/download-report?reportJobUUID=${job.jobUUID}`;
    const respuesta = await page.request.get(url, { timeout: 60_000 });
    if (!respuesta.ok()) {
      throw new Error(`download-report devolvió ${respuesta.status()} para el job ${job.jobUUID}`);
    }
    const csv = await respuesta.text();
    // El encabezado llega traducido y Uber cambia la traducción sin avisar: ya se vio
    // "UUID del pedido" y "Identificador único universal (UUID) del pedido" para la
    // misma columna. Acá sólo se comprueba que sea el informe correcto; el mapeo de
    // columnas con sus alias lo hace import-uber-order-history.ts.
    const encabezado = csv.split(/\r?\n/, 1)[0] ?? '';
    if (!/(UUID|identificador).{0,60}pedido|Order UUID/i.test(encabezado)) {
      throw new Error(`La respuesta no parece el CSV de Historial de pedidos (primeros 200 chars: ${csv.slice(0, 200)})`);
    }

    const target = path.join(OUT, `${Date.now()}_${job.jobUUID}_order_history_local_v2_${desde}_${hasta}.csv`);
    fs.writeFileSync(target, csv, 'utf8');
    fs.writeFileSync(path.join(OUT, 'order-history-preview.txt'), csv.slice(0, 12_000));

    log('uber.order_history.downloaded', {
      jobUUID: job.jobUUID, path: target, periodo: `${desde}..${hasta}`,
      creadoEl: new Date(Number(job.createdAtUnixMs)).toISOString(),
      filas: Math.max(0, csv.trim().split(/\r?\n/).length - 1),
    });
  } catch (error) {
    await page.screenshot({ path: path.join(OUT, 'reports-page.png'), fullPage: false }).catch(() => {});
    log('uber.order_history.error', {
      url: page.url(), message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch(error => {
  log('uber.order_history.fatal', { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
