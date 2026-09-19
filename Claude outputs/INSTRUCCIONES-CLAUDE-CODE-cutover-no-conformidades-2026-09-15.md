# Instrucciones para Claude Code — Cutover: No Conformidades

Fecha: 2026-09-15
Autor: Cowork, tras investigar el código real (frontend `shc-controldoc`, backend `.NET`) vía
device bridge. Quinto módulo del roadmap de cutover — Auth, Catálogos, Incidentes y Documentos ya
quedaron cerrados y verificados (archivado manual pendiente de tu confirmación en los últimos dos).
Nota de contexto: el bridge de shell a tu compu sigue caído (Windows, sin fecha de resolución
confirmada), así que esta investigación la hice leyendo archivos puntuales en vez de con
`grep`/`git log` — puede que se me haya escapado algo que un barrido más amplio hubiera
encontrado; verificá con más cuidado de lo habitual si algo no cuadra.

Toño ya eligió seguir con No Conformidades — **no le vuelvas a preguntar si conviene**. A
diferencia de los cuatro cutovers anteriores, acá **no encontré ningún mismatch de contrato
bloqueante** — el módulo es más chico y ya viene más prolijo. Sí hay un hallazgo informativo
importante (la máquina de estados principal no tiene ninguna UI real todavía) que cambia cómo
tenés que verificar este change, y dos piezas de código muerto sin riesgo.

## 1. Hallazgo informativo importante — la transición de estados principal de la NC no tiene ninguna UI real

A diferencia de Incidentes/Documentos (que tienen *al menos algunos* botones de transición
wireados), acá **ninguno** de los pasos centrales del ciclo de vida de una No Conformidad tiene un
punto de entrada real en la UI:

- `getNCPermissions()` (`ncPermissions.ts`) calcula `canIniciarInvestigacion`,
  `canRegistrarCorreccion`, `canSolicitarCierre` — ninguno de los tres se consume en
  `NonconformityDetailPage.tsx` (confirmé por grep: solo se usan `canCrearQE`, `canAnular` y
  `canAsignarAC`, este último pasado a `ACSection`). No hay ningún botón "Iniciar investigación",
  "Registrar corrección" ni "Solicitar cierre" en la página real.
- `cambiarEstadoNCSchema` (`cambiarEstadoNC.schema.ts`, con `nuevoEstado`/`comentario`/
  `correccionEvidenciaUrl`) no tiene ningún consumidor fuera de su propio archivo y su propio test
  — confirmé por grep en todo `features/nonconformities`.
- `useUpdateNonconformity()` (el único hook de mutación PATCH real) está tipado con `UpdateNCInput`
  (`updateNCSchema`), que **no tiene el campo `estado`** — ni siquiera existe la posibilidad de
  cambiar el estado a través del único hook wireado.

El backend sí soporta la transición: `ActualizarNoConformidadCommand.Estado` (opcional) viaja en el
mismo `PATCH /:id` genérico que el resto de los campos — decisión ya documentada en el propio
código (`ActualizarNoConformidadHandler.cs`, comentario: "NC solo tiene un PATCH /:id que cubre
ambos casos [edición e cambio de estado]", a diferencia de Incidentes que separa investigación de
estado en dos endpoints). El contrato existe y está bien armado (dispara notificación best-effort
en `estadoCambio`, bloquea con 409 en estados terminales) — **simplemente nadie construyó todavía
los botones que lo invoquen** con `estado` en el payload.

**No es un mismatch como los de Documentos/Incidentes** (no hay dos lados que no coincidan) — es
un módulo cuyo ciclo de vida central (`ABIERTA → EN_INVESTIGACION → ANALISIS_COMPLETADO →
EN_EJECUCION → PENDIENTE_CIERRE → CERRADA`) hoy solo se puede ejercitar por API directa, nunca
clickeando en la UI real. Esto cambia cómo verificar este cutover: no vas a poder hacer clic en un
botón de "iniciar investigación" porque no existe — verificá esas transiciones con requests
directos contra el backend real (igual que ya se hizo con `PATCH /status` de Incidentes y el
cambio de estado directo de Quality Events en sesiones previas), y documentalo como hallazgo
informativo en `design.md`, no como bug a corregir en este change — construir esa UI es trabajo de
producto nuevo, no una corrección de contrato. Si Toño quiere que se construya esa UI ahora, es su
decisión — no la tomes vos solo.

## 2. Código muerto, sin riesgo — no hace falta tocarlo para el cutover

