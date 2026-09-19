## Context

`ShcMvpEndPoint` ya tiene Control Documentario (M1) implementado (`be-documentos-api`): las 17 rutas de `Features/Documentos/` (`EndpointExtensions.cs` líneas 249-266) coinciden 1:1 en path y verbo con `documents.api.ts` — `GET /api/documents` (list), `GET .../pendientes/count`, `GET .../:id`, `POST /api/documents` (create), `PUT .../:id` (edit), `PATCH .../:id/status`, `DELETE .../:id`, `PATCH .../:id/restaurar`, `POST .../:id/sign`, `POST .../:id/nueva-version`, `PATCH .../:id/confirmar-revision`, `GET .../:id/archivo`, `GET .../:id/download-url`, `POST .../:id/audit/access`, `GET`/`POST .../:id/archivo-original`, `GET .../:id/archivo-distribucion`, `GET /api/documents/stream/:token`. `CrearDocumentoCommand`/`EditarDocumentoCommand` coinciden campo por campo con `documentFormSchema`, incluida la regex de `version` (`vX.Y`) y RN-DOC-020 (brecha mínima entre `fechaVigencia`/`fechaRevisionProxima`). La vinculación Documento↔QE y Documento↔NC (`documento-qe-vinculacion`/`documento-nc-vinculacion`) ya fue cutover-eada y verificada en sesiones anteriores.

Verificado contra el código real antes de proponer (archivo + línea):

- `DocumentSignatureModal.tsx:56-59` (`onSubmit`): `await signMutation.mutateAsync({ password: data.password, timestamp: new Date().toISOString() })`.
- `documents.api.ts:78-104` (`SignDocumentPayload`/`signDocument()`): postea ese objeto tal cual a `POST /api/documents/:id/sign`.
- `FirmarPublicarDocumentoCommand.cs:3`: `public sealed record FirmarPublicarDocumentoCommand(string Pin);` — sin campo `timestamp`, propiedad `Pin` no `password`.
- `FirmarPublicarDocumentoHandler.cs:36-41`: primero valida `actor.PinHash is null` (mensaje "Debés configurar tu PIN de firma"), luego `pinHasher.VerifyHashedPassword(actor, actor.PinHash, command.Pin)` — con `Pin` vacío (el binder de ASP.NET Core nunca puebla `Pin` desde una clave JSON `password`), esta verificación falla siempre con `UnauthorizedBusinessException("PIN incorrecto")` (401), sin importar que el usuario tenga PIN configurado y lo tipee bien.
- `document-approval-flow/spec.md:97-99`: la spec vigente documenta explícitamente el payload actual (`password`, `timestamp`) como requirement — confirma que este es un mismatch de contrato real entre dos changes ya archivados (`be-documentos` y el frontend original de Documentos), nunca detectado porque Documentos vivió 100% en MSW hasta ahora (el mock no valida el nombre del campo con el mismo rigor que el binder real de .NET).

Código muerto confirmado por lectura directa (no bloqueante, pero sin ningún consumidor real):

- `useDocumentForm.ts:127-133,149-155` (rama `if (data.archivo) { ... POST /api/documents/:id/upload ... }`, creación y edición) — `documentFormSchema` (`documentForm.schema.ts:23`) tiene el campo `archivo`, pero `DocumentForm.tsx` solo tiene un `FileUploadField` wireado, para `archivoOriginalFile` (línea 383-385); no existe ningún control de UI para `archivo`, así que `data.archivo` siempre es `null` en la práctica.
- El backend no tiene ningún endpoint `/upload` — confirmado en `EndpointExtensions.cs` (no aparece en la lista de rutas mapeadas) y documentado explícitamente en el propio código: `DocumentoArchivoVigenteResolver.cs:8-9` — *"el documento no tiene un 'archivoUrl' genérico en este backend (el 'archivo de trabajo' del mock es vestigial, ver design.md D2)"*.
- `changeDocumentStatus()` (`documents.api.ts:60-66`, `POST /api/documents/:id/status`) — el backend solo mapea `PATCH .../status` (`CambiarEstadoDocumentoEndpoint`, `EndpointExtensions.cs:256`); el hook real (`useDocumentActions.ts`, `usePatchDocumentStatus`) usa `patchDocumentStatus()` (`PATCH`, línea 93-99), no esta función.
- `createDocument()`/`updateDocument()` (`documents.api.ts:50-58`, con `CreateDocumentInput`/`UpdateDocumentInput` de `createDocument.schema.ts`/`updateDocument.schema.ts`) — sin consumidor; `useDocumentForm.ts:124,147` llama a `api.post`/`api.put` directamente con `documentFormSchema` (`DocumentFormInput`), un schema distinto y ligeramente más estricto que los dos anteriores.
- `changeDocumentStatusSchema` (`changeDocumentStatus.schema.ts`) — hallazgo adicional encontrado durante esta misma verificación (grep de consumidores en todo `shc-controldoc/src`): el único archivo que lo importa es su propio `changeDocumentStatus.schema.test.ts`. `useDocumentActions.ts` (`useChangeStatus`) usa `PatchDocumentStatusPayload`/`patchDocumentStatus()`, no este schema — mismo patrón de duplicación que `createDocument.schema.ts`/`updateDocument.schema.ts` frente a `documentFormSchema`.

