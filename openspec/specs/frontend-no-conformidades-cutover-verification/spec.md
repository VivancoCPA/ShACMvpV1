# frontend-no-conformidades-cutover-verification

## Purpose

Verificación manual en navegador / API directa del CRUD de No Conformidades (M2) de `shc-controldoc` contra el backend .NET real + Postgres real, con `VITE_ENABLE_MSW=false` — sin tocar UI ni lógica de cliente. Cubre creación, listado, detalle, edición parcial, eliminación (soft-delete) y restauración de No Conformidades; la anulación con justificación; las Acciones Correctivas de la No Conformidad (crear/actualizar/cerrar); la vinculación No Conformidad↔Quality Event (`qeGeneradoId`) y No Conformidad↔Documentos; y el ciclo completo de transición de estados principal (`ABIERTA → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION → PENDIENTE_CIERRE → CERRADA`) verificado por API directa, dado que `NonconformityDetailPage.tsx` no tiene hoy ningún punto de entrada en la UI para esas transiciones. Documenta explícitamente qué escenarios se verificaron por API directa frente a los verificados de punta a punta en el navegador. Equivalente de No Conformidades a `frontend-incidentes-cutover-verification` (change `cutover-incidentes`).

## Requirements

### Requirement: El CRUD de No Conformidades funciona de punta a punta contra el backend .NET real sin MSW

