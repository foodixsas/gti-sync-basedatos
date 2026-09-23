# 50 · Requisitos legales de Ecuador que el sistema debe cumplir (y qué implementa Contífico)

⚠ Tasas, formatos y plazos deben confirmarse contra la norma vigente al momento de construir (SRI, IESS, Ministerio de Trabajo cambian resoluciones cada año). Lo marcado "Contífico ✅" se observó en pantallas o datos el 22-sep-2026; "⏳" es lo que no se verificó.

## SRI — comprobantes electrónicos
| Requisito | Contífico | Evidencia |
|---|---|---|
| Emisión electrónica de FAC, NCT, NDT, retenciones, guías, liquidaciones (esquema XML del SRI, versión vigente), clave de acceso de 49 dígitos, firma XAdES-BES con certificado .p12, envío a recepción y autorización (ambiente pruebas/producción), RIDE, correo al receptor | ✅ | `?de=1` (FAC, NDT, NCT, REE, LQC, LQR), `firmado`, `enviado_sri`, `autorizado_sri`, `url_xml`, `url_ride`, `correo_enviado`; firma vence 2028-08-16; 98 % de FAC 2026 electrónicas |
| Numeración establecimiento-punto de emisión-secuencial (EEE-PPP-NNNNNNNNN) | ✅ | POS por punto; `secuencia/`; 12 combinaciones históricas |
| Contingencia y reintentos cuando el SRI no responde; documentos no autorizados | ✅ parcial | `estado_electronico` PEN/FIN, "Actualizar estado", DNA (23,329 CLI) ⏳ entender regla |
| Consumidor final (9999999999999) y límites de monto para identificar al cliente | ⏳ | — |
| IVA vigente (15 %), tarifa reducida por feriados (8 %), 5 %, 0 %, no objeto, exento; ICE por % o valor | ✅ | `porcentaje_iva` por línea 12/14/15/5/8/0; `get_porcentajes_iva/?fecha=`; ICE en producto |
| Propina 10 % (servicio) | ✅ | `propina`, `config_propina`, `servicio` en API |
| Formas de pago con código SRI en la venta | ✅ | `pago_template-forma_pago` 01–21 |

## SRI — retenciones, ATS y declaraciones
| Requisito | Contífico | Evidencia |
|---|---|---|
| Retención en la fuente de IR e IVA por código (catálogo de porcentajes), emitida electrónicamente, dentro de 5 días; agente de retención | ✅ | 49 tipos IR + 13 IVA con cuentas; retención en el documento de compra; `es_agente_retencion` |
| Anexo Transaccional Simplificado (ATS) mensual/semestral: compras, ventas, retenciones, anulados, formas de pago | ✅ | `reportes/ats/` genera y envía por correo; `excluir_332` |
| Formulario 104 (IVA) y 103 (retenciones) | ✅ | `reportes/formularios104/`, `formularios103/` (registro de declaraciones con forma de pago y banco) |
| Sustento tributario por compra (códigos 02, 05, 07, 08, 09, 10, 14, 15…) | ✅ | filtro `codigo_sustento` en documentos |
| Reembolso de gastos, régimen de paraísos fiscales y doble tributación en pagos al exterior | ✅ | `docreembolso*`, `regimen_retencion`, `pais_pago_*`, `doble_tributacion` |
| Gastos personales (anexo) y gastos no deducibles | ✅ | `gasto_personal` en producto; `gasto_no_deducible` en asiento; reporte |
| Anexo ICE | ✅ (permiso) | `rep_sri_anexoice` |
| DINARDAP | ✅ | `reportes/dinardap/` |

## Contabilidad y sociedades
| Requisito | Contífico | Evidencia |
|---|---|---|
| Contabilidad obligatoria (NIIF para PYMES), plan de cuentas, libro diario y mayor, estados financieros (situación, resultados, flujo), balance de comprobación, cierre anual | ✅ | plan de 1,019 cuentas, libro diario, reportes financieros, ejercicios con cierre |
| Activos fijos: depreciación por porcentajes legales (5/10/20/33 %), valor residual, baja | ✅ | módulo Activos fijos |
| Conservación de comprobantes 7 años | ⏳ | XML/RIDE por URL; respaldo `empresa/configuracion/backup/` no probado |
| Superintendencia de Compañías: estados financieros anuales, informe | ⏳ | exports PDF/Excel |

## Laboral e IESS (nómina)
| Requisito | Contífico | Evidencia |
|---|---|---|
| Aporte personal IESS (9.45 %; 9.35 % opción), aporte patronal (11.15 % + SECAP 0.5 % + IECE 0.5 %), fondos de reserva (8.33 % mensual o acumulado), décimo tercero (dic–nov), décimo cuarto (por región), vacaciones (15 días), utilidades (15 %) | ✅ | `rrhh/configuraciones/` cuentas por rubro; `acumular_fondosreserva`, `acumular_decimos`, plantillas de décimos; ⚠ utilidades ⏳ |
| Tipos de contrato (indefinido, temporal, obra cierta, tarea período, ocasional, LOSEP, emergente, emprendimiento), registro en SUT del Ministerio de Trabajo, aviso de entrada/salida IESS, acta de finiquito | ✅ | pestaña RRHH de Persona: `tipo_contrato_rrhh`, entradas/salidas MdT e IESS, `archivo_acta_finiquito` |
| Horas extra 50 % (suplementarias) y 100 % (extraordinarias), recargo nocturno 25 %, jornada reducida | ⚠ parcial | ingreso tipo H "horas extra" sin desglose; `horas_reduccion_jornada` |
| Impuesto a la renta en relación de dependencia (retención mensual, formulario 107) | ⚠ parcial | descuento tipo I "IMP. RENTA"; 107 ⏳ |
| Préstamos quirografarios/hipotecarios IESS descontados en rol | ✅ | tipos Q/H en préstamos (25 quirografarios cargados 16-jul-2026) |
| Rol de pagos mensual/quincenal, comprobante al empleado, pago por transferencia (archivo bancario) | ✅ | roles RPQ generados hasta jul-2026; archivos cash management Guayaquil/Bolivariano |
| Discapacidad (inclusión, deducciones), extensión conyugal IESS | ✅ | campos en Persona y configuración |

## Datos personales
| Requisito | Contífico | Evidencia |
|---|---|---|
| Ley Orgánica de Protección de Datos Personales: consentimiento, política de tratamiento, registro de aceptación | ✅ | modal `tratamiento_datos_ajax` obligatorio al entrar; política en `contrato/mi_cuenta/`; mensaje legal en el RIDE |

## Para el sistema propio
Las obligaciones del SRI (emisión electrónica, retenciones, ATS, 103/104) y las de nómina (IESS, décimos, fondos, finiquitos) son las que más trabajo llevan y las que Contífico cubre completo hoy. Ninguna puede quedar a medias el día del corte.
