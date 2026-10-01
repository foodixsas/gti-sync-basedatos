/**
 * Pruebas de la cola de relecturas (--pendientes).
 * Correr:  SCRAPE_NO_MAIN=1 npx tsx --test src/scripts/scrape-mov-inventario.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anotarSlice, buildSlices, buildSlicesPendientes, confirmarExportVacio, exportUrl, nuevoSeguimiento,
  type DepsTestigo, type Lectura, type ResultadoCommit,
} from './scrape-mov-inventario';

const iso = (d: Date) => d.toISOString().slice(0, 10);

test('cada día pendiente lleva sus propios slices, aunque no sean contiguos', () => {
  const slices = buildSlicesPendientes(['2026-03-12', '2026-07-30'], undefined, 'EGR:');
  // 4 tipos × (Todos + 7 orígenes) = 32, menos EGR:Todos (ventas POS, pesado) = 31 por día.
  assert.equal(slices.length, 62);
  assert.equal(slices.filter((s) => s.heavy).length, 0);
  assert.equal(slices.filter((s) => s.tipo === 'EGR' && s.origen === '').length, 0);
  for (const s of slices) assert.equal(iso(s.desde), iso(s.hasta), 'un slice de relectura cubre un solo día');
  // Agrupados por día y en el orden pedido: el día se puede cerrar al terminar su último slice.
  assert.deepEqual(slices.slice(0, 31).map((s) => iso(s.desde)), Array(31).fill('2026-03-12'));
  assert.deepEqual(slices.slice(31).map((s) => iso(s.desde)), Array(31).fill('2026-07-30'));
  // La fecha llega a Contifico en DD/MM/YYYY y sin correrse un día (UTC-5).
  assert.match(exportUrl(slices[0]), /fecha_inicio=12%2F03%2F2026&fecha_fin=12%2F03%2F2026/);
});

test('sin --sin, el día incluye también las ventas POS', () => {
  const slices = buildSlicesPendientes(['2026-03-12']);
  assert.equal(slices.length, 32);
  assert.equal(slices.filter((s) => s.heavy).length, 1);
});

test('un día se cierra solo con su último slice, y bien solo si no falló ninguno', () => {
  const slices = buildSlicesPendientes(['2026-03-12', '2026-07-30'], undefined, 'EGR:');
  const seg = nuevoSeguimiento(slices);
  assert.equal(seg.get('2026-03-12')?.total, 31);
  assert.equal(seg.get('2026-07-30')?.total, 31);

  // Día 1: todos los slices bien → no se cierra hasta el último.
  for (let i = 0; i < 30; i++) assert.equal(anotarSlice(seg, slices[i], true), null);
  assert.deepEqual(anotarSlice(seg, slices[30], true), { fecha: '2026-03-12', ok: true });

  // Día 2: un solo slice falla → el día se cierra como fallido (sigue en la cola).
  assert.equal(anotarSlice(seg, slices[31], false), null);
  for (let i = 32; i < 61; i++) assert.equal(anotarSlice(seg, slices[i], true), null);
  assert.deepEqual(anotarSlice(seg, slices[61], true), { fecha: '2026-07-30', ok: false });
});

test('un día interrumpido queda a medias: ni cerrado ni dado por bueno', () => {
  const slices = buildSlicesPendientes(['2026-03-12'], undefined, 'EGR:');
  const seg = nuevoSeguimiento(slices);
  for (let i = 0; i < 10; i++) anotarSlice(seg, slices[i], true);
  const e = seg.get('2026-03-12')!;
  assert.equal(e.procesados, 10);
  assert.ok(e.procesados > 0 && e.procesados < e.total, 'se reconoce como interrumpido');
});

// ─── Guarda de export vacío: comprobación con testigo ──────────────────────
// Caso real del 01-oct-2026: Contabilidad borró en Contifico el ajuste AJU 202609000385 (22-sep). El
// export de ese día llega vacío, la base lo tiene vivo y la guarda no dejaba cerrar el día.
type Fila = { codigo: string };
const lectura = (codigos: string[]): Lectura<Fila> => ({ rows: codigos.map((codigo) => ({ codigo })), status: 200, bytes: 5632, extraCols: [], durMs: 10 });
const BLOQUEO: ResultadoCommit = { ok: false, necesita_testigo: true, vivos: 1, motivo: 'export vacío sospechoso: 0 docs en el export y 1 docs vivos' };

/** Un Contifico de mentira: qué documentos devuelve el export de cada día, y una base que aplica la guarda. */
function escenario(opts: {
  exportPorDia: Record<string, string[] | null>;                 // null = el GET falla
  candidatos?: Array<{ codigo: string; fecha: string }>;
  errorCandidatos?: string;
  /** Lo que el export del rango sospechoso devuelve la SEGUNDA vez (por defecto, lo mismo que la primera). */
  segundaLectura?: string[] | null;
}) {
  const bajadas: string[] = [];
  const commits: Array<{ dia: string; filas: number; meta: Record<string, unknown> }> = [];
  const vistosPorLaCorrida = new Set<string>();
  const veces = new Map<string, number>();
  const deps: DepsTestigo<Fila> = {
    buscarTestigos: async () => opts.errorCandidatos ? { testigos: [], error: opts.errorCandidatos } : { testigos: opts.candidatos ?? [] },
    bajar: async (s) => {
      const dia = s.desde.toISOString().slice(0, 10);
      bajadas.push(dia);
      const n = (veces.get(dia) ?? 0) + 1; veces.set(dia, n);
      const r = dia === SOSPECHOSO && opts.segundaLectura !== undefined ? opts.segundaLectura : opts.exportPorDia[dia];
      return r === null || r === undefined ? null : lectura(r);
    },
    guardar: async (s, l, meta) => {
      const dia = s.desde.toISOString().slice(0, 10);
      commits.push({ dia, filas: l.rows.length, meta });
      if (l.rows.length > 0) { l.rows.forEach((r) => vistosPorLaCorrida.add(r.codigo)); return { data: { ok: true, filas: l.rows.length, docs: l.rows.length, borrados: 0 }, error: null }; }
      // Export vacío con documentos vivos: la base solo lo acepta si el testigo citado lo vio ESTA corrida.
      const t = meta.testigo as { codigo: string } | undefined;
      if (t && vistosPorLaCorrida.has(t.codigo)) return { data: { ok: true, filas: 0, docs: 0, borrados: 1, confirmado_con_testigo: t.codigo }, error: null };
      return { data: { ok: false, motivo: 'export vacío sospechoso: 0 docs en el export y 1 docs vivos', vivos: 1 }, error: null };
    },
    pausa: async () => {},
    log: () => {},
  };
  return { deps, bajadas, commits };
}
const SOSPECHOSO = '2026-09-22';
const sliceAJU = () => buildSlices(new Date(Date.UTC(2026, 8, 22)), new Date(Date.UTC(2026, 8, 22)), 'AJU:')[0];

