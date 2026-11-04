## 1. Backend — modelo y cliente

- [x] 1.1 `AsistenteIAModels.cs`: `SugerenciaCausaRaiz` con `CincoPorques?` e `Ishikawa?` (reutiliza `IshikawaItem` de Domain, design.md D2); `IAsistenteCausaRaizClient.SugerirAsync(ctx, metodo, ct)` (D1).
- [x] 1.2 `AnthropicAsistenteCausaRaizClient`: bloque del system prompt y esquema de `output_config.format` según el método (enum desde `IshikawaCategoria`); `RespuestaIA` con `Ishikawa`; `ValidarIshikawa` aparte (6, sin repetir, sin desconocidas, sin causas vacías); mapeo con trim y parseo insensible a mayúsculas.
- [x] 1.3 `AsistenteCausaRaizSimulado`: Ishikawa fijo de 6 categorías con una "no aplica"; `[simular-error-ia]` con los dos métodos.

## 2. Backend — endpoint y guardado

- [x] 2.1 `AsistirCausaRaizIAEndpoint`: body opcional `{ metodo }`, 400 si es inválido (D3).
- [x] 2.2 `AsistirCausaRaizIAHandler`: método efectivo (body → `qe.MetodoAnalisis` → `5_PORQUES`) y `ValorNuevo = "<modelo> · <metodo>"` (D5).
- [x] 2.3 `OrigenIA.Ishikawa` en el command, validación `IA`/`IA_EDITADO` y `TrackChange("ishikawa", …, origenIA.Ishikawa)` en el handler.

## 3. Backend — tests

- [x] 3.1 Ishikawa: el pedido lleva el esquema (required + 6 categorías); respuesta válida → 200 con `ishikawa` (6) y `cincoPorques = null`; método por defecto desde el QE.
- [x] 3.2 Validación de Ishikawa (5 categorías, repetida, causa vacía, desconocida) → 503 `IA_NO_DISPONIBLE`; método inválido → 400.
- [x] 3.3 Regresión 5 Porqués / sin body (audit `· 5_PORQUES`); simulado con Ishikawa (6, "no aplica", sin HTTP, audit `simulado · ISHIKAWA`).
- [x] 3.4 PATCH con `origenIA.ishikawa = IA` → `GeneradoPorIA`; `IA_EDITADO` → sufijo; valor inválido → 400.

## 4. Frontend

- [x] 4.1 Tipos: `SugerenciaCausaRaizIA.cincoPorques?/ishikawa?`, `OrigenIA.ishikawa`; `asistirCausaRaizIA(id, metodo)` envía `{ metodo }`; `useAsistenteIA` con `{ id, metodo }`.
- [x] 4.2 `QEInvestigationSection`: consulta con `watch('metodoAnalisis')`; bloque "Diagrama de Ishikawa sugerido"; `usarIshikawa` por categoría; `usarCincoPorques` sin forzar el método (confirmación `confirmarCambioMetodo`); `origenIshikawa` y `origenIA.ishikawa` (D6).
- [x] 4.3 i18n `qualityEvents` es-PE y en-US: `ia.bloqueIshikawa`, `ia.confirmarReemplazoIshikawa`, `ia.confirmarCambioMetodo`.
- [x] 4.4 Tests de `QEInvestigationSection`: envía el método; bloque Ishikawa sin 5 Porqués; Usar por categoría sin cambiar de método; confirmación con datos previos; IA (editado) + `origenIA.ishikawa`; confirmación de cambio de método; regresión 5 Porqués.

## 5. MSW

- [x] 5.1 Fixture `sugerenciaCausaRaizIshikawaIAFixture`; el handler de `asistente-ia` lee `body.metodo` (400 si es inválido) y registra `"<modelo> · <metodo>"`; el PATCH audita `ishikawa` con `origenIA.ishikawa`.
- [x] 5.2 Tests de `quality-events.handlers.test.ts` para Ishikawa, método inválido y `origenIA.ishikawa`.

## 6. Verificación

- [ ] 6.1 Suite completa del backend (`dotnet test`) y del frontend (`vitest run`).
- [ ] 6.2 `tsc --noEmit` y `npm run lint` con cero errores.
