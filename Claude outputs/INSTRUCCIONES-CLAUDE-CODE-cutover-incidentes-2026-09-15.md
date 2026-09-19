# Instrucciones para Claude Code — Cutover: Incidentes

Fecha: 2026-09-15
Autor: Cowork, tras investigar el código real (frontend `shc-controldoc`, backend `.NET`) vía
device bridge. Tercer módulo del roadmap de cutover — Auth y Catálogos (Areas/Empresas/Locales/
Zonas) ya quedaron cerrados, verificados y archivados. Nota de contexto: el bridge de shell a tu
compu está caído por un tema de Windows (sin fecha de resolución confirmada), así que esta
investigación la hice leyendo archivos puntuales en vez de con `grep`/`git log` — puede que se me
haya escapado algo que un barrido más amplio hubiera encontrado; verificá con más cuidado de lo
habitual si algo no cuadra.

Toño ya eligió seguir con Incidentes — **no le vuelvas a preguntar si conviene**. Sí hay un
hallazgo bloqueante real, más serio que los de los dos cutovers anteriores, y una decisión de
producto que dejo explícitamente para confirmar con él.

## 1. Hallazgo bloqueante — el módulo offline/mobile (M7) nunca se terminó de modelar en el backend

Esto **no es una sorpresa que yo descubrí de la nada** — está documentado explícitamente en el
propio código: el comentario de `ActualizarInvestigacionCommand.cs` dice textualmente que
"testigos, personalInvolucrado, atencionMedica*, evidencias, geoUbicacion, ... no están en el shape
confirmado de este cambio... quedan para una extensión futura" (`be-incidentes-catalogos`). Esa
extensión futura nunca llegó — confirmé que sigue así hoy:

- **`Domain/Entities/Incidente.cs` no tiene ningún campo para fotos de evidencia
  (`IncidentEvidencia[]`) ni para `geoUbicacion`** (coordenadas GPS capturadas en el reporte
  mobile) — ninguno de los dos existe en la entidad, en ningún lado. Tampoco existen
  `testigos`, `personalInvolucrado`, `equiposInvolucrados`, `atencionMedicaRequerida`,
  `atencionMedicaDescripcion`, `notificacionAmbientalRequerida`, `informeMedicoAdjunto` — todos
  presentes en el tipo `Incidente` del frontend (`types/incident.types.ts`), ninguno en el backend.
- **`CrearIncidenteCommand` tampoco los acepta** — ni siquiera como campos opcionales ignorados;
  literalmente no existen en el record. Esto significa que **hoy, contra el backend real, un
  reporte mobile con fotos y GPS pierde esos datos en silencio** al crearse — no hay error, el
  JSON extra simplemente no se bindea a nada.
- El flujo offline completo (`useOfflineIncidentSync.ts`, cola FIFO con Background Sync API,
  compresión de fotos, captura de geolocalización) es una pieza real y no trivial del producto — no
  es un detalle menor a resolver de pasada. Antes de dar este módulo por cutover-eado, el backend
  necesita modelar estos campos (columnas nuevas en `Incidente`, más el storage de archivo real
  para las fotos — mismo patrón `PlanoStorageService`/`DocumentoStorageService` ya usado en
  Locales/Documentos, dev-only por ahora).
- Documentá esto en `design.md` como Decision, no como hallazgo sorpresa — la referencia ya existe
  en el propio código (`ActualizarInvestigacionCommand.cs`), así que es la continuación de un punto
  ya señalado, no algo nuevo que "se coló".

## 2. Segundo hallazgo — la excepción de `empresaId` en sync offline no tiene contraparte real

`createIncidentOfflineSync()` (`features/incidents/api/incidents.api.ts`) manda `empresaId`
explícito en el body de `POST /api/incidents`, con un comentario que documenta la razón: el reporte
debe registrarse bajo la empresa activa **al momento de encolarlo offline**, no la que esté activa
al momento de sincronizar (decisión de producto ya tomada, `m7-f2-offline-sync design.md D8`). El
comentario dice "el mock valida membresía server-side antes de confiar en el valor".

Confirmé que **el backend real no tiene ningún mecanismo para esto**: `CrearIncidenteCommand` no
tiene ningún campo `EmpresaId`, y `CrearIncidenteEndpoint.Handle` usa siempre
`user.GetEmpresaActivaId()!.Value` del JWT de sesión — cualquier `empresaId` en el body se ignora
sin error. Esto es el mismo patrón de multi-tenancy que se respetó en absolutamente todos los demás
módulos ("mutaciones fijan `empresaId` desde la sesión, nunca del body") — acá el mock se desvió a
propósito de esa regla y el backend nunca replicó la desviación.

