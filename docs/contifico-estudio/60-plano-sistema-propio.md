# 60 · Plano del sistema propio — esqueleto

Daniel (22-sep-2026): esta fase es de conocimiento; el plano se decide después. Aquí queda solo la estructura que el estudio ya permite llenar, sin estimaciones ni orden de construcción.

## Módulos observados en Contífico y su estado en FOODIX
| Módulo | Contífico lo cubre | FOODIX ya tiene algo propio | Decisión pendiente |
|---|---|---|---|
| Catálogo de productos, recetas y combos | sí (con el defecto COP/COM de uso) | `costos.receta_base` (carga manual) | modelo COM + COP desde el día 1 |
| Facturación electrónica y POS de tienda | sí, completo (firma, SRI, RIDE, cajas) | no | el bloque legal más grande; ver `50` |
| Compras, retenciones, bandeja SRI | sí | no (solo espejo) | — |
| Cobros, cajas, depósitos, tarjetas por lote | sí | conciliación de lotes y de plataformas en el dashboard | integrar, no duplicar |
| Inventario: movimientos, producción, toma física, kardex, saldos | sí | conteos de tienda y pedidos sugeridos en la app | — |
| Contabilidad, activos fijos, estados financieros, ATS/103/104 | sí | no | ¿coexistencia con Contífico o contador externo? |
| Nómina | sí hasta jul-2026 | `gth_nom_*` desde ago-2026 | ya migrado; falta la contabilización |
| Personas | sí | matriz de colaboradores (Airtable/Supabase), CRM de clientes | — |
| Fidelización | sí, sin uso | Simón Puntos | propio |
| Reportes | sí | dashboard | propio |
| Usuarios y permisos | sí (300 flags) | auth propio del dashboard | copiar el modelo de permisos |

## Preguntas que el plano debe responder (todas abiertas)
1. ¿Corte total o coexistencia? Contífico seguiría como emisor fiscal mientras el POS propio madura, o se reemplaza todo en el mismo corte.
2. ¿Cómo se importa la historia (762 mil documentos, 2.45 millones de líneas de asiento, 824 mil movimientos)? Ya está en `contifico_raw`.
3. ¿Quién firma y envía al SRI el primer día: librería propia, servicio externo o Contífico en paralelo?
4. ¿Qué hace el contador el primer mes? (cierres, ATS, declaraciones).

Ver `40-defectos-de-diseno.md` para las reglas que el diseño debe respetar y `41-lo-que-vale-copiar.md` para lo que se replica.
