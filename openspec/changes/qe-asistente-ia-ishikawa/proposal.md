## Why

El asistente de IA del QE (`qe-asistente-ia`) solo sugiere los 5 Porqués: el PRD §1.7 pedía un "borrador de 5 Porqués" y el Ishikawa quedó fuera de alcance (§5 de esas instrucciones). Hoy, si el usuario tiene elegido Ishikawa y usa la sugerencia, `usarCincoPorques` fuerza `metodoAnalisis = '5_PORQUES'` y borra el Ishikawa. Toño decidió (2026-11-03) que la IA sugiera según el método elegido en el QE, en una sola consulta del mismo costo.

## What Changes

- **Backend — pedido:** `POST /api/quality-events/{id}/asistente-ia` acepta un body opcional `{ metodo: "5_PORQUES" | "ISHIKAWA" }`. Sin body (o sin `metodo`) usa `qe.MetodoAnalisis` y, si es null, `5_PORQUES`, así los clientes actuales siguen funcionando. Un valor inválido responde 400.
- **Backend — respuesta:** `SugerenciaCausaRaiz` agrega `Ishikawa` (6 `IshikawaItem`) y `CincoPorques` pasa a ser nullable: viene exactamente uno de los dos según el método. La causa raíz probable y las acciones sugeridas se mantienen en los dos casos.
- **Cliente real:** el esquema de `output_config.format` y el bloque del system prompt se eligen según el método. Para Ishikawa: exactamente 6 `{ categoria, causa }` con `categoria` en el enum `IshikawaCategoria`, sin repetir, y una frase explícita cuando la categoría no aplica. Una respuesta que no cumple → `AsistenteIANoDisponibleException` (503 `IA_NO_DISPONIBLE`).
- **Simulado:** con `ISHIKAWA` devuelve 6 causas fijas coherentes con el tipo y el área, una con la frase "no aplica". `[simular-error-ia]` sigue funcionando con los dos métodos.
- **Audit trail:** `ASISTENTE_IA_CONSULTADO` registra `"<modelo> · <metodo>"` en `ValorNuevo`. El límite diario sigue contando todas las consultas.
- **PATCH genérico:** `origenIA.ishikawa` (`IA` | `IA_EDITADO`) con el mismo tratamiento que `cincoPorques` y `causaRaiz`.
- **Frontend:**
  - la consulta envía `{ metodo }` con el valor actual del formulario, no con el guardado;
  - el panel muestra el bloque "Diagrama de Ishikawa sugerido" con las 6 categorías, con "Usar"/"Descartar";
  - `usarIshikawa` aplica las filas por categoría, deja el método en Ishikawa y pide confirmación si había datos;
  - `usarCincoPorques` ya no fuerza el método en silencio: si el método actual no coincide, pide confirmación para cambiarlo;
  - marca "IA"/"IA (editado)" y `origenIA.ishikawa` al guardar.
- **MSW:** el handler de `asistente-ia` lee `body.metodo` y devuelve el Ishikawa fijo; el PATCH audita `ishikawa` con `origenIA.ishikawa`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `be-asistente-ia`: el cliente y el simulado sugieren según el método; el endpoint acepta `metodo` y lo registra en el audit trail.
- `be-quality-events-api`: `origenIA.ishikawa` en el PATCH genérico.
- `quality-event-api`: `asistirCausaRaizIA(id, metodo)`, `SugerenciaCausaRaizIA.ishikawa` y `OrigenIA.ishikawa`.
- `quality-event-asistente-ia`: el hook envía el método, el panel tiene el bloque Ishikawa y las marcas/`origenIA` lo cubren.
- `quality-event-msw-handlers`: el mock responde según `metodo` y audita `ishikawa`.

## Impact

- **Backend:** `Features/QualityEvents/AsistenteIA/*`, `AsistirCausaRaizIA/*`, `ActualizarQualityEvent/*` y los tests de `QualityEventsAsistenteIAEndpointTests`. Sin migración.
- **Frontend:** `api/quality-events.api.ts`, `hooks/useAsistenteIA.ts`, `types/qualityEvent.types.ts`, `components/QEInvestigationSection.tsx` (+ test), i18n `qualityEvents` (es-PE y en-US), MSW de quality-events (+ test).
- **Dependencias:** `qe-asistente-ia` y `qe-analisis-causa-raiz-fix`, archivados antes de este change.
