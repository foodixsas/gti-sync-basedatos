# 30 · Uso real de Contífico en FOODIX

Fuente: espejo `contifico_raw` en Supabase (psql, 22-sep-2026, `evidencia/uso-real.txt` y `uso-real-2.txt`) más pantallas del sistema web. Las fechas de `trx_documentos` y `trx_asientos_contables` son texto `DD/MM/YYYY`; los años se derivan con `right(fecha,4)`.

## Volumen por módulo

| Módulo | Qué usa FOODIX | Cuánto |
|---|---|---|
| **Transacciones / POS** | Facturación electrónica de las 6 tiendas por POS de Contífico (cajas por punto de emisión) | 722,036 FAC de cliente (2021→2026); en 2026 entre 13,000 y 18,400 por mes, 98 % electrónicas, 0.4 % anuladas. Estados: C cobrado 740,687 · A anulado 3,720 · P pendiente 1,018 · G pagado 333 |
| **Compras** | Facturas de proveedor, liquidaciones, notas de crédito, anticipos | 32,571 FAC PRO + 1,559 DAC + 1,089 NCT + 1,045 LQR + 1,010 NVE + 510 LQC; 520–910 documentos PRO por mes en 2026. Estados: G pagado 33,188 · P pendiente 4,564 · C 1,079 |
| **Cobros** | Formas de cobro en las FAC de 2026 | TC 58,310 cobros ($1.27 M) · TRANSF 21,125 ($399 K) · CAJA 17,449 ($279 K) (montos sin IVA no verificado; suma de `cobros[].monto`) |
| **Documentos no autorizados (DNA)** | 23,329 CLI + 1,097 PRO | ⏳ entender el origen |
| **Inventario** | Movimientos por bodega, 12 bodegas, producción, fórmulas | EGR 769,805 · ING 36,905 · TRA 17,023 · AJU 402; 1,350 productos (611 compuestos) |
| **Contabilidad** | Asientos automáticos de todo lo anterior + manuales | 2,451,046 asientos-línea: 2021 63,574 · 2022 360,609 · 2023 405,082 · 2024 486,193 · 2025 612,827 · 2026 522,760 (al 22-sep); plan de 1,104 cuentas; 28 centros de costo; ejercicios con cierre mensual |
| **Bancos** | Movimientos bancarios, 9 cuentas | 18,311 movimientos (2022→2025 en el espejo; ⏳ 2026 no sincronizado o filtrado) |
| **Tarjeta de crédito** | Liquidaciones y lotes | ⏳ (no hay espejo; ver `09-bancos.md`) |
| **RRHH / Nómina** | Rol, préstamos, décimos, pagos, asientos de nómina | 104 empleados; 1,916 líneas de asiento de nómina en 2026 (uno por empleado y mes); préstamos activos; pagos por transferencia. Sin espejo en Supabase |
| **Personas** | Clientes (POS), proveedores, empleados, vendedores | 160,113 personas: 158,006 solo clientes · 1,554 proveedores · 457 ambos · 104 empleados · 26 vendedores |
| **Guías de remisión** | Casi nada | 3 guías |
| **Fidelización** | ⏳ ver si hay segmentos/reglas creados | — |
| **Activos fijos** | ⏳ | — |
| **Firmas electrónicas** | Certificado .p12 de la empresa (firma FAC y retenciones) | ⏳ vigencia |
| **Reportes** | Contabilidad y auditoría (reportes personalizados guardados: "AUDITORIA CENTRO DE COSTOS RCH" jun-2026) | — |

## Establecimientos y puntos de emisión (facturas de cliente)
| Punto | Facturas | Caja (Depósitos) |
|---|---:|---|
| 002-001 | 192,562 | Real Audiencia 002-001 |
| 004-002 | 191,424 | Portugal 004-002 |
| 003-001 | 122,723 | Floreana 003-001 |
| 004-001 | 76,998 | Portugal 004-001 |
| 005-002 | 62,812 | Simón Bolón 005-002 |
| 006-001 | 27,760 | Santo Cachón 006-001 |
| 002-002 | 22,795 | Real Audiencia 002-002 |
| 007-001 | 19,700 | Portugal 007-001 (⚠ Santo Cachón Portugal, inferido) |
| 005-001 | 3,972 | Simón Bolón 005-001 |
| 001-001 / 001-002 | 721 / 29 | Oficina (manuales; también retenciones y electrónicos de esta cuenta) |
| 003-002 | 450 | Floreana 003-002 |
⏳ Falta la vigencia de cada punto (fechas de primer y último documento con parseo de fecha) y el mapeo a `cat_bodegas` y `cat_centros_costo`.

## Qué hace FOODIX fuera de Contífico (y debería considerarse en el plano)
- Nómina propia `gth_nom_*` (desde ago-2026) en paralelo a la nómina de Contífico.
- Costos y márgenes: `costos.*` sobre un export manual de fórmulas.
- Conciliación de plataformas (Uber, PedidosYa, Rappi) y de lotes de tarjeta: fuera de Contífico, aunque Contífico tiene `tipo_domicilio`/`orden_domicilio_id` y el módulo Tarjeta de crédito › Lotes.
- Inventario de tiendas (conteos), pedidos sugeridos, asistencia, evaluaciones, CRM/encuestas, fidelización (Simón Puntos) — todo en apps propias.