## Goals / Non-Goals

**Goals:**
- Corregir el mismatch de contrato de la firma (`password`/`timestamp` → `pin`) para que `POST /:id/sign` funcione contra el backend real.
- Eliminar el código muerto identificado (upload de "archivo de trabajo", `changeDocumentStatus`, `createDocument`/`updateDocument` y sus schemas) para no dejar deuda de confusión futura junto a la corrección de la firma.
- Apuntar `shc-controldoc` en desarrollo al backend .NET real y verificar en navegador el ciclo completo de un documento: CRUD, las 6 transiciones de estado (incluida la firma real), nueva versión (menor/mayor), revisión periódica, reemplazo de archivo original, exportación de PDF controlado, descarga con auditoría, y vinculación con QE/NC.
- Ejercitar por primera vez en un flujo de firma real end-to-end RN-DOC-001 (obsoletización automática) y RN-DOC-005 (bloqueo si la versión previa tiene QE vinculado activo) — ya implementadas en `FirmarPublicarDocumentoHandler`, solo verificadas antes vía API directa.

**Non-Goals:**
- No se modela ningún campo ni endpoint nuevo en el backend — `CrearDocumentoCommand`/`EditarDocumentoCommand`/`FirmarPublicarDocumentoCommand` ya son correctos tal como están; este change es puramente de corrección de contrato + limpieza en el frontend.
- No se decide almacenamiento de archivos de producción — `DocumentoStorageService` (disco local bajo `wwwroot`, dev-only) ya es una decisión heredada de `be-documentos`, fuera de alcance.
- No se resuelve el Open Question de hosting/dominio de producción heredado de `cutover-auth`.
- No se toca `Cors:AllowedOrigins` de producción ni `.env.production`.

## Decisions

### D1 — Renombrar `password` → `pin`, eliminar `timestamp`, sin tocar el backend

Se elige la primera de las dos opciones planteadas: cambiar `signatureSchema`/`SignatureInput` (`documentAction.schema.ts`) y `DocumentSignatureModal.tsx` para usar `pin` en vez de `password` — el label (`signature.passwordLabel`) y el legal text del modal ya hablan de "firma", nunca de contraseña de cuenta, así que el campo pasa a reflejar lo que el usuario ya ve. `SignDocumentPayload`/`signDocument()` (`documents.api.ts`) pierden el campo `timestamp` — el backend ya registra su propio `Timestamp = DateTime.UtcNow` server-side en cada `DocumentoAuditTrail` (`FirmarPublicarDocumentoHandler.cs:69,88,100,111,123`), nunca confía en uno del cliente.

Las claves i18n (`signature.passwordLabel`, `signature.passwordPlaceholder`, `errorInvalid`, etc.) se mantienen sin renombrar — describen la UX ("ingresa tu PIN de firma"), no el nombre interno del campo del schema; solo cambia el `name`/`id` del input HTML y la key del objeto Zod.

**Alternativa descartada**: ajustar solo el nombre de la propiedad en el objeto que arma `onSubmit` (`{ pin: data.password, timestamp: ... }`) sin tocar el campo del formulario. Descartada porque deja el nombre interno de la variable (`data.password`) sin reflejar qué es realmente, y sigue enviando un `timestamp` que el backend ignora — menos prolijo por el mismo costo de cambio (ambas opciones tocan el mismo archivo).