Con `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando al backend .NET real corriendo localmente contra Postgres real, el sistema SHALL completar la creación, listado, detalle, edición parcial, eliminación (soft-delete) y restauración de No Conformidades con el mismo comportamiento observable que hoy contra MSW.

#### Scenario: Creación de No Conformidad desde el formulario contra el backend real

- **WHEN** un usuario crea una No Conformidad desde `NCForm`, completando dominio, origen, tipo, severidad, título, área, proceso involucrado, descripción, fecha de detección, detectado por, y opcionalmente turno/mineral involucrado/acción inmediata
- **THEN** la NC se crea contra el backend real con `numero` con formato `NC-[DOMINIO_ABBR]-YYYY-NNN`, `estado: 'ABIERTA'`, y `documentosVinculados: []` (el formulario no tiene control de UI para seleccionar documentos al crear — la vinculación real es un flujo posterior)

#### Scenario: Listado de No Conformidades con filtros reales contra el backend real

- **WHEN** un usuario navega `NCListFilters`/`NCListView` aplicando los filtros con control de UI real (`estado`, `tipo`, `severidad`, `dominio`, `areaId`, `search`, `fechaDesde`/`fechaHasta`, `showDeleted`)
- **THEN** la lista renderiza correctamente las No Conformidades reales de la empresa activa vía `GET /api/nonconformities`, paginación incluida

#### Scenario: Edición parcial de una No Conformidad contra el backend real

- **WHEN** un usuario edita una No Conformidad en un estado no terminal, actualizando campos como `responsableInvestigacionId`, `correccion`, `causaRaiz`, `resultadoVerificacion` vía `useUpdateNonconformity()`
- **THEN** el backend real persiste los campos enviados y registra cada uno en el audit trail (`NoConformidadAuditTrail`, acción `CAMPO_EDITADO`)

#### Scenario: Edición bloqueada en estados terminales

- **WHEN** se envía `PATCH /api/nonconformities/:id` sobre una No Conformidad en estado `CERRADA` o `ANULADA`
- **THEN** el backend responde 409 y no modifica la No Conformidad

#### Scenario: Eliminación y restauración de No Conformidad contra el backend real

- **WHEN** un usuario elimina (soft-delete) una No Conformidad y luego la restaura
- **THEN** ambas operaciones se completan contra el backend real y la No Conformidad reaparece en `NCListView` tras restaurarse (filtro `showDeleted`)

### Requirement: La anulación de una No Conformidad funciona contra el backend real

El sistema SHALL completar la anulación de una No Conformidad con justificación, contra el backend .NET real.

#### Scenario: Anular una No Conformidad con justificación

- **WHEN** un usuario anula una No Conformidad desde `NonconformityDetailPage` proporcionando una justificación
- **THEN** `POST /api/nonconformities/:id/anular` persiste `justificacionAnulacion` y el `estado` pasa a `ANULADA` contra el backend real

### Requirement: Las Acciones Correctivas de la No Conformidad funcionan contra el backend real

El sistema SHALL completar la creación, actualización y cierre de Acciones Correctivas de una No Conformidad contra el backend .NET real.

#### Scenario: Crear, actualizar y cerrar una Acción Correctiva contra el backend real

- **WHEN** se invoca `POST /api/nonconformities/:id/acciones-correctivas` (creación), `PATCH /api/nonconformities/:ncId/acciones-correctivas/:acId` (actualización parcial) y `POST /api/nonconformities/:ncId/acciones-correctivas/:acId/cerrar` (cierre con `descripcionEvidencia`, `evidenciaUrl` opcional) en secuencia sobre la misma acción
- **THEN** las tres operaciones se completan contra el backend real, y tras el cierre la acción queda en `estado: 'CERRADA'`

### Requirement: La vinculación de No Conformidad con Quality Event y con Documentos funciona contra el backend real

El sistema SHALL completar la vinculación `NoConformidad.qeGeneradoId` tras crear un Quality Event con origen `O2_NC_DETECTADA`, y la vinculación/desvinculación de Documentos, contra el backend .NET real.

#### Scenario: Crear un QE desde una No Conformidad vincula ambos registros

- **WHEN** se crea un Quality Event vía `POST /api/quality-events` con `origen: 'O2_NC_DETECTADA'` referenciando la No Conformidad, y luego se envía `PATCH /api/nonconformities/:id { qeGeneradoId }` con el id del QE recién creado
- **THEN** el Quality Event queda creado y la No Conformidad de origen queda con `qeGeneradoId` apuntando a él, ambos persistidos contra el backend real

#### Scenario: Vincular y desvincular un Documento a una No Conformidad

- **WHEN** se invoca `POST /api/nonconformities/:ncId/documentos-vinculados` con un `documentoId`, y luego `DELETE /api/nonconformities/:ncId/documentos-vinculados/:documentoId`
- **THEN** ambas operaciones se completan contra el backend real y `documentosVinculados` refleja el estado esperado en cada paso

### Requirement: Las transiciones de estado principales de la No Conformidad se verifican por API directa

La UI actual (`NonconformityDetailPage.tsx`) no tiene ningún punto de entrada para cambiar el estado de una No Conformidad — `canIniciarInvestigacion`/`canRegistrarCorreccion`/`canSolicitarCierre` (`ncPermissions.ts`) no tienen consumidor, y `useUpdateNonconformity()` (tipado con `UpdateNCInput`) no acepta el campo `estado`. El sistema SHALL completar el ciclo de transición de estados (`ABIERTA → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION → PENDIENTE_CIERRE → CERRADA`) contra el backend real vía `PATCH /api/nonconformities/:id { estado }` directo, sin pasar por un botón de la UI. Construir esa UI queda fuera de alcance de este change (ver `design.md`).

#### Scenario: Ciclo completo de transición de estado válido por API directa

- **WHEN** se envía `PATCH /api/nonconformities/:id { estado: '<siguiente>' }` siguiendo el orden `ABIERTA → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION → PENDIENTE_CIERRE → CERRADA`
- **THEN** cada transición se completa (200), el audit trail registra el cambio de `estado`, y se dispara la notificación best-effort a los responsables de Acciones Correctivas no cerradas y al reportante

#### Scenario: Transición bloqueada en un estado terminal

- **WHEN** se envía `PATCH /api/nonconformities/:id { estado: 'EN_INVESTIGACION' }` sobre una No Conformidad ya en `CERRADA` o `ANULADA`
- **THEN** el backend responde 409 y no modifica el estado

### Requirement: MSW se revierte a activo al cerrar la verificación de No Conformidades

El sistema SHALL dejar `shc-controldoc/.env.development` con `VITE_ENABLE_MSW=true` una vez completada la verificación de este change, para no bloquear el desarrollo diario de los módulos de dominio aún no cutover-eados.

#### Scenario: Estado del entorno de desarrollo al cerrar el change

- **WHEN** se inspecciona `shc-controldoc/.env.development` después de cerrado este change
- **THEN** `VITE_ENABLE_MSW` es `true`, igual que antes de iniciar la verificación
