# Instrucciones para Claude Code — Cutover: Documentos

Fecha: 2026-09-15
Autor: Cowork, tras investigar el código real (frontend `shc-controldoc`, backend `.NET`) vía
device bridge. Cuarto módulo del roadmap de cutover — Auth, Catálogos e Incidentes ya quedaron
cerrados, verificados y archivados. Nota de contexto: el bridge de shell a tu compu sigue caído
(Windows, sin fecha de resolución confirmada), así que esta investigación la hice leyendo archivos
puntuales en vez de con `grep`/`git log` — puede que se me haya escapado algo que un barrido más
amplio hubiera encontrado; verificá con más cuidado de lo habitual si algo no cuadra.

Toño ya eligió seguir con Documentos — **no le vuelvas a preguntar si conviene**. Hay un hallazgo
bloqueante real (mismatch de contrato en la firma), uno informativo (código muerto de un upload
vestigial) y el resto del contrato coincide.

## 1. Hallazgo bloqueante — la firma (`POST /:id/sign`) nunca le va a llegar el PIN al backend real

`DocumentSignatureModal.tsx` (`onSubmit`) manda:

```ts
await signMutation.mutateAsync({ password: data.password, timestamp: new Date().toISOString() })
```

`signDocument()` (`documents.api.ts`) postea ese objeto tal cual a `POST /api/documents/:id/sign`.
El backend real (`FirmarPublicarDocumentoCommand`) es:

```csharp
public sealed record FirmarPublicarDocumentoCommand(string Pin);
```

**El nombre de la propiedad no coincide** (`password` vs `Pin`) y el campo `timestamp` que manda
el frontend no existe en el command — el binder de JSON de ASP.NET Core no va a poblar `Pin` desde
una clave `password`, así que `command.Pin` va a llegar `null`/vacío en cada intento real. El
handler primero valida `actor.PinHash is null` (mensaje: "Debés configurar tu PIN de firma") y
después `pinHasher.VerifyHashedPassword(...)` — con `Pin` vacío, la verificación **siempre va a
fallar** con "PIN incorrecto" (401), sin importar que el usuario tenga un PIN configurado y lo
tipee bien. Contra MSW esto nunca se notó porque el mock no valida el nombre del campo con el mismo
rigor que el binder real de .NET.

Esto es un mismatch de contrato real entre el schema del frontend (`signatureSchema` en
`documentAction.schema.ts`, que define el campo como `password`) y el command del backend — no es
una decisión de producto, es que ambos lados nunca se verificaron uno contra el otro porque
Documentos vivió 100% en MSW hasta ahora. **Bloqueante**: nadie va a poder publicar un documento
(`EN_APROBACION -> PUBLICADO`) contra el backend real hasta que se corrija.

**Tu criterio para el fix** (documentalo como Decision, cualquiera de las dos sirve, elegí la que
te resulte más simple):
- Cambiar `DocumentSignatureModal.tsx`/`signatureSchema` para mandar `pin` en vez de `password`
  (el campo ya es visualmente un PIN de firma, no una contraseña de cuenta — el label/legalText del
  modal ya hablan de "firma", así que renombrar el campo es coherente con lo que el usuario ve), y
  sacar `timestamp` del payload (`SignDocumentPayload`/`FirmarPublicarDocumentoCommand` — el backend
  ya registra su propio `Timestamp = DateTime.UtcNow` server-side en el audit trail, nunca confía en
  uno del cliente).
- O ajustar solo el nombre de la propiedad en el objeto que arma `onSubmit` (`{ pin: data.password,
  timestamp: ... }`) sin tocar el campo del formulario — menos prolijo (el nombre interno de la
  variable sigue sin reflejar qué es), pero touch mínimo si preferís no tocar el schema/label.

## 2. Hallazgo informativo, no bloqueante — el upload de "archivo de trabajo" es código muerto

`useDocumentForm.ts` tiene una rama `if (data.archivo) { ... POST /api/documents/:id/upload ... }`
tanto en creación como en edición. Confirmé que:

- El campo `archivo` **no tiene ningún control de UI** en `DocumentForm.tsx` — el único
  `FileUploadField` wireado es para `archivoOriginalFile` (`archivo-original`, que sí es real). Sin
  UI, `data.archivo` siempre es `null` en la práctica — esta rama nunca se ejecuta hoy.
- El backend real **no tiene ningún endpoint `/upload`** en `Features/Documentos/` — y esto no es
  un descuido: `DocumentoArchivoVigenteResolver.cs` (el que resuelve qué archivo mostrar en
  `GET /:id/archivo`) lo documenta explícitamente en su propio comentario: *"el documento no tiene
  un 'archivoUrl' genérico en este backend (el 'archivo de trabajo' del mock es vestigial, ver
  design.md D2)"* — decisión ya tomada en `be-documentos`, el archivo vigente siempre resuelve entre
  el original (`archivoOriginalUrl`) y el PDF de distribución generado al firmar
  (`archivoDistribucionUrl`), nunca un tercer archivo genérico.
- El propio MSW handler de `/upload` tiene una nota reconociendo que es una simulación
  ("MSW cannot parse multipart/form-data boundaries... ignores the request body").