### Hallazgo real durante implementación — el PIN real es de 4 dígitos, no "mínimo 6 caracteres"

Encontrado al preparar la verificación (sección 1.3, `POST /api/auth/set-pin` contra el backend real): `SetPinValidator.cs:10` exige `RuleFor(x => x.Pin).Matches(@"^\d{4}$")` — el PIN de firma real es siempre exactamente 4 dígitos numéricos, nunca un valor de longitud libre. El `signatureSchema` original (`z.string().min(6, ...)`, heredado del campo `password`) nunca se corrigió al pasar de "contraseña de cuenta" a "PIN de firma" — con la validación `min(6)` intacta, cualquier PIN real de 4 dígitos configurado por un usuario queda bloqueado en el propio cliente antes de llegar a la red, un bug independiente del mismatch de nombre de campo (D1) y que lo hubiera enmascarado: aun corrigiendo `password` → `pin`, el formulario seguiría sin poder enviar un PIN real de 4 dígitos.

**Fix**: `signatureSchema` valida `pin: z.string().regex(/^\d{4}$/, 'El PIN debe tener 4 dígitos')` en vez de `min(6)`. `FirmarPublicarDocumentoValidator.cs:9` solo exige `NotEmpty()` sobre `Pin` (no repite el formato) — la validación de forma completa ya ocurre una sola vez, en `SetPinValidator`, al configurar el PIN; el schema del frontend replica ese mismo formato para dar feedback inline antes de enviar la firma, consistente con cómo se generó el PIN que el usuario realmente tiene.

### D2 — Eliminar el código muerto en el mismo change

Se elimina en vez de dejarlo para un cutover de limpieza futuro, porque las tres piezas comparten archivo (`documents.api.ts`, `useDocumentForm.ts`) con el fix de D1 y el costo incremental de tocarlas ahora es bajo:
- `useDocumentForm.ts`: ambas ramas `if (data.archivo) { ... }` (creación y edición), y el campo `archivo` de `documentFormSchema`/`DocumentFormInput` (`documentForm.schema.ts`).
- `documents.api.ts`: `changeDocumentStatus()`, `ChangeDocumentStatusPayload`, `createDocument()`, `updateDocument()`.
- `createDocument.schema.ts`/`updateDocument.schema.ts`/`changeDocumentStatus.schema.ts`: archivos completos (y sus tests), sin otro consumidor conocido (confirmado por lectura directa y grep — ningún componente ni hook los importa fuera de `documents.api.ts` y sus propios archivos de test).

**Alternativa descartada**: dejar la limpieza para un change futuro. Se descarta porque el propio hallazgo (Sección 2/3 de la investigación previa) ya identificó que ninguna de las tres piezas tiene consumidor real ni ruta backend — no hay riesgo de romper nada, y separarlo en otro change solo pospone una limpieza ya diagnosticada.

### Hallazgo real durante implementación — `useDocuments.ts` tenía una segunda capa muerta de hooks envolviendo las mismas funciones API ya identificadas como código muerto

Encontrado por un test que rompió de verdad (`useDocuments.test.ts`, suite `useCreateDocument`), no por inspección estática: `npx tsc --noEmit` (el comando que se usó para verificar 2.4/3.5) es un no-op silencioso en este proyecto — `tsconfig.json` raíz tiene `"files": []` y solo `references` a project composite (`tsconfig.app.json`/`.node.json`/`.sw.json`), así que sin `-b` no compila nada y nunca iba a detectar un import roto. El comando real de build es `npm run build` (`tsc -b && vite build`), confirmado en `package.json`. Correr `npx tsc -b --force` sí detectó el problema real: `useDocuments.ts` (`features/documents/hooks/`) tenía su propio `useCreateDocument`/`useUpdateDocument`/`useChangeDocumentStatus`/`useDeleteDocument` — una segunda capa de hooks, nunca importada desde ningún componente real (confirmado por grep en todo `src/`), que envolvía exactamente las mismas `createDocument()`/`updateDocument()`/`changeDocumentStatus()`/`deleteDocument()` de `documents.api.ts` ya identificadas como código muerto en la Sección 2 de la investigación previa — la investigación original no encontró esta segunda capa porque solo grepeó consumidores de las funciones API, no de los hooks que las envolvían.

