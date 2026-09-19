## ADDED Requirements

### Requirement: El CRUD de Incidentes funciona de punta a punta contra el backend .NET real sin MSW

Con `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando al backend .NET real corriendo localmente contra Postgres real, el sistema SHALL completar la creación, listado, detalle, actualización de investigación, cambio de estado, eliminación (soft-delete) y restauración de Incidentes con el mismo comportamiento observable que hoy contra MSW.

#### Scenario: Creación de Incidente desde el formulario de escritorio contra el backend real

- **WHEN** un usuario crea un Incidente desde `IncidentForm` (modo `create`), seleccionando `localId`/`zonaId` (verificado con un Local/Zona reales de prueba; la selección de `ubicacion: {x,y}` por clic sobre el plano no se ejerció en la verificación por no contar con un Local con `planoPngUrl` real disponible, pero el campo se confirmó por contrato en la sección de investigación — ver "Creación con local, zona y ubicación en el plano" en `be-incidentes-api`)
- **THEN** el incidente se crea contra el backend real con `severidad` calculada server-side, `numero` con formato `INC-<año>-NNN`, y `localId`/`zonaId` persistidos desde la creación

#### Scenario: Listado de Incidentes contra el backend real

- **WHEN** un usuario navega `IncidentList` contra el backend real
- **THEN** la lista renderiza correctamente los incidentes reales de la empresa activa vía `GET /api/incidents`, incluyendo el filtro `showDeleted` (verificado explícitamente para restaurar un incidente eliminado); el resto de filtros (`tipo`, `fechaDesde`/`fechaHasta`, `search`) no se ejercitaron uno por uno en esta verificación — mismo contrato de query params documentado en `be-incidentes-api`, sin cambios en este change

#### Scenario: Actualización de campos de investigación, incluyendo los nuevos campos mobile

- **WHEN** un usuario edita un Incidente agregando `testigos`, `personalInvolucrado`, `equiposInvolucrados`, `atencionMedicaRequerida`/`atencionMedicaDescripcion` y `notificacionAmbientalRequerida` desde `IncidentForm` (modo `edit`)
- **THEN** el backend real persiste los seis campos y `IncidentDetailPage` los muestra correctamente tras recargar

#### Scenario: Cambio de estado válido e inválido contra el backend real

- **WHEN** se invoca `PATCH /api/incidents/:id/status` siguiendo la máquina de estados documentada — la UI actual no tiene ningún punto de entrada para cambiar el estado de un Incidente (`useUpdateIncidentStatus`/`updateIncidentStatus` están exportados pero sin consumidor; hallazgo informativo, no bloqueante), así que el contrato se verifica directo contra el endpoint
- **THEN** las transiciones válidas se completan y las inválidas responden con el error correspondiente, igual que contra MSW

#### Scenario: Eliminación y restauración de Incidente contra el backend real

- **WHEN** un usuario elimina (soft-delete) un Incidente en estado `ABIERTO` y luego lo restaura
- **THEN** ambas operaciones se completan contra el backend real y el Incidente reaparece en `IncidentList` tras restaurarse

### Requirement: Las Acciones Correctivas del Incidente, incluido el cierre, funcionan contra el backend real

El sistema SHALL completar la creación, actualización y cierre de Acciones Correctivas de un Incidente contra el backend .NET real, usando el nuevo endpoint `PATCH /api/incidents/:incidenteId/acciones/:acId/cerrar` sin requerir ningún cambio en `cerrarAC()`/`cerrarAC.schema.ts`. La UI actual (`IncidentACSection`) no tiene un botón de creación directa de AC — el flujo real de producto es "Solicitar AC en QE" (Modelo B, la AC se crea del lado del Quality Event); `useCreateACIncidente`/`createAC()` siguen siendo contrato backend real y correcto, solo sin punto de entrada propio en esta UI hoy (hallazgo informativo, no bloqueante). El cierre (`cerrarAC()`, botón "Cerrar con evidencia") sí está wireado en la UI.

#### Scenario: Crear, actualizar y cerrar una Acción Correctiva contra el backend real

- **WHEN** se invoca `POST /api/incidents/:id/acciones` (creación), `PATCH /api/incidents/:incidenteId/acciones/:acId` (actualización parcial) y `PATCH /api/incidents/:incidenteId/acciones/:acId/cerrar` (cierre con `descripcionEvidencia`, `evidenciaUrl` opcional) en secuencia sobre la misma acción
- **THEN** las tres operaciones se completan contra el backend real, y tras el cierre la acción queda en `estado: 'CERRADA'`

### Requirement: La vinculación de Incidente con Quality Event funciona contra el backend real

El sistema SHALL completar la vinculación `Incidente.qeId` tras crear un Quality Event con origen `O1_INCIDENTE_CAMPO` e `incidenteId`, contra el backend .NET real, replicando el mismo PATCH que `QualityEventForm.tsx` dispara sobre el Incidente de origen tras crear el QE.

#### Scenario: Crear un QE desde un Incidente vincula ambos registros

- **WHEN** se crea un Quality Event vía `POST /api/quality-events` con `origen: 'O1_INCIDENTE_CAMPO'` e `incidenteId`, y luego se envía `PATCH /api/incidents/:id { qeId }` con el id del QE recién creado
- **THEN** el Quality Event queda creado y el Incidente de origen queda con `qeId` apuntando a él, ambos persistidos contra el backend real

### Requirement: El ciclo completo de reporte offline funciona contra el backend real con Service Worker activo

El sistema SHALL completar el ciclo de reporte offline (encolar sin conexión → reconectar → sincronización automática vía Background Sync API) contra el backend .NET real, incluyendo fotos de evidencia reales (subidas vía `POST /api/incidents/evidencias`, no URLs `blob:` locales) y geolocalización real, verificado en un entorno donde el Service Worker de la PWA controla efectivamente la página — no únicamente con el modo "offline" simulado de las DevTools de un navegador de escritorio.

#### Scenario: Reporte mobile online sube fotos reales antes de crear el Incidente

- **WHEN** un usuario con conexión activa envía `IncidentQuickReportForm` con una o más fotos adjuntas
- **THEN** cada foto se sube primero a `POST /api/incidents/evidencias` obteniendo una URL real del servidor, y el Incidente se crea con `evidencias[].url` apuntando a esas URLs reales, nunca a una `blob:` URL

#### Scenario: Reporte encolado offline sincroniza con fotos reales al reconectar

- **WHEN** un usuario sin conexión encola un reporte con fotos y geolocalización capturada, y luego el dispositivo recupera conexión (evento `online` o `sync` del Service Worker)
- **THEN** `useOfflineIncidentSync` sube cada foto encolada a `POST /api/incidents/evidencias` durante el ciclo de sync, crea el Incidente contra el backend real con las URLs reales resultantes y el `geoUbicacion` capturado, y marca la entrada de la cola como sincronizada

#### Scenario: Un reporte offline se registra bajo la empresa activa al momento de encolarlo, no al sincronizar

- **WHEN** `createIncidentOfflineSync()` envía `POST /api/incidents` con `empresaId` explícito en el body (la empresa activa al momento de encolar, capturada client-side), usando un JWT cuya `empresaActivaId` de sesión es una empresa distinta — verificado directo contra el contrato del endpoint (cambiar de empresa activa exige red, así que no es reproducible encadenado con una desconexión real del navegador; se probaron los tres casos exactos que implementa el backend: sin `empresaId`, con `empresaId` de una empresa con membresía, y con `empresaId` de una empresa sin membresía)
- **THEN** con `empresaId` de una empresa donde el usuario tiene membresía ACTIVA, el sistema crea el incidente bajo esa empresa (ignorando la `empresaActivaId` del JWT); sin `empresaId`, usa la del JWT; con `empresaId` de una empresa sin membresía, responde 403 y no crea nada

#### Scenario: Un fallo de sincronización no bloquea a las siguientes entradas de la cola

- **WHEN** una entrada de la cola offline falla al sincronizar (por red o por rechazo del backend) — cubierto por los tests unitarios existentes de `useOfflineIncidentSync` (`classifySubmitError`/retry/FIFO), no repetido en la verificación manual en navegador por ser redundante con esa cobertura ya sólida
- **THEN** las entradas siguientes de la cola FIFO continúan intentando sincronizarse en el mismo ciclo, con el mismo comportamiento de reintento/error ya documentado en `offline-incident-sync`

### Requirement: MSW se revierte a activo al cerrar la verificación de Incidentes

El sistema SHALL dejar `shc-controldoc/.env.development` con `VITE_ENABLE_MSW=true` una vez completada la verificación de este change, para no bloquear el desarrollo diario de los módulos de dominio aún no cutover-eados.

#### Scenario: Estado del entorno de desarrollo al cerrar el change

- **WHEN** se inspecciona `shc-controldoc/.env.development` después de cerrado este change
- **THEN** `VITE_ENABLE_MSW` es `true`, igual que antes de iniciar la verificación
