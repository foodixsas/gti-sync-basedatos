#!/usr/bin/env tsx
/**
 * Carga en Supabase los informes de Operaciones, Opiniones y Detalles de pago
 * de Uber Eats.
 *
 * Lee los CSV de una carpeta (por defecto tmp-uber-manager-probe/muestras),
 * nombrados `<REPORT_TYPE_...>.csv`, y manda cada uno a su tabla.
 *
 * Igual que el importador de pedidos: las columnas se resuelven por lista de
 * alias y comparando sin acentos, porque Uber traduce los encabezados y cambia
 * la traducción sin avisar. Si una columna clave no aparece, aborta en vez de
 * guardar NULLs.
 *
 * Uso:  npm run import-uber-reports [carpeta]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const CARPETA = path.resolve(process.cwd(), process.argv[2] || 'tmp-uber-manager-probe/informes');

const log = (ev: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ev, ts: new Date().toISOString(), ...data }));

const clean = (v: unknown) => String(v ?? '').replace(/^﻿/, '').trim();
const txt = (v: unknown) => clean(v) || null;
const num = (v: unknown) => { const n = Number(clean(v).replace(/[^0-9.,-]/g, '').replace(',', '.')); return Number.isFinite(n) && clean(v) !== '' ? n : null; };
const fecha = (v: unknown) => { const s = clean(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null; };
const ts = (v: unknown) => { const s = clean(v); return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) ? s.slice(0, 19).replace('T', ' ') : null; };
/** El informe de pagos trae la fecha como dd/mm/aa ('15/09/26'). */
const fechaCorta = (v: unknown) => {
  const m = clean(v).match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : fecha(v);
};
const uuid = (v: unknown) => { const s = clean(v); return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) ? s : null; };

/** Uber manda las tildes en NFD: 'único' del archivo no es igual a 'único' escrito acá. */
const norm = (k: string) => k.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

type Fila = Record<string, unknown>;
type Buscador = (...alias: string[]) => unknown;

/** Las 6 columnas de tienda vienen en todos los informes. */
const tiendaDe = (c: Buscador) => ({
  tienda: clean(c('Restaurante', 'Tienda')),
  tienda_codigo_externo: txt(c('Código externo del restaurante', 'ID de tienda externa')),
  tienda_uuid: uuid(c('UUID de la tienda', 'UUID del negocio')),
  pais: txt(c('País')),
  pais_codigo: txt(c('Código del país', 'Código de país')),
  ciudad: txt(c('Ciudad')),
});

type Definicion = {
  tabla: string;
  conflicto: string;
  /** columnas cuyo valor vacío significa que el encabezado cambió */
  obligatorias: string[];
  /** filas a saltar antes del encabezado real (pagos trae una fila de descripciones arriba) */
  saltarFilas?: number;
  /** encabezados que deben existir: montos donde un vacío (0) no delataría el renombre */
  encabezados?: string[];
  fila: (c: Buscador, cruda: Fila) => Record<string, unknown>;
};