**Fix**: `useDocuments.ts` se reduce a los tres hooks de query que sí tienen consumidor real (`useDocuments`, `useDocumentsByCode`, `useDocument` — usados por `DocumentoQECombobox.tsx`, `DocumentoNCCombobox.tsx`, `DocumentActionPanel.tsx`, `useDocumentList.ts`, `useDocumentForm.ts`). Se elimina el resto del archivo (los cuatro hooks de mutación muertos y sus imports ahora huérfanos de `documents.api.ts`/`createDocument.schema.ts`/`updateDocument.schema.ts`) y los dos `describe` de `useDocuments.test.ts` que los cubrían (`useCreateDocument`, `useChangeDocumentStatus`) — se conservan los tres `describe` que prueban los hooks reales. Nota: `useDocumentActions.ts` define su propio `useDeleteDocument(documentId: string)` (firma distinta, con argumento) que sí es el real — la colisión de nombre entre ambos archivos ya existía antes de este change y no se resuelve aquí (fuera de alcance; el archivo muerto que lo contenía ya se elimina de todas formas).

**Lección para el resto de este change**: la Sección 2/3 de este `design.md` y `tasks.md` quedan re-verificadas con el comando de build real (`tsc -b`), no con el `tsc --noEmit` no-op — confirmado limpio salvo un error preexistente y no relacionado en `features/incidents/components/IncidentForm.tsx` (módulo ya modificado antes de este change, ver `git log`, fuera de alcance).

### Hallazgo real durante verificación — la marca de agua "OBSOLETO — No usar" (RN-DOC-003) no tiene ninguna ruta real que la produzca

Encontrado al verificar 6.9 (exportar PDF controlado de un documento `OBSOLETO`): `POST /:id/exportar-pdf` contra el backend real responde `422` ("Solo se puede exportar el PDF controlado de un documento PUBLICADO") para cualquier estado que no sea `PUBLICADO` — confirmado leyendo `ExportarPdfControladoHandler.cs:23-24`, que solo genera el PDF (`DocumentoPdfGenerator.GenerarControlado`) cuando `documento.Estado == DocStatus.PUBLICADO`, sin excepción para `OBSOLETO`. Ese generador tampoco implementa ninguna lógica de marca de agua "OBSOLETO — No usar" — su única marca de agua real es "COPIA NO CONTROLADA — Solo válido al momento de impresión" + nombre del descargador + fecha (RN-DOC-007), confirmado por lectura directa de `DocumentoPdfGenerator.cs:40-67`, sin ninguna referencia a `OBSOLETO` en todo `Features/Documentos/Shared/`.

La única implementación existente de la marca de agua "OBSOLETO — No usar" (RN-DOC-003) vive en `src/utils/documentPdf.ts` (`requestDocumentPdf`/`requestDocumentView`, spec `document-pdf-security`) — un flujo cliente-side heredado de la era 100% MSW que generaba una página HTML con la marca de agua dinámica en el propio navegador, documentado en su momento con un `TODO` explícito ("server-side PDF generation... deferred until the .NET backend exists"). Confirmado por grep en todo `shc-controldoc/src`: **ningún componente ni hook invoca `requestDocumentPdf`/`requestDocumentView` hoy** — es código muerto, superado por el flujo real (`useGetArchivoUrl`/`getArchivoUrl()`, wireado en `DocumentActionPanel.tsx`, que abre directamente la URL firmada del archivo real vía `GET /:id/archivo`, sin ninguna marca de agua HTML intermedia).

**Conclusión**: RN-DOC-003 (marca de agua de PDF exportado sobre documentos `OBSOLETO`) no tiene hoy ninguna ruta funcional alcanzable desde la UI real — ni el código viejo (muerto, sin consumidor) ni el código nuevo (bloquea `OBSOLETO` por completo, y aunque no lo bloqueara, no implementa esa marca de agua). Esto es un hallazgo informativo, no bloqueante y **fuera de alcance de este change** — corregirlo requeriría diseñar la generación server-side de esa marca de agua para `OBSOLETO` (el `TODO` original del código muerto ya anticipaba este trabajo pendiente), lo cual es trabajo nuevo de producto, no una corrección de contrato como el resto de este change. Se documenta para un change futuro dedicado a completar RN-DOC-003 contra el backend real, posiblemente junto con la limpieza del código muerto de `documentPdf.ts` (mismo patrón que el `archivo`/`upload` vestigial de D2, pero fuera del scope ya cerrado de este change).