No es bloqueante — no rompe nada porque nunca se ejecuta contra código real. Te lo señalo para que
decidas si limpiar el código muerto (`if (data.archivo)` en ambas ramas de `useDocumentForm.ts`,
el campo `archivo` del schema, y las funciones no usadas en `documents.api.ts` — ver punto 3) en
este change o dejarlo para un cutover futuro de limpieza. Tu criterio.

## 3. Hallazgo menor — dos funciones muertas en `documents.api.ts`

- `changeDocumentStatus()` hace `POST /api/documents/:id/status` — esa ruta no existe en el
  backend (que solo mapea `PATCH /api/documents/:id/status`, `CambiarEstadoDocumentoEndpoint`).
  Confirmé que el hook real (`useDocumentActions.ts`, `usePatchDocumentStatus`) usa
  `patchDocumentStatus()` (`PATCH`), no `changeDocumentStatus()` — esta última no tiene ningún
  consumidor real, mismo patrón que el `archivo`/`upload` del punto 2.
- `createDocument()`/`updateDocument()` (con los tipos `CreateDocumentInput`/`UpdateDocumentInput`
  de `createDocument.schema.ts`/`updateDocument.schema.ts`) tampoco tienen consumidor — el form
  real (`useDocumentForm.ts`) llama a `api.post`/`api.put` directamente con `documentFormSchema`
  (`DocumentFormInput`), no a estas funciones. Ambos schemas duplicados (`createDocument.schema.ts`
  vs `documentForm.schema.ts`) describen el mismo recurso con validaciones ligeramente distintas —
  posible fuente de confusión futura, no urgente.

Ninguno de los dos bloquea el cutover (el código real usa las funciones correctas), pero quedan
señalados por si querés limpiarlos junto con el punto 2.

## 4. El resto del contrato coincide — confirmado ruta por ruta

Las 16 rutas de `Features/Documentos/` están registradas en `EndpointExtensions.cs` y coinciden
1:1 en path/verbo con `documents.api.ts`: `GET /api/documents` (list), `GET .../pendientes/count`,
`GET .../:id`, `POST /api/documents` (create), `PUT .../:id` (edit), `PATCH .../:id/status`,
`DELETE .../:id`, `PATCH .../:id/restaurar`, `POST .../:id/sign` (mismatch de payload, ver punto 1
— la ruta en sí está bien), `POST .../:id/nueva-version`, `PATCH .../:id/confirmar-revision`,
`GET .../:id/archivo`, `GET .../:id/download-url`, `POST .../:id/audit/access`,
`GET .../:id/archivo-original` + `POST .../:id/archivo-original` (reemplazo real, multipart),
`GET .../:id/archivo-distribucion`, `GET /api/documents/stream/:token` (streaming del archivo
firmado, vía token de `DocumentoSignedUrlService`). La vinculación Documento↔QE y Documento↔NC
(`fs-vinculacion-documento-qe`/`fs-vinculacion-documento-nc`, ya cutover-eadas y verificadas en
sesiones anteriores) también están registradas y no requieren trabajo adicional en este change.

`CrearDocumentoCommand`/`EditarDocumentoCommand` (backend) coinciden campo por campo con
`documentFormSchema` (frontend) — incluido `version` (formato `vX.Y`, validado con regex en ambos
lados) y la regla RN-DOC-020 (brecha mínima entre `fechaVigencia` y `fechaRevisionProxima`), que ya
está implementada en el backend según lo verificado en sesiones anteriores de esta misma spec.

## 5. Estrategia — mismo patrón que los cutovers anteriores

1. Backend local (`dotnet run` + Postgres dev), `.env.development` local con MSW apagado mientras
   verificás — no toques `.env.production`.
2. Resolvé primero el hallazgo de la Sección 1 (bloquea publicar cualquier documento) antes de
   intentar verificar el flujo completo en navegador.
3. Verificación funcional: CRUD completo de documento, las 6 transiciones de estado (incluida la
   firma real con PIN una vez corregida), nueva versión (menor/mayor), revisión periódica,
   reemplazo de archivo original, exportar PDF controlado, descarga con registro de auditoría,
   vinculación con QE y NC (ya verificadas antes, pero confirmá que siguen funcionando contra este
   backend).
4. Prestá atención en particular a RN-DOC-001 (obsoletización automática de la versión previa al
   publicar) y RN-DOC-005 (bloqueo si la versión previa tiene un QE vinculado activo) —
   ya implementadas y verificadas en `FirmarPublicarDocumentoHandler`, pero es la primera vez que se
   ejercitan en un flujo de firma real end-to-end (antes solo vía API directa).

## 6. Ciclo OpenSpec

El hallazgo de la Sección 1 es un bug de contrato entre dos changes ya archivados
(`be-documentos` y el frontend original de Documentos) — documentalo como hallazgo real de
verificación en `design.md`, con cita de archivo/línea, mismo criterio que los bugs reales
encontrados en `cutover-incidentes`. Los hallazgos de las Secciones 2 y 3 (código muerto) son
opcionales — documentalos igual como Decision si los tocás, o como Open Question si preferís
dejarlos para después.
