# 06 · RRHH / Nómina

Estado: 🔄 primera versión (22-sep-2026). Faltan: pantalla de rol mensual en detalle (rubros), pagos de beneficios, reportes de nómina, comparación campo a campo con `gth_nom_*`.

## 1. Qué hace
Rol de pagos mensual (RPM) o quincenal (RPQ) por empleado: ingresos, otros ingresos, egresos, otros egresos, días laborados, total, tipo de pago y cuenta bancaria; préstamos y descuentos con cuotas; décimos tercero y cuarto (plantillas y pagos); pagos por transferencia o cheque desde cuentas bancarias; contabilización automática por grupo de pago (asiento tipo "Nómina"); configuración de departamentos, cargos, cuentas contables por rubro y porcentaje IESS.

## 2. Entidades y campos
### Configuración (`rrhh/configuraciones/`)
- Generales: `rrhh_formapago_mensual` + `dia_pago`, `rrhh_formapago_quincenal` + `porcentaje_quincena`, **`porcentaje_iess` 9.35 % o 9.45 %**, `porcentaje_ext_conyugal`, `correo_copia_rol`, `cuenta_bancaria_rrhh` (30463 = Produbanco CC), motivos para archivos de Banco Guayaquil y Bolivariano (cash management).
- **Cuentas contables por rubro y por grupo de pago** (`_adm`, `_vta`, `_cto`, `_otr`): ingreso sueldo, alimentación, transporte, vivienda, comisiones, horas extra, bonos, otros, devolución beneficios sociales, devolución días/multas; anticipos; egresos descuento, multa, ausencia, comisariato, farmacia, seguro, celular, días/horas no laboradas, otros, impuesto renta; préstamos quirografario, hipotecario, personal; sueldos por pagar; décimo tercero y cuarto (pasivo y gasto); fondos de reserva (pasivo y gasto); vacaciones (pasivo y gasto); IESS personal, cónyuge IESS, aportes patronales (pasivo y gasto), SECAP/IECE (pasivo y gasto). En FOODIX están configuradas para adm, vta y cto (ej. sueldo adm 9830498, vta 9830431, cto 9830400); el grupo "otros" está incompleto.
- Departamentos y cargos (formularios propios); cuentas bancarias para pago (Produbanco ×2, Pichincha, Guayaquil, DeUna, JUSTO, Internacional, Bolivariano).
### Rol (`rrhh/pago/registrar_pago/?tipo_rol=RPM|RPQ`)
`anio`, `mes`, `quincena` 1Q/2Q, `fecha`, selección de empleados, `preliminar`, `generar_sin_ret`, `generar_lc_ret_elect`, `extras_ext_conyugal`, `tipo_pago_masivo` B cheque / T transferencia / N pendiente, "Datos electrónicos" (archivo para el banco), "Eliminación de rubros"; tabla por empleado: ingresos, otros ingresos, egresos, otros egresos, días laborados, total, tipo de pago, cuenta bancaria, estado del proceso. Lista de roles (`rrhh/periodos/`): `tipo_rol`, `estado` C creadas / G generadas, fechas.
### Préstamos y descuentos (`rrhh/prestamos/`, `rrhh/pago/agregar_descuento/`)
`tipo` A anticipo, H hipotecario, Q quirografario, P personal, I impuesto renta, L celular, S seguro, C comisariato, F farmacia, M multa, D descuento; `valor_total`, `valor_mensual`, `plazo`, `fecha_emision`, `fecha_pago_ini`, `tipo_pago` N/B/T, `cuenta_bancaria`, `comprobante`; estado P pendiente / G pagado; `tipo_configuracion` RPM/RPS (semanal).
### Décimos (`rrhh/consultar_periodos_beneficios/`, `rrhh/periodo_pagos_beneficios/`)
`tipo_beneficio` D3 décimo tercero / D4 décimo cuarto, período (`fecha_ini`, `fecha_fin`), `fecha_emision`, detalle acumulado por empleado.
### Pagos (`rrhh/movimientos/consultar_movimientos/`)
Movimientos bancarios generados por nómina: persona, período, tipo C/T, comprobante, valor, `cuenta_bancaria`, mes/año; enlazan a `banco/movimiento/{id}/`.
### Persona (pestaña RRHH) — ver `04-personas.md` §2.
### API
Solo v1 `GET /rrhh/rol-pago/` (`cedula`, `periodo`, `anio`, `mes`) ⏳ probar qué devuelve.