**Consecuencia real si se cutover-ea tal cual está hoy**: un usuario que reporta varios incidentes
offline en una empresa, después cambia de empresa activa (usuario multi-empresa) antes de recuperar
conexión, va a ver sus reportes offline registrados silenciosamente bajo la empresa nueva, no la
que estaba activa cuando los reportó en campo. Sin error visible.

**Decisión a confirmar con Toño, no la resuelvas en silencio**: ¿el backend real debe soportar esta
excepción (agregar `EmpresaId` opcional al command, validando que el actor sea miembro de esa
empresa antes de confiarlo — replicando lo que dice el comentario del mock), o directamente se
descarta la excepción y todo reporte offline se registra bajo la empresa activa al sincronizar
(cambiando el diseño original de `m7-f2-offline-sync`)? Es una decisión de producto real, con
trade-offs de seguridad de datos, no algo que se deba resolver solo por conveniencia técnica.

## 3. Hallazgo menor — ruta de cierre de AC sin contraparte

`cerrarAC()` llama a `PATCH /api/incidents/:incidenteId/acciones/:acId/cerrar` — esa ruta no existe
en el backend. Sí existe `PATCH /api/incidents/{incidenteId}/acciones/{acId}`
(`ActualizarAccionCorrectivaEndpoint`), y su `Command` ya tiene todos los campos necesarios
(`Estado`, `DescripcionEvidencia`, `EvidenciaUrl`) para expresar un cierre completo. Es tu criterio
cuál de las dos rutas prefiere: agregar un endpoint delgado `/cerrar` que delega al mismo handler
(mantiene el contrato frontend intacto), o cambiar `cerrarAC()` para llamar al PATCH genérico con
`estado: 'CERRADA'` (menos código nuevo, pero toca el cliente). No es una decisión que necesite mi
input — elegí la que te resulte más simple, documentala igual como Decision.

## 4. El resto del contrato coincide — confirmado ruta por ruta

`GET /api/incidents`, `GET /api/incidents/:id`, `POST /api/incidents` (sin los campos de la Sección
1/2), `PATCH /api/incidents/:id` (investigación), `PATCH /api/incidents/:id/status`,
`DELETE /api/incidents/:id`, `PATCH /api/incidents/:id/restore`,
`POST /api/incidents/:id/acciones`, `PATCH /api/incidents/:id/acciones/:acId` — los 8 coinciden
1:1 en path y verbo entre `incidents.api.ts` y `Features/Incidentes/`. La vinculación con Quality
Event (`PATCH /api/incidents/:id { qeId }`) también está — `ActualizarInvestigacionCommand.QeId`
existe y se documenta como agregado en `be-quality-events` D9, replicando el flujo real del
frontend (`QualityEventForm.tsx` dispara el PATCH tras crear el QE).

## 5. Estrategia — mismo patrón que los cutovers anteriores, con una salvedad

1. Backend local (`dotnet run` + Postgres dev), `.env.development` local con MSW apagado mientras
   verificás — no toques `.env.production`.
2. Resolvé primero los hallazgos de las Secciones 1 y 2 (son los que bloquean el módulo) antes de
   intentar verificar el flujo mobile completo en navegador.
3. **Salvedad de este módulo**: el flujo offline usa Service Worker + Background Sync API — no se
   puede verificar completo solo con DevTools en modo "offline" simulado del navegador de
   escritorio; confirmá que tu verificación cubre al menos el ciclo completo (encolar offline →
   reconectar → sync automático) en un entorno donde el Service Worker realmente controla la
   página, no solo el camino feliz de request/response online.
4. Verificación funcional: CRUD de incidente completo, cambio de estado, ACs (crear/actualizar/
   cerrar), vinculación con QE, y el ciclo offline completo del punto anterior con fotos y
   geolocalización reales una vez que el backend los soporte.

## 6. Ciclo OpenSpec

Dado que el hallazgo de la Sección 1 es efectivamente extender el modelo de datos de un módulo ya
archivado (`be-incidentes-catalogos`), documentalo como continuación de esa spec, no como una
regla de negocio nueva inventada por este cambio — mismo criterio que ya usamos con
`ListarZonasHandler` en el cutover de catálogos.
