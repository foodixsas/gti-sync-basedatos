#!/usr/bin/env tsx
/**
 * Exporta la sesión de Uber Eats Manager del perfil Chrome local a un JSON de
 * cookies, y comprueba que ese JSON sirve SIN navegador.
 *
 * Para qué: el pipeline no puede depender del Mac de Daniel encendido. Con la
 * descarga por API (GetReportJobs + SubmitReportJob + download-report) ya no hace
 * falta un navegador: alcanzan las cookies. Este script las saca del perfil para
 * cargarlas como secreto en GitHub Actions.
 *
 * Uso:  npm run export-uber-session
 * Salida: uber-storage-state.json (gitignored — contiene la sesión, tratarlo como credencial)
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, request as playwrightRequest } from 'playwright';

const PROFILE = path.resolve(process.cwd(), 'tmp-uber-manager-profile');
const DESTINO = path.resolve(process.cwd(), 'uber-storage-state.json');

const log = (ev: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));

async function main() {
  const browser = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: false, viewport: null,
    locale: 'es-EC', timezoneId: 'America/Guayaquil',
  });
  let estado: Awaited<ReturnType<typeof browser.storageState>>;
  try {
    const page = await browser.newPage();
    await page.goto('https://merchants.ubereats.com/manager/reports', {
      waitUntil: 'domcontentloaded', timeout: 60_000,
    });
    if (/\/login|auth\.uber\.com/i.test(page.url())) {
      throw new Error(`La sesión del perfil ya no sirve: el portal redirigió a ${page.url()}. Hay que volver a loguearse a mano.`);
    }
    await page.waitForTimeout(6000);
    estado = await browser.storageState();
  } finally {
    await browser.close().catch(() => {});
  }

  fs.writeFileSync(DESTINO, JSON.stringify(estado), { mode: 0o600 });

  const cookies = estado.cookies.filter(c => /uber/i.test(c.domain));
  const vencimientos = cookies.map(c => c.expires).filter(e => e && e > 0) as number[];
  const masCercano = vencimientos.length ? new Date(Math.min(...vencimientos) * 1000) : null;
  const masLejano = vencimientos.length ? new Date(Math.max(...vencimientos) * 1000) : null;

  // La prueba que importa: usar esas cookies SIN navegador.
  const ctx = await playwrightRequest.newContext({ storageState: DESTINO });
  const res = await ctx.post('https://merchants.ubereats.com/manager/graphql?op=GetReportJobs', {
    headers: { 'content-type': 'application/json', 'x-csrf-token': 'x' },
    data: {
      operationName: 'GetReportJobs',
      variables: { limit: 10 },
      query: 'query GetReportJobs($limit: Int) {\n  reportJobs(limit: $limit) {\n    reportJobs {\n      jobUUID\n      jobStatus\n      reportTypes\n      createdAtUnixMs\n      jobParams {\n        restaurantUUIDs\n        startAtLocal\n        endAtLocal\n      }\n    }\n  }\n}\n',
    },
    timeout: 60_000,
  });
  const cuerpo = await res.text();
  await ctx.dispose();

  const sirve = res.ok() && /reportJobs/.test(cuerpo) && !/"errors"/.test(cuerpo);
  log('uber.session.exportada', {
    archivo: DESTINO,
    cookiesUber: cookies.length,
    venceLaPrimera: masCercano?.toISOString() ?? null,
    venceLaUltima: masLejano?.toISOString() ?? null,
    sinNavegadorFunciona: sirve,
    statusHttp: res.status(),
    respuesta: sirve ? undefined : cuerpo.slice(0, 300),
  });
  if (!sirve) process.exitCode = 1;
}

main().catch(error => {
  log('uber.session.error', { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