const DEFINICIONES: Record<string, Definicion> = {
  REPORT_TYPE_INACCURATE_ORDERS_REPORT: {
    tabla: 'uber_pedidos_errores', conflicto: 'fuente,flujo_uuid', obligatorias: ['tienda', 'flujo_uuid'],
    fila: (c, cruda) => ({
      ...tiendaDe(c), fuente: 'precision_pedido',
      pedido_codigo: clean(c('Código del pedido', 'ID del pedido')),
      flujo_uuid: uuid(c('Identificador universal (UUID) del flujo de trabajo', 'UUID del flujo de trabajo')),
      pedido_at: ts(c('Hora del pedido del cliente')),
      aceptado_at: ts(c('Hora en que el comercio aceptó', 'Hora de aceptación del comercio')),
      reembolso_at: ts(c('Hora del reembolso al cliente')),
      problema: txt(c('Problema con el pedido')),
      problema_detalle: txt(c('Detalles del problema con el artículo')),
      articulos_con_error: txt(c('Artículos incorrectos')),
      personalizaciones_erroneas: txt(c('Personalizaciones incorrectas')),
      comentario_cliente: txt(c('Comentarios de los clientes')),
      moneda: txt(c('Código de la divisa', 'Código de divisa')),
      monto_recibo: num(c('Valor del recibo')),
      reembolsado_cliente: num(c('Reembolsado al cliente')),
      reembolso_cubierto_local: num(c('Reembolso cubierto por el establecimiento')),
      reembolso_no_cubierto: num(c('Reembolso no cubierto por el establecimiento')),
      tipo_cumplimiento: txt(c('Tipo de cumplimiento', 'Tipo de cumplimentación')),
      canal: txt(c('Canal de pedido', 'Canal de pedidos')),
      fila_cruda: cruda,
    }),
  },
  REPORT_TYPE_ORDERS_WITH_ERRORS_REPORT: {
    tabla: 'uber_pedidos_errores', conflicto: 'fuente,flujo_uuid', obligatorias: ['tienda', 'flujo_uuid'],
    fila: (c, cruda) => ({
      ...tiendaDe(c), fuente: 'pedidos_con_errores',
      pedido_codigo: clean(c('Código del pedido', 'ID del pedido')),
      pedido_uuid: uuid(c('Identificador único universal (UUID) del pedido', 'UUID del pedido')),
      flujo_uuid: uuid(c('Identificador universal (UUID) del flujo de trabajo', 'UUID del flujo de trabajo')),
      pedido_at: ts(c('Hora del pedido del cliente')),
      aceptado_at: ts(c('Hora en que el comercio aceptó', 'Hora de aceptación del comercio')),
      completado_at: ts(c('Hora de finalización del pedido')),
      reembolso_at: ts(c('Hora del reembolso al cliente')),
      problema: txt(c('Problema con el pedido')),
      problema_detalle: txt(c('Detalles del problema con el artículo')),
      articulos_con_error: txt(c('Artículos con error')),
      personalizaciones_erroneas: txt(c('Personalizaciones incorrectas')),
      comentario_cliente: txt(c('Comentarios de los clientes')),
      moneda: txt(c('Código de la divisa', 'Código de divisa')),
      monto_recibo: num(c('Valor del recibo')),
      reembolsado_cliente: num(c('Reembolsado al cliente')),
      cargo_por_error: num(c('Cargo por error en el pedido')),
      reembolso_no_cubierto: num(c('Reembolso no cubierto por el establecimiento')),
      tipo_cumplimiento: txt(c('Tipo de cumplimiento', 'Tipo de cumplimentación')),
      canal: txt(c('Canal de pedidos', 'Canal de pedido')),
      marca_uber: txt(c('Marca de Uber Eats')),
      fila_cruda: cruda,
    }),
  },
  REPORT_TYPE_ITEMS_WITH_ERRORS_REPORT: {
    tabla: 'uber_articulos_errores', conflicto: 'flujo_uuid,articulo_nombre,problema_articulo',
    obligatorias: ['tienda', 'flujo_uuid', 'articulo_nombre'],
    fila: (c, cruda) => ({
      ...tiendaDe(c),
      flujo_uuid: uuid(c('Identificador universal (UUID) del flujo de trabajo')),
      pedido_codigo: txt(c('Código del pedido')),
      pedido_uuid: uuid(c('Identificador único universal (UUID) del pedido')),
      pedido_at: ts(c('Hora del pedido del cliente')),
      aceptado_at: ts(c('Hora en que el comercio aceptó')),
      completado_at: ts(c('Hora de finalización del pedido')),
      reembolso_at: ts(c('Hora del reembolso al cliente')),
      articulo_nombre: clean(c('Nombre del artículo')),
      articulo_id_externo: txt(c('Id. de artículo externo')),
      articulo_datos_externos: txt(c('Datos externos')),
      problema_pedido: txt(c('Problema con el pedido')),
      // Parte del conflicto: nunca null, si no el upsert duplica.
      problema_articulo: clean(c('Problema con el artículo')) || 'sin_detalle',
      personalizaciones_erroneas: txt(c('Personalizaciones incorrectas')),
      comentario_articulo: txt(c('Comentarios sobre el artículo')),
      cantidad_reembolsada: num(c('Cantidad reembolsada del artículo')),
      moneda: txt(c('Código de la divisa')),
      precio_incorrecto: num(c('Precio incorrecto del artículo')),
      tipo_cumplimiento: txt(c('Tipo de cumplimiento')),
      canal: txt(c('Canal de pedidos')),
      marca_uber: txt(c('Marca de Uber Eats')),
      fila_cruda: cruda,
    }),
  },
  REPORT_TYPE_EATER_COURIER_RATING_REPORT: {
    tabla: 'uber_calificaciones_pedido', conflicto: 'pedido_codigo,calificacion_tipo,calificacion_at',
    obligatorias: ['tienda', 'pedido_codigo'],
    fila: (c, cruda) => ({
      ...tiendaDe(c),
      pedido_codigo: clean(c('Código del pedido')),
      pedido_uuid: uuid(c('Identificador único universal (UUID) del pedido')),
      pedido_fecha: fecha(c('Fecha del pedido')),
      pedido_at: ts(c('Hora del pedido del cliente')),
      completado_at: ts(c('Hora de finalización del pedido')),
      calificacion_fecha: fecha(c('Fecha de calificación')),
      calificacion_at: ts(c('Hora de calificación')),
      calificacion_tipo: clean(c('Tipo de calificación')) || 'sin_tipo',
      calificacion_valor: txt(c('Valor de calificación')),
      calificacion_etiquetas: txt(c('Etiquetas de calificación')),
      comentario: txt(c('Comentario')),
      tipo_cumplimiento: txt(c('Tipo de cumplimiento')),
      canal: txt(c('Canal de pedidos')),
      marca_uber: txt(c('Marca de Uber Eats')),
      fila_cruda: cruda,
    }),
  },
  REPORT_TYPE_MENU_ITEM_RATING_REPORT: {
    tabla: 'uber_calificaciones_articulo', conflicto: 'pedido_codigo,articulo_nombre,calificacion_at',
    obligatorias: ['tienda', 'pedido_codigo', 'articulo_nombre'],
    fila: (c, cruda) => ({
      ...tiendaDe(c),
      pedido_codigo: clean(c('Código del pedido')),
      pedido_uuid: uuid(c('Identificador único universal (UUID) del pedido')),
      pedido_fecha: fecha(c('Fecha del pedido')),
      completado_at: ts(c('Hora de finalización del pedido')),
      articulo_nombre: clean(c('Nombre del artículo')),
      articulo_id_externo: txt(c('Id. de artículo externo')),
      articulo_datos_externos: txt(c('Datos externos')),
      moneda: txt(c('Código de la divisa')),
      articulo_precio: num(c('Precio del artículo')),
      menu_categoria: txt(c('Categoría del menú')),
      instrucciones_especiales: txt(c('Instrucciones especiales')),
      calificacion_fecha: fecha(c('Fecha de calificación')),
      calificacion_at: ts(c('Hora de calificación')),
      calificacion_valor: txt(c('Valor de calificación')),
      calificacion_etiquetas: txt(c('Etiquetas de calificación')),
      comentario: txt(c('Comentario')),
      es_catering: txt(c('¿Quieres pedir el servicio de catering?')),
      tipo_cumplimiento: txt(c('Tipo de cumplimiento')),
      canal: txt(c('Canal de pedidos')),
      marca_uber: txt(c('Marca de Uber Eats')),
      fila_cruda: cruda,
    }),
  },
  REPORT_TYPE_DOWNTIME_REPORT: {
    tabla: 'uber_disponibilidad_horaria', conflicto: 'tienda,hora_local', obligatorias: ['tienda', 'hora_local'],
    // Verificado con la muestra: 6 tiendas x 4 días x 24 filas. El tramo es de una
    // hora y los valores son minutos dentro de ese tramo (30 = abrió a la media).
    // OJO: la columna del tramo llega rotulada "Restaurante abierto" pero su valor
    // es un timestamp, así que la traducción de Uber está corrida. Los tres números
    // se guardan con el nombre LITERAL de su encabezado, sin reinterpretarlos.
    fila: (c, cruda) => ({
      ...tiendaDe(c),
      fecha: fecha(c('Fecha')),
      hora_local: ts(c('Restaurante abierto')),
      minutos_menu_disponible: num(c('Menú disponible')),
      minutos_conectado: num(c('Restaurante conectado')),
      minutos_desconectado: num(c('Restaurante desconectado')),
      fila_cruda: cruda,
    }),
  },
  REPORT_TYPE_PAUSE_REPORT: {
    tabla: 'uber_eventos_indisponibilidad', conflicto: 'fuente,tienda,inicio_local',
    obligatorias: ['tienda', 'inicio_local'],
    fila: (c, cruda) => ({
      ...tiendaDe(c), fuente: 'pausa',
      inicio_local: ts(c('Pausar inicio')),
      duracion: txt(c('Duración de la pausa')),
      motivo: txt(c('Motivo de la pausa')),
      fila_cruda: cruda,
    }),
  },
  REPORT_TYPE_PAYMENT_DETAILS_REPORT: {
    // Primera fila = descripción larga de cada columna; la segunda es el encabezado.
    // Llave verificada sin repetidos en 1.698 filas (11 al 22-sep-2026). No lleva
    // fecha de pago ni referencia: el pedido llega pendiente y se liquida días
    // después; así el upsert actualiza la fila en vez de duplicarla.
    tabla: 'uber_pagos', conflicto: 'llave', obligatorias: ['tienda', 'tienda_uuid', 'pedido_fecha', 'llave'],
    saltarFilas: 1,
    encabezados: ['Pago total', 'Tasa de servicio (sin IVA)', 'Ajuste de marketing (con IVA)', 'Ventas (con IVA)', 'Promociones en artículos (con IVA)'],
    fila: (c, cruda) => {
      const f = {
        tienda: clean(c('Nombre de la tienda')),
        tienda_codigo_externo: txt(c('ID externo de la tienda')),
        tienda_uuid: uuid(c('UUID de la tienda')),
        pedido_codigo: txt(c('Id. del pedido')),
        flujo_uuid: uuid(c('Id. del flujo de trabajo')),
        pedido_fecha: fechaCorta(c('Fecha del pedido')),
        aceptado_hora: txt(c('Hora a la que se aceptó el pedido')),
        completado_at: ts(c('Hora de finalización del pedido')),
        modalidad: txt(c('Modalidad de consumo')),
        canal: txt(c('Canal de pedidos')),
        estado: txt(c('Estado del pedido')),
        membresia_uber: txt(c('Estado de la membresía de Uber del usuario')),
        moneda: txt(c('Código de moneda')),
        ventas_con_iva: num(c('Ventas (con IVA)')),
        iva_ventas: num(c('IVA sobre las ventas')),
        cargo_error_sin_iva: num(c('Cargo por error en el pedido (sin IVA)')),
        iva_cargo_error: num(c('IVA sobre el cargo por error en el pedido')),
        cargo_error_con_iva: num(c('Cargo por error en el pedido (con impuestos)')),
        ajuste_precios_sin_iva: num(c('Ajustes en los precios (sin IVA)')),
        iva_ajuste_precios: num(c('IVA sobre ajustes de costo')),
        promociones_articulos: num(c('Promociones en artículos (con IVA)')),
        tarifa_canje_oferta: num(c('Tarifa por canje de la oferta')),
        iva_tarifa_canje_oferta: num(c('Impuesto sobre la tarifa de canje de la oferta')),
        ajuste_marketing: num(c('Ajuste de marketing (con IVA)')),
        cupon_comida: num(c('Cupón de comida')),
        cupon_proveedor: txt(c('Proveedor de cupones de comida')),
        ventas_despues_ajustes: num(c('Ventas totales después de los ajustes (con IVA)')),
        promociones_envio: num(c('Canjes de oferta de entrega (con IVA)')),
        tasa_servicio_sin_iva: num(c('Tasa de servicio (sin IVA)')),
        iva_tasa_servicio: num(c('IVA sobre la tasa de servicio')),
        retencion_iva: num(c('Retenciones de IVA')),
        retencion_renta: num(c('Retención del impuesto sobre la renta')),
        tarifa_solicitud: num(c('Tarifa de solicitud (con IVA)')),
        propinas: num(c('Montos propinas')),
        otros_pagos_descripcion: txt(c('Descripción de otros pagos')),
        otras_ganancias: num(c('Otras ganancias')),
        efectivo_recibido: num(c('Efectivo recibido')),
        embargo: num(c('Embargo')),
        pago_total: num(c('Pago total')),
        pago_fecha: fechaCorta(c('Fecha de pago')),
        factura_url: txt(c('Enlace de la factura U2R')),
        referencia_ganancias: txt(c('Id. de referencia de ganancias')),
        fila_cruda: cruda,
      };
      const llave = f.tienda_uuid && f.pedido_fecha
        ? [f.tienda_uuid, f.flujo_uuid ?? '', f.estado ?? '', f.pedido_fecha, f.otros_pagos_descripcion ?? ''].join('|')
        : null;
      return { ...f, llave };
    },
  },
  REPORT_TYPE_STORE_AVAILABILITY_REPORT: {
    tabla: 'uber_eventos_indisponibilidad', conflicto: 'fuente,tienda,inicio_local',
    obligatorias: ['tienda', 'inicio_local'],
    fila: (c, cruda) => ({
      ...tiendaDe(c), fuente: 'disponibilidad',
      inicio_local: ts(c('Hora de inicio (local)')),
      fin_local: ts(c('Hora de finalización (local)')),
      duracion: txt(c('Duración')),
      motivo: txt(c('Resumen del evento')),
      recuperacion: txt(c('Recuperación')),
      fila_cruda: cruda,
    }),
  },
};

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, { db: { schema: 'ubereats_raw' } });

  const archivos = fs.readdirSync(CARPETA).filter(f => /^REPORT_TYPE_.*\.csv$/.test(f));
  if (!archivos.length) throw new Error(`No hay CSV de informes en ${CARPETA}`);

  const resumen: Record<string, unknown>[] = [];
  for (const archivo of archivos) {
    const tipo = archivo.replace(/\.csv$/, '');
    const def = DEFINICIONES[tipo];
    if (!def) { log('reportes.tipo_sin_definicion', { tipo }); continue; }

    const bruto = fs.readFileSync(path.join(CARPETA, archivo));
    // raw:true: con raw:false la librería reinterpreta las fechas como serial de Excel.
    const libro = XLSX.read(bruto.toString('utf8'), { type: 'string', raw: true });
    const filas = XLSX.utils.sheet_to_json<Fila>(libro.Sheets[libro.SheetNames[0]], {
      defval: '', raw: true, ...(def.saltarFilas ? { range: def.saltarFilas } : {}),
    });
    if (!filas.length) { resumen.push({ tipo, tabla: def.tabla, filas: 0, nota: 'CSV sin filas' }); continue; }

    const columnas = new Map<string, string>();
    for (const k of Object.keys(filas[0])) columnas.set(norm(clean(k)), k);

    const faltan = (def.encabezados ?? []).filter(h => !columnas.has(norm(h)));
    if (faltan.length) {
      throw new Error(`${tipo}: faltan encabezados ${faltan.join(' | ')}. Columnas recibidas: ${Object.keys(filas[0]).join(' | ')}`);
    }

    const { data: informe, error: errInforme } = await supabase
      .from('uber_informes')
      .upsert({
        period_start: '1970-01-01', period_end: '1970-01-01',
        store_scope: tipo, tipo_informe: tipo, filename: archivo,
        file_sha256: crypto.createHash('sha256').update(bruto).digest('hex'),
        source_url: 'https://merchants.ubereats.com/manager/reports',
        raw_csv: bruto.toString('utf8'),
      }, { onConflict: 'file_sha256' })
      .select('id').single();
    if (errInforme) throw errInforme;

    const mapeadas = filas.map(f => {
      const buscar: Buscador = (...alias) => {
        for (const a of alias) { const real = columnas.get(norm(a)); if (real !== undefined) return f[real]; }
        return '';
      };
      return { informe_id: informe.id, ...def.fila(buscar, f) };
    });

    // Si Uber renombró una columna clave, esto lo dice en vez de guardar NULLs.
    for (const col of def.obligatorias) {
      const vacias = mapeadas.filter(m => !(m as Record<string, unknown>)[col]).length;
      if (vacias) {
        throw new Error(`${tipo}: ${vacias} de ${mapeadas.length} filas sin "${col}". Columnas recibidas: ${Object.keys(filas[0]).join(' | ')}`);
      }
    }

    // Postgres rechaza un upsert que toque la misma clave dos veces en un lote
    // ("ON CONFLICT DO UPDATE command cannot affect row a second time"), y Uber sí
    // repite claves: un pedido puede traer la calificación del cliente y la del
    // repartidor en el mismo segundo. Se queda la última ocurrencia.
    const llaves = def.conflicto.split(',');
    const unicas = new Map<string, Record<string, unknown>>();
    for (const m of mapeadas as Record<string, unknown>[]) {
      unicas.set(llaves.map(k => String(m[k] ?? '')).join(''), m);
    }
    const aCargar = [...unicas.values()];
    const descartadas = mapeadas.length - aCargar.length;
    if (descartadas) log('reportes.duplicados_en_lote', { tipo, descartadas, clave: def.conflicto });

    let cargadas = 0;
    for (let i = 0; i < aCargar.length; i += 500) {
      const lote = aCargar.slice(i, i + 500);
      const { error } = await supabase.from(def.tabla).upsert(lote, { onConflict: def.conflicto });
      if (error) throw new Error(`${tipo} -> ${def.tabla}: ${error.message}${error.details ? ` | ${error.details}` : ''}`);
      cargadas += lote.length;
    }
    resumen.push({ tipo, tabla: def.tabla, filasCsv: filas.length, cargadas, descartadas });
    log('reportes.cargado', { tipo, tabla: def.tabla, filas: cargadas });
  }

  log('reportes.listo', { informes: resumen.length, detalle: resumen });
}

main().catch(error => {
  const detalle = error instanceof Error
    ? { message: error.message, stack: error.stack }
    : (error && typeof error === 'object' ? { ...error } : { message: String(error) });
  log('reportes.error', detalle);
  process.exitCode = 1;
});
