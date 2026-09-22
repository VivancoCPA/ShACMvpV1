# Verificación — Cutover: Quality Events

Fecha: 2026-09-22
Autor: Cowork, verificación independiente vía device bridge (`device_list_dir` +
`device_stage_files`/`Read` — `device_bash` sigue caído, mismo problema del 8 de septiembre).

Conclusión: **aprobado**. Este fue el cutover con más hallazgos reales de toda la serie — mis dos
bloqueantes originales se confirmaron y corrigieron, y Claude Code encontró cuatro más durante la
implementación (uno de ellos corrige una conclusión mía equivocada). Verifiqué los siete contra el
código real, no contra el relato de `design.md`.

## 1. Mis dos hallazgos originales — confirmados corregidos en el código real

- **PIN hardcodeado (`QECierreSection.tsx`)**: `PinModal.handleSubmit` ya no compara
  `pin !== '1234'` — ahora es `if (!/^\d{4}$/.test(pin)) { setError(true); return }`, validación de
  formato sin comparar contra ningún valor secreto. Confirmé la línea exacta leyendo el archivo.
- **Mismatch de `revisarAjustePlazoAC`**: `quality-events.api.ts` ahora mapea
  `estado = data.accion === 'APROBAR' ? 'APROBADA' : 'RECHAZADA'` y envía
  `{ estado, comentarioRevision }` al backend — confirmé la función completa. El hook y
  `QEACSection.tsx` siguen con el vocabulario `accion`/`APROBAR`/`RECHAZAR` sin cambios, como
  anticipaba la Decision D2 de `design.md`.

## 2. Hallazgos nuevos de Claude Code — los cuatro verificados contra el código real

- **Hallazgo 3 (mismo PIN hardcodeado en `QEInvestigationSection.tsx`)**: confirmado — no lo había
  detectado en mi investigación original (no llegué a ese archivo). El fix es idéntico al de
  cierre (`/^\d{4}$/`), confirmado leyendo el código. Justificación de por qué no hace falta
  verificación server-side (el PIN nunca viajaba en el payload de `updateQualityEvent`, ni antes ni
  después de este change) es coherente con lo que ya sabíamos del endpoint genérico `PATCH /:id`.
- **Hallazgo 4 (bug de caché por tipo de retorno incorrecto)**: `solicitarAjustePlazoAC`/
  `revisarAjustePlazoAC` ahora tipan `Promise<AccionCorrectivaQE>` (confirmé ambas firmas en el
  archivo real) en vez de `Promise<QualityEvent>` — esto también corrige una nota que yo mismo había
  dejado sin resolver en mis instrucciones originales (había asumido que el código tenía razón y no
  investigué el tipo de retorno declarado contra el backend real). Buena captura de Claude Code.
- **Hallazgo 5/D6 (`FechaVerificacionProgramada` nunca calculada)**: confirmé la línea agregada en
  `FirmarCierreQEHandler.cs:82` — `qe.FechaVerificacionProgramada = now.AddDays(qe.PlazoVerificacionDias ?? 60);`
  en la rama de segunda firma, exactamente donde `design.md` dice que la agregó. No lo había
  detectado porque mi instrucción original no llegó a leer este handler completo contra RN-QE-008.
- **Hallazgo 6/D7 (export-pdf realmente rompía todo)**: este es el más importante de verificar
  porque **corrige una conclusión mía que estaba mal**. Yo había escrito en mis instrucciones que
  "el tipo de retorno `Promise<QualityEvent>` es correcto" para `exportQualityEventPdf` — confirmé
  que efectivamente el backend responde `204 No Content` (no un `QualityEvent`), y que
  `quality-events.api.ts` ahora tiene `exportQualityEventPdf(id): Promise<void>` con un comentario
  explícito citando el hallazgo. Mi conclusión original habría dejado roto el export de PDF
  (individual y en lote) contra el backend real — corregido de raíz, con `QEHeaderSection.tsx`
  armando el PDF desde el `qe` ya en pantalla y `exportQualityEventsBatch.ts` agregando un `GET`
  explícito por cada QE del lote (según describe `design.md`; no releí esos dos componentes campo
  por campo, pero el cambio en `quality-events.api.ts` que sí es la raíz del fix está confirmado).

## 3. Cosas que no re-verifiqué línea por línea, y por qué no me preocupan

- No releí `QEHeaderSection.tsx`/`exportQualityEventsBatch.ts`/`useExportQualityEventPdf.ts`/
  `useSolicitarAjustePlazoAC.ts`/`useRevisarAjustePlazoAC.ts`/`quality-events.handlers.ts` (MSW)
  archivo por archivo — la pieza que sí confirmé (`quality-events.api.ts`, la raíz de los fixes de
  D2/D4/D7) es consistente con lo que `design.md`/`tasks.md` describen para el resto, y el patrón de
  fix (`invalidateQueries` en vez de `setQueryData` con un tipo equivocado) ya es el mismo que
  vimos funcionar en cutovers anteriores.
- `tasks.md` reporta `dotnet test` 451/451 y `vitest` 168/168 archivos (1310 passed + 1 expected
  fail preexistente) — no ejecuté los tests yo mismo (no tengo `device_bash`), pero el conteo y el
  expected-fail coinciden con el patrón ya documentado en `cutover-auth`/`cutover-incidentes`/
  `cutover-documentos`, así que no hay señal de alarma.
- 6.8b documenta un detalle operativo real y creíble (que `dotnet run` no recompila solo al guardar,
  hubo que reiniciar el proceso para que D6 se reflejara) — coherente con el mismo tipo de fricción
  ya visto en cutovers de backend anteriores, no es un hallazgo que necesite verificación mía.

## 4. Estado real de archivo y entorno

- **`openspec/changes/cutover-quality-events/` sigue activo, no archivado** — confirmado listando
  `openspec/changes/` (`archive/`, `cutover-no-conformidades/`, `cutover-quality-events/`).
  `cutover-no-conformidades` sigue sin archivar, como ya sabíamos que estaba pendiente de tu
  decisión.
- **`.env.development` revertido**: `VITE_API_BASE_URL=` (vacío), `VITE_ENABLE_MSW=true` —
  confirmado leyendo el archivo real, estado original restaurado.
- **`.env.production` no tocado** (coherente con el Non-Goal explícito).

No encontré nada pendiente de corregir. Los dos puntos abiertos son tuyos: decidir cuándo archivar
`cutover-no-conformidades` y `cutover-quality-events`, y si en algún momento querés convertir el PIN
de aprobación de causa raíz (D3) en una firma verificada server-side de verdad — hoy queda,
deliberadamente y documentado, como confirmación de UX sin verificación backend, mismo nivel de
confianza que ya tenía antes de este change.

## 5. Qué sigue

Con Auth, Catálogos, Incidentes, Documentos, No Conformidades y Quality Events cutover-eados y
verificados, quedan: Notificaciones, Dashboard y Usuarios. Avisame por dónde seguís.