## 3. Flujos y estados
Alta del empleado en Persona (contrato, ingresos, grupo de pago, rol mensual/quincenal, cuenta bancaria) → crear período (C) → cargar novedades (préstamos, descuentos, horas extra como "otros ingresos") → preliminar → generar (G): asiento tipo Nómina por empleado ("Registro de sueldos y provisión de beneficios sociales <mes>, - <nombre>") y pago por transferencia/cheque (movimiento bancario) → décimos por período → salida con acta de finiquito.

## 4. Reglas legales (⚠ verificar tasas en el sistema y en la ley antes de copiar)
IESS personal 9.45 % (opción 9.35 %), aporte patronal + SECAP/IECE (cuentas separadas), fondos de reserva (pago mensual o acumulado), décimo tercero (dic–nov) y cuarto (por región), vacaciones, extensión conyugal IESS, impuesto a la renta en relación de dependencia (tipo I), tipos de contrato del Código del Trabajo y LOSEP, reducción de jornada, discapacidad.

## 5. Cómo se accede
Solo web (GET con sesión para listas; exports `excel`/`pdf` en préstamos y movimientos; ⏳ export del rol). API v1 `rrhh/rol-pago/` a probar.

## 6. Uso real en FOODIX
- Contífico: 104 personas con rol empleado; asientos con glosa de nómina: 2021 37 · 2022 115 · 2023 198 · 2024 193 · 2025 602 · **2026 1,916 (615 glosas distintas)**, uno por empleado y mes ("Registro de sueldos y provisión de beneficios sociales Junio 2026, - <nombre>") más "Cancelación de haberes…" (liquidaciones). Préstamos activos listados (12 personas en la primera página). Pagos de nómina por transferencia registrados en `rrhh/movimientos/`.
- FOODIX propio: `gth_talento_humano.gth_nom_*` (13 tablas: periodos, detalle, rubros, rubros_catalogo, novedades, préstamos, IR tabla, seguro planes/afiliaciones, config, acuses) con 9 períodos creados entre el 26-ago y el 02-sep-2026.
- Daniel (22-sep): la nómina la hace Talento Humano; Contabilidad supervisa. ⏳ Confirmar con Esteban Estrella (TTHH) si el rol se genera en Contífico o en la app y solo se contabiliza en Contífico.

## 7. Defectos y aciertos
- ✅ Contabilización automática por grupo de pago con cuentas separadas de gasto y pasivo por beneficio: es el mapa contable que un sistema propio debe reproducir.
- ✅ Préstamos con cuotas automáticas y 11 tipos de descuento.
- ❌ Ficha laboral encerrada en Persona sin API; sin control de asistencia propio (solo `col_mostrar_asistencias` y permisos `pers_rrhh_proy_control_asis`).
- ❌ Horas extra como "otros ingresos" sin detalle de 50 %/100 %/nocturno (⏳ verificar en el rol).
- ⚠ Configuración de cuentas para el grupo "otros" incompleta en FOODIX.

## 8. Qué necesitaríamos para reemplazarlo
⏳ Motor de rol con rubros parametrizables, provisiones, IESS, IR, décimos, préstamos, liquidaciones, archivos bancarios y asiento automático por grupo de pago.

## 9. Fuentes
`evidencia/pages/rrhh_*.json`, `persona_registrar.json`, consultas psql (asientos nómina, gth_nom_periodos), OpenAPI v1 `/rrhh/rol-pago/`.