## Risks / Trade-offs

- **[Riesgo] D1 es un cambio de contrato interno (frontend↔backend) sin backend real desplegado aún en producción** → Mitigación: no hay usuarios reales afectados (Documentos vivió 100% en MSW hasta este change); el handler MSW de `/sign` (`document-approval-flow` spec, "MSW handlers") sigue validando `password` para los módulos aún no cutover-eados — se actualiza junto con el resto de fixtures/handlers de Documentos si el cutover requiere `VITE_ENABLE_MSW=false` solo temporalmente (ver Migration Plan).
- **[Riesgo] Eliminar `createDocument()`/`updateDocument()`/`changeDocumentStatus()` podría romper un test que aún los importe** → Mitigación: se inspeccionan explícitamente los tests de Documentos antes de eliminar (paso 1 de Migration Plan), mismo criterio que los cutovers anteriores.
- **[Riesgo] RN-DOC-001/RN-DOC-005 nunca se ejercitaron en un flujo de firma real end-to-end (solo vía API directa en sesiones previas)** → Mitigación: verificación explícita en navegador en este change, con un escenario de dos versiones del mismo código y un QE vinculado activo antes de firmar la nueva versión, para confirmar el bloqueo real (409) en la UI, no solo por API.

## Migration Plan

1. Inspeccionar los tests de Documentos que referencien `signatureSchema`, `SignDocumentPayload`, `createDocument`, `updateDocument`, `changeDocumentStatus`, `changeDocumentStatusSchema` o el campo `archivo`, para no romperlos a ciegas.
2. Frontend: aplicar D1 (`documentAction.schema.ts`, `DocumentSignatureModal.tsx`, `documents.api.ts`) y D2 (eliminar código muerto de `useDocumentForm.ts`, `documents.api.ts`, `documentForm.schema.ts`, `createDocument.schema.ts`, `updateDocument.schema.ts`, `changeDocumentStatus.schema.ts` y sus tests).
3. Actualizar el handler MSW de `POST /documents/:id/sign` (y su fixture/validación) para aceptar `{ pin }` en vez de `{ password, timestamp }`, manteniendo el resto de módulos funcionando contra MSW sin cambios de comportamiento observable.
4. `shc-controldoc/.env.development`: `VITE_ENABLE_MSW=false`, apuntar al backend .NET local (Postgres dev).
5. Verificar en navegador: CRUD completo, las 6 transiciones de estado (incluida la firma real con PIN), nueva versión (menor/mayor), revisión periódica, reemplazo de archivo original, exportar PDF controlado, descarga con registro de auditoría, vinculación con QE y NC — con atención particular a RN-DOC-001 y RN-DOC-005 en el flujo de firma real.
6. Diagnosticar y documentar (causa raíz, archivo + línea) cualquier discrepancia nueva encontrada antes de corregirla — mismo criterio que `cutover-incidentes`.
7. Revertir `.env.development` a `VITE_ENABLE_MSW=true` al terminar.
8. No tocar `.env.production`.

**Rollback:** revertir `VITE_ENABLE_MSW` a `true` restaura el comportamiento anterior de inmediato en el frontend. D1/D2 no tienen componente de backend ni migración de base de datos — un `git revert` del commit de frontend es suficiente si algo sale mal; no hay estado persistido que limpiar.

## Open Questions

Ninguna pendiente de decisión de producto — la única decisión abierta en la investigación previa (qué opción de fix usar para D1) ya se resolvió arriba. Preguntas técnicas menores a confirmar durante la implementación, no bloqueantes para empezar:
- Si el handler MSW de `/sign` debe seguir aceptando `password` como alias temporal durante la transición, o si se reemplaza directamente por `pin` en el mismo commit — se decide al tocar el handler (paso 3), evaluando si algún test existente depende del nombre `password` en el mock.