test('el testigo aparece y el rango sigue vacío: el borrado es real y el slice queda bien', async () => {
  const e = escenario({
    exportPorDia: { '2026-03-12': ['AJU 202603000146', 'AJU 202603000105'], [SOSPECHOSO]: [] },
    candidatos: [{ codigo: 'AJU 202603000146', fecha: '2026-03-12' }],
  });
  const r = await confirmarExportVacio(sliceAJU(), lectura([]), BLOQUEO, e.deps);
  assert.equal(r.ok, true);
  assert.equal(r.borrados, 1);
  assert.equal(r.confirmado_con_testigo, 'AJU 202603000146');
  // Orden del protocolo: primero el día del testigo, después otra vez el rango sospechoso.
  assert.deepEqual(e.bajadas, ['2026-03-12', SOSPECHOSO]);
  assert.deepEqual(e.commits.map((c) => c.dia), ['2026-03-12', SOSPECHOSO]);
  assert.deepEqual(e.commits[1].meta.testigo, { codigo: 'AJU 202603000146', fecha: '2026-03-12' });
  // El commit que cita al testigo ya no es un sondeo: si la base lo rechaza, tiene que quedar asentado.
  assert.equal(e.commits[1].meta.sondeo, undefined);
});

test('fallo del portal (06-sep-2026): ningún testigo aparece, así que no se da de baja nada', async () => {
  const e = escenario({
    exportPorDia: { '2026-03-12': [], '2026-03-10': [], [SOSPECHOSO]: [] },
    candidatos: [{ codigo: 'AJU 202603000146', fecha: '2026-03-12' }, { codigo: 'AJU 202603000145', fecha: '2026-03-10' }],
  });
  const r = await confirmarExportVacio(sliceAJU(), lectura([]), BLOQUEO, e.deps);
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? '', /ningún testigo apareció/);
  assert.match(r.motivo ?? '', /2026-03-12, 2026-03-10/);
  // El último commit es el del rango sospechoso SIN testigo: es el que deja ok=false en sync_log.
  const ultimo = e.commits[e.commits.length - 1];
  assert.equal(ultimo.dia, SOSPECHOSO);
  assert.equal(ultimo.meta.testigo, undefined);
  assert.match(String(ultimo.meta.testigo_fallo), /ningún testigo apareció/);
});

