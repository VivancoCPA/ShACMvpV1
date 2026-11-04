## Context

`qe-asistente-ia` implementó `POST /api/quality-events/{id}/asistente-ia` con salida estructurada (`output_config.format`, D1) que siempre devuelve causa raíz probable + 5 Porqués + acciones sugeridas. `qe-analisis-causa-raiz-fix` tipó el Ishikawa como 6 `IshikawaItem { Categoria, Causa }`. El frontend (`QEInvestigationSection`) ya permite elegir Ishikawa, pero al usar la sugerencia fuerza el método a 5 Porqués. Este change hace que la sugerencia siga el método elegido.

## Goals / Non-Goals

**Goals**
- Una sola consulta, del mismo costo, que devuelve 5 Porqués **o** Ishikawa según el método.
- Compatibilidad hacia atrás: un POST sin body se comporta como hoy (o según `qe.MetodoAnalisis`).
- Trazabilidad simétrica: `origenIA.ishikawa` y el método en `ASISTENTE_IA_CONSULTADO`.

**Non-Goals**
- Devolver los dos métodos en una misma consulta.
- Cambiar el límite diario (sigue contando todas las consultas, sin distinguir el método).
- Migraciones: el Ishikawa ya se guarda como JSON en la columna existente.

## Decisions

### D1 — El método viaja como parámetro de `SugerirAsync`, no dentro de `ContextoQE`

`IAsistenteCausaRaizClient.SugerirAsync(ContextoQE ctx, string metodo, CancellationToken ct)`. `ContextoQE` es, por diseño (qe-asistente-ia D4), exactamente lo que se serializa como mensaje del usuario a la IA: son datos del QE con una revisión de privacidad. El método no es un dato del QE sino una instrucción de formato, y ya se refleja en el system prompt y en el esquema de salida; meterlo en el contexto mezclaría las dos cosas. Los valores son las constantes existentes `AnalisisCausaRaizJson.Metodo5Porques` / `MetodoIshikawa`.

### D2 — Reutilizar `IshikawaItem`/`IshikawaCategoria` de `Domain/Entities/AnalisisCausaRaiz.cs` (divergencia de ruta)

La instrucción los ubica en `Shared/AnalisisCausaRaizDtos.cs`, pero en el código real `qe-analisis-causa-raiz-fix` los dejó en `ShcMvpEndPoint.Domain/Entities/AnalisisCausaRaiz.cs` (lo necesita la entidad `QualityEvent`). Se reutilizan desde ahí; no se duplica el enum. El `enum` del esquema JSON se genera con `Enum.GetNames<IshikawaCategoria>()`, así nunca diverge del enum real.

### D3 — Body opcional y validación del método

`AsistirCausaRaizIARequest(string? Metodo)` como `[FromBody]` nullable: un POST sin body (los clientes actuales y los tests existentes) llega como `null`. Resolución: `body.Metodo` → `qe.MetodoAnalisis` → `5_PORQUES`. Un `metodo` presente que no es `5_PORQUES` ni `ISHIKAWA` responde 400 (`BadRequestBusinessException`) en el endpoint, antes de cargar el QE: es un error de forma del pedido, como el resto de las validaciones de entrada.

### D4 — Esquema y validación según el método

- `SugerenciaCausaRaiz(CausaRaizProbable, CincoPorques?, Ishikawa?, AccionesSugeridas, Modelo, GeneradoEn)`: viene exactamente uno de los dos; el otro se serializa como `null`.
- Dos esquemas estáticos: el de 5 Porqués es el actual sin cambios; el de Ishikawa reemplaza `cincoPorques` por `ishikawa: [{ categoria: enum, causa: string }]`.
- Igual que en qe-asistente-ia D1, el subconjunto de JSON Schema de las salidas estructuradas no garantiza cantidades ni longitudes: "exactamente 6" y "20 a 500 caracteres" van en el prompt y se validan en el servidor (`ValidarIshikawa`): 6 ítems, las 6 categorías sin repetir, ninguna categoría desconocida y ninguna `causa` vacía. **Divergencia menor:** la longitud mínima de 20 caracteres de la `causa` no se rechaza en la validación (la instrucción solo exige "ninguna causa vacía"); queda como pauta del prompt para no convertir en 503 una frase breve pero válida.
- El parseo de `categoria` es insensible a mayúsculas (`Enum.TryParse(..., ignoreCase: true)`), con trim de la causa.

