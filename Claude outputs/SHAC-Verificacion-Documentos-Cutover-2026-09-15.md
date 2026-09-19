# Verificación — Cutover: Documentos

Fecha: 2026-09-15
Autor: Cowork, verificación independiente vía device bridge (fallback `device_list_dir` +
`device_stage_files`/`Read` — `device_bash` sigue caído).

Conclusión: **aprobado**. El hallazgo bloqueante de la firma está corregido y confirmado contra el
código real, el código muerto señalado se eliminó por completo, y encontraste dos problemas
adicionales reales durante la implementación (formato de PIN, una segunda capa de hooks muertos)
que no había detectado en la investigación original — bien documentados en `design.md` con causa
raíz.

## 1. Hallazgo bloqueante (mismatch `password`/`Pin` en la firma) — resuelto

Confirmado en código:

- `documentAction.schema.ts`: `signatureSchema` ahora valida `pin: z.string().regex(/^\d{4}$/, ...)`
  (ya no `password`).
- `DocumentSignatureModal.tsx`: `onSubmit` manda `{ pin: data.pin }` (sin `timestamp`), el input y
  el `setError` usan `pin`.
- `documents.api.ts`: `SignDocumentPayload` es `{ pin: string }`, `signDocument()` postea eso a
  `POST /api/documents/:id/sign` sin cambios.
- `FirmarPublicarDocumentoCommand.cs` (backend, no tocado — no hacía falta): sigue siendo
  `record(string Pin)`. El binder de ASP.NET Core ahora va a poblar `Pin` correctamente desde la
  clave JSON `pin`.

Elegiste la opción recomendada (D1: renombrar el campo, no un parche puntual) — coherente con que
el label/legalText del modal ya hablaban de "firma", nunca de contraseña.

**Hallazgo adicional que vos encontraste, no yo**: el `signatureSchema` original validaba
`min(6)` (heredado de cuando el campo se llamaba `password`), pero el PIN real es siempre de 4
dígitos (`SetPinValidator.cs`, `^\d{4}$`) — con `min(6)` intacto, ni siquiera corrigiendo el nombre
del campo se hubiera podido enviar un PIN real. Lo corregiste a la vez (`regex(/^\d{4}$/)`), bien
razonado en `design.md` como un bug independiente que el fix de nombre por sí solo no hubiera
revelado. Confirmé el regex en el archivo real.

## 2. Código muerto (D2) — eliminado, confirmado por lectura directa

- `useDocumentForm.ts`: ya no tiene el campo `archivo` ni las ramas `POST /:id/upload` — grep
  confirma que solo quedan `archivoOriginalFile`/`archivoOriginalUrl`/`archivoDistribucionUrl`
  (los reales).
- `documentForm.schema.ts`: el campo `archivo` ya no existe en el schema.
- `documents.api.ts`: `changeDocumentStatus`, `ChangeDocumentStatusPayload`, `createDocument`,
  `updateDocument` — ningún rastro, grep vacío.

**Hallazgo adicional real que encontraste vos, no anticipado en mis instrucciones**: `useDocuments.ts`
tenía una segunda capa de hooks (`useCreateDocument`/`useUpdateDocument`/`useChangeDocumentStatus`/
`useDeleteDocument`) envolviendo exactamente las mismas funciones muertas de `documents.api.ts`,
nunca importada por ningún componente real — la investigación original no la había encontrado
porque solo grepeó consumidores de las funciones API, no de los hooks que las envolvían. Lo
detectaste por un test que rompió de verdad al usar `tsc -b` (el build real) en vez de
`tsc --noEmit` (que confirmaste es un no-op en este repo por el `tsconfig.json` raíz con
`"files": []`) — buen hallazgo metodológico además del fix en sí. Confirmé `useDocuments.ts`: hoy
solo tiene los tres hooks de query reales (`useDocuments`, `useDocumentsByCode`, `useDocument`).

## 3. Hallazgo informativo (RN-DOC-003, marca de agua OBSOLETO) — correctamente dejado fuera de alcance

Confirmé en código que `ExportarPdfControladoHandler.cs` bloquea con 422/`BusinessRuleException`
cualquier estado que no sea `PUBLICADO` (incluido `OBSOLETO`), y que `DocumentoPdfGenerator.cs` no
tiene ninguna lógica de marca de agua "OBSOLETO — No usar" — coincide con lo que documentaste.
Correcto dejarlo fuera de este change (es trabajo de producto nuevo, no una corrección de
contrato) — coherente con el criterio ya usado en cutovers anteriores para hallazgos informativos
sin UI/ruta real.

## 4. Estado real de archivo y entorno

- **`openspec/changes/cutover-documentos/` sigue activo, no archivado** — confirmado listando
  `openspec/changes/` (solo `archive/` y `cutover-documentos/`). No lo archivo hasta que lo
  confirmes.
- **`.env.development` restaurado a baseline**: `VITE_ENABLE_MSW=true`, `VITE_API_BASE_URL` vacío —
  confirmado.
- **`.env.production` no tocado** (mtime sin cambios) — coincide con el Non-Goal explícito.
- El handler MSW de `/sign` fue actualizado a `body.pin` (confirmé en código) — los demás módulos
  siguen funcionando contra MSW sin cambio de comportamiento observable. Nota al margen, no es un
  hallazgo de este change: existe un handler MSW viejo y separado, `POST /api/documents/:id/publicar`
  (ADD-02), que todavía usa `body.password` — pero no tiene ningún consumidor real en el frontend
  (confirmé que ni `documents.api.ts` ni ningún componente lo llaman), así que no afecta nada; te lo
  menciono solo por si alguna vez aparece como fuente de confusión al leer los handlers.

No verifiqué en vivo el flujo de firma en navegador (no tengo forma de ejercitar el navegador vía
este bridge) — confío en tu verificación porque todo lo verificable en código es consistente,
detallado, y el nivel de rigor mostrado (encontrar el `tsc --noEmit` no-op, el bug de formato de
PIN, la segunda capa de hooks) es mayor que lo mínimo necesario para pasar la revisión.

No encontré nada pendiente de corregir. El único punto abierto es tuyo: decidir cuándo archivar.

## 5. Qué sigue

Con Auth, Catálogos, Incidentes y Documentos cutover-eados y verificados, quedan: No Conformidades,
Quality Events, Notificaciones, Dashboard y Usuarios. Avisame por dónde seguís.