test('el primer candidato ya no existe y el segundo sí: se usa el segundo', async () => {
  const e = escenario({
    exportPorDia: { '2026-09-19': [], '2026-09-14': ['AJU 202609000131'], [SOSPECHOSO]: [] },
    candidatos: [{ codigo: 'AJU 202609000422', fecha: '2026-09-19' }, { codigo: 'AJU 202609000131', fecha: '2026-09-14' }],
  });
  const r = await confirmarExportVacio(sliceAJU(), lectura([]), BLOQUEO, e.deps);
  assert.equal(r.ok, true);
  assert.equal(r.confirmado_con_testigo, 'AJU 202609000131');
  assert.deepEqual(e.bajadas, ['2026-09-19', '2026-09-14', SOSPECHOSO]);
});

test('el testigo es lo que el export devolvió, no el candidato: sirve aunque el candidato ya no esté', async () => {
  const e = escenario({
    exportPorDia: { '2026-03-12': ['AJU 202603000105'], [SOSPECHOSO]: [] },
    candidatos: [{ codigo: 'AJU 202603000146', fecha: '2026-03-12' }],
  });
  const r = await confirmarExportVacio(sliceAJU(), lectura([]), BLOQUEO, e.deps);
  assert.equal(r.ok, true);
  assert.equal(r.confirmado_con_testigo, 'AJU 202603000105');
});

test('vacío pasajero: al volver a leer el rango llegan filas y se guardan como cualquier slice', async () => {
  const e = escenario({
    exportPorDia: { '2026-03-12': ['AJU 202603000146'], [SOSPECHOSO]: [] },
    candidatos: [{ codigo: 'AJU 202603000146', fecha: '2026-03-12' }],
    segundaLectura: ['AJU 202609000385'],
  });
  const r = await confirmarExportVacio(sliceAJU(), lectura([]), BLOQUEO, e.deps);
  assert.equal(r.ok, true);
  assert.equal(r.filas, 1);
  assert.equal(r.borrados, 0);
});

test('sin candidatos, o sin poder buscarlos, el slice queda bloqueado y dice por qué', async () => {
  const sin = escenario({ exportPorDia: { [SOSPECHOSO]: [] }, candidatos: [] });
  const r1 = await confirmarExportVacio(sliceAJU(), lectura([]), BLOQUEO, sin.deps);
  assert.equal(r1.ok, false);
  assert.match(r1.motivo ?? '', /no hay otro documento vivo/);
  assert.equal(sin.bajadas.length, 0);

  const err = escenario({ exportPorDia: { [SOSPECHOSO]: [] }, errorCandidatos: 'permission denied' });
  const r2 = await confirmarExportVacio(sliceAJU(), lectura([]), BLOQUEO, err.deps);
  assert.equal(r2.ok, false);
  assert.match(r2.motivo ?? '', /permission denied/);
});

test('el testigo aparece pero el rango no se puede volver a leer: bloqueado (nunca se asume)', async () => {
  const e = escenario({
    exportPorDia: { '2026-03-12': ['AJU 202603000146'], [SOSPECHOSO]: [] },
    candidatos: [{ codigo: 'AJU 202603000146', fecha: '2026-03-12' }],
    segundaLectura: null,
  });
  const r = await confirmarExportVacio(sliceAJU(), lectura([]), BLOQUEO, e.deps);
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? '', /no se pudo volver a leer/);
});

test('las ventas POS de un día (slice pesado) no se comprueban con testigo', async () => {
  const pesado = buildSlices(new Date(Date.UTC(2026, 8, 22)), new Date(Date.UTC(2026, 8, 22)), 'EGR:')[0];
  assert.equal(pesado.heavy, true);
  const e = escenario({ exportPorDia: {}, candidatos: [{ codigo: 'EGR 1', fecha: '2026-09-21' }] });
  const r = await confirmarExportVacio(pesado, lectura([]), BLOQUEO, e.deps);
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? '', /slice pesado/);
  assert.equal(e.bajadas.length, 0);
});