### D5 — Audit trail de la consulta

`ValorNuevo = "<modelo> · <metodo>"` (p. ej. `claude-sonnet-5-5 · ISHIKAWA`, `simulado · 5_PORQUES`). El conteo del límite diario filtra por `Accion`, no por `ValorNuevo`, así que no cambia.

### D6 — Frontend

- `asistirCausaRaizIA(id, metodo)` envía `{ metodo }`; `useAsistenteIA().mutate({ id, metodo })`. El método es `watch('metodoAnalisis')`, lo que se ve en pantalla aunque no esté guardado.
- `PanelIA` y `AplicadoIA` agregan `ishikawa`. `ocultarBloque` acepta `'ishikawa'`.
- **Usar con método distinto:** si el método actual del formulario no coincide con el de la sugerencia (el usuario cambió mientras esperaba), se pide una sola confirmación `confirmarCambioMetodo` (que ya implica descartar el análisis del otro método); si coincide y hay datos, se pide `confirmarReemplazo`/`confirmarReemplazoIshikawa`. Siempre con un toast de acción, nunca `confirm()`.
- `usarIshikawa` aplica las filas en el orden de `ISHIKAWA_CATEGORIAS`, buscando por `categoria` (las faltantes quedan vacías), limpia los 5 Porqués y deja `ISHIKAWA`.
- **Marca:** el análisis tiene una sola marca junto al label "Método de análisis" (igual que hoy con los 5 Porqués): `origenCincoPorques` u `origenIshikawa`, el que corresponda al método activo. `origenIshikawa` compara por categoría.

### D7 — MSW

El handler lee el body con tolerancia (sin body → `qe.metodoAnalisis` → `5_PORQUES`, igual que el backend), devuelve `sugerenciaCausaRaizIshikawaIAFixture` para `ISHIKAWA` y responde 400 a un método inválido. El PATCH genérico agrega la entrada `CAMPO_EDITADO` de `ishikawa` con `origenIA.ishikawa`, espejo del backend.

## Risks / Trade-offs

- **La IA puede repetir o saltear una categoría** pese al prompt → 503 `IA_NO_DISPONIBLE`; el usuario completa a mano o reintenta (cuenta para el límite solo si fue exitosa).
- **Cambio de forma de la respuesta** (`cincoPorques` ahora puede ser `null`): el único consumidor es el frontend de este mismo repo, actualizado en este change.

## Migration Plan

Sin migración. Desplegar backend y frontend juntos; un frontend viejo sigue funcionando porque el backend sin body usa el método guardado del QE.

## Resolución al aplicar (2026-11-03)

- **Backend:** 56/56 en `QualityEventsAsistenteIAEndpointTests` + `QualityEventsAnalisisCausaRaizEndpointTests`. Suite completa: 775 pasan y 1 falla (`DocumentosPdfConversionTests.ExportarPdfControlado_PartDelPdfDeDistribucionYConservaCantidadDePaginas`, ya fallaba antes de este change). Las clases `Features.Zonas.*` cuelgan el testhost cuando corren al final de la suite completa (también en la corrida previa al change); aisladas pasan 16/16.
- **Frontend:** 1779 pasan; fallan `documentReplaceOriginal.test.tsx` y `ProfilePage.changePassword.test.tsx`, los mismos que antes del change.
- **`tsc --noEmit` / `npm run lint`:** sin errores en los archivos de este change; quedan 17 errores de `tsc` (`documents.*`) y 57 de lint en otros módulos, preexistentes. Por eso 6.1/6.2 quedan sin marcar.