- `cambiarEstadoNCSchema`/`CambiarEstadoNCInput` — sin consumidor (ver punto 1). Podés dejarlo o
  eliminarlo junto con el resto de la limpieza si te resulta cómodo, no es necesario para que el
  cutover funcione.
- `documentosVinculados` en `createNCSchema`: `NCForm.tsx` inicializa el campo en `[]` y lo
  reenvía tal cual en el submit, pero **no tiene ningún control de UI** que permita al usuario
  seleccionar documentos al crear la NC (confirmé por grep — no hay ningún combobox/picker
  wireado a `documentosVinculados` en el formulario). Siempre viaja como `[]` en la práctica.
  `CrearNoConformidadCommand` (backend) ni siquiera tiene ese campo — no hace falta agregarlo: la
  vinculación real Documento↔NC ya existe como flujo separado, post-creación
  (`NCDocumentosVinculadosSection.tsx`, ya cutover-eado y verificado en `fs-vinculacion-documento-nc`).
  Mismo patrón que el `archivo` vestigial de Documentos — informativo, no bloqueante.
- `NCFilters.origen`/`NCFilters.reportadoPorId` (tipo del frontend) no tienen control real en
  `NCListFilters.tsx` — el backend (`ListarNoConformidadesQuery`) tampoco los soporta. Coherente,
  no hace falta agregar nada.

## 3. El resto del contrato coincide — confirmado ruta por ruta y campo por campo

Las 10 rutas de `Features/NoConformidades/` están registradas en `EndpointExtensions.cs` y
coinciden 1:1 con `nonconformities.api.ts`: `GET /api/nonconformities` (list, con `Estado`/`Tipo`/
`Severidad`/`Dominio`/`AreaId`/`Search`/`FechaDesde`/`FechaHasta`/`ShowDeleted`/paginación — todos
los filtros que sí tienen UI real), `GET .../:id`, `POST /api/nonconformities` (create),
`PATCH .../:id` (edición genérica, incluye `qeGeneradoId` para la vinculación inversa con QE, ya
verificada antes), `POST .../:id/anular`, `DELETE .../:id`, `PATCH .../:id/restore`,
`POST .../:id/acciones-correctivas`, `PATCH .../:id/acciones-correctivas/:acId`,
`POST .../:id/acciones-correctivas/:acId/cerrar`. La vinculación Documento↔NC
(`POST`/`DELETE .../:id/documentos-vinculados[/:documentoId]`) también está registrada.

`CrearNoConformidadCommand` coincide campo por campo con `createNCSchema` (dominio, origen, tipo,
severidad, titulo, areaId, procesoInvolucrado, descripcion, fechaDeteccion, fechaCierre,
detectadoPorId, requiereIPER — ignorado deliberadamente server-side por RN-NC-001, turno,
mineralInvolucrado, accionInmediata, forzar). `AnularNoConformidadCommand`/`anularNCSchema`
(`justificacion`), `CrearAccionCorrectivaCommand`/`createACSchema` (titulo, descripcion,
responsableId, plazoFecha, prioridad) y `CerrarAccionCorrectivaCommand`/`cerrarACSchema`
(descripcionEvidencia, evidenciaUrl) coinciden exactamente.

## 4. Estrategia — mismo patrón que los cutovers anteriores, con la salvedad del punto 1

1. Backend local (`dotnet run` + Postgres dev), `.env.development` local con MSW apagado mientras
   verificás — no toques `.env.production`.
2. Verificación funcional: CRUD completo de NC, anular, las acciones correctivas (crear/actualizar/
   cerrar), vinculación con QE (ya verificada antes, confirmá que sigue funcionando) y con
   Documentos (ídem). Para las transiciones de estado principales (punto 1), verificá por API
   directa contra el backend real — no hay clic posible en la UI actual — y documentá los
   resultados igual que el resto.
3. No hace falta tocar ningún endpoint ni command del backend para este cutover — no encontré
   ningún mismatch de contrato que lo requiera. Si encontrás algo que yo no vi, documentalo con el
   mismo criterio de los cutovers anteriores (causa raíz, archivo + línea, Decision en `design.md`).

## 5. Ciclo OpenSpec

El hallazgo de la Sección 1 (transición de estados sin UI) es informativo — documentalo en
`design.md` como hallazgo de verificación, con la aclaración de que no es un mismatch a corregir
sino trabajo de producto pendiente (construir la UI), fuera de alcance de este change salvo que
Toño decida explícitamente incluirlo. Los hallazgos de la Sección 2 son opcionales, mismo criterio
que la limpieza de código muerto de `cutover-documentos`.
