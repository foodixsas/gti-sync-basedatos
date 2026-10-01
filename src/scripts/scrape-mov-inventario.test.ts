/**
 * Pruebas de la cola de relecturas (--pendientes).
 * Correr:  SCRAPE_NO_MAIN=1 npx tsx --test src/scripts/scrape-mov-inventario.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anotarSlice, buildSlicesPendientes, exportUrl, nuevoSeguimiento } from './scrape-mov-inventario';

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
