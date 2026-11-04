## Why

Toño preguntó qué pasa cuando un incidente supera su plazo sin QE, quién lo vigila y qué ocurre si nunca se crea el QE. Al revisar el código aparecieron cinco huecos:

1. El estado del incidente no avanza nunca. `useUpdateIncidentStatus` no lo usa ninguna pantalla y ningún handler de QE toca `Incidente.Estado`, así que todo incidente queda en ABIERTO para siempre.
2. La vinculación incidente ↔ QE se hace en dos requests: `CrearQualityEventHandler` no asigna `Incidente.QeId` y lo completa después `useVincularQE`. Si ese segundo request falla, el QE queda huérfano.
3. RN-INC-006 existe solo en el frontend. `VencimientoScanner` no escanea incidentes sin QE, así que al vencer el plazo no hay notificación, ni audit trail, ni escalado.
4. Crear un incidente no avisa a nadie, aunque el PRD §3.3 pide aviso inmediato según tipo y severidad.
5. Los enlaces de las notificaciones de incidentes (`/incidentes/…`), NC (`/no-conformidades/…`) y acciones correctivas (`/acciones-correctivas/…`) llevan a `NotFoundPage`.

## What Changes

- **El estado del incidente sigue al QE vinculado (D1, D5, D6).** Un helper nuevo, `IncidenteQeSync`, se invoca en cada handler que cambia `QualityEvent.Estado`, en la misma transacción, y registra `ESTADO_SINCRONIZADO_QE` (actor "Sistema"). Mapeo: CERRADO, EN_VERIFICACION y VERIFICADO → CERRADO; la reapertura → EN_INVESTIGACION; los demás estados son 1:1.
- **BREAKING (API):** `PATCH /api/incidents/:id/status` solo acepta `ABIERTO → ANULADO` sin QE vinculado. Cualquier otra transición responde 422 `ESTADO_GOBERNADO_POR_QE`.
- **BREAKING (API):** `PATCH /api/incidents/:id` ya no vincula el QE. Un `qeId` distinto del actual responde 422 `QE_VINCULO_GESTIONADO_POR_QE`.
- **Vinculación atómica:** al crear un QE con origen O1, el backend asigna `Incidente.QeId` en la misma transacción. El frontend deja de llamar a `useVincularQE`.
- **Eliminar o reactivar el QE:** al eliminarlo (soft delete, solo en ABIERTO), el incidente queda sin QE y en ABIERTO. Al reactivarlo, se vuelve a vincular si el incidente sigue libre.
- **Escaneo del plazo para vincular el QE (D2):** `VencimientoScanner` agrega un bloque de incidentes activos sin QE, con dos avisos que no se repiten:
  - preaviso al 75 % del plazo;
  - vencido al 100 %, que además deja `PLAZO_QE_VENCIDO` en el audit trail.

  Ambos avisos van a los JEFE_CALIDAD_SYST y SUPERVISOR activos de la empresa.
- **Aviso al crear un incidente (D3):** se notifica a los JEFE_CALIDAD_SYST y SUPERVISOR activos, y también a ALTA_DIRECCION si la severidad es ALTA o CRITICA. El envío es best-effort y nunca se notifica al actor.
- **Dashboard del Jefe de Calidad (D4):** `incidentesSinQeVencidos` (máximo 10, del más vencido al menos) y `incidentesSinQeVencidosTotal`, con su widget nuevo.
- **Detalle del incidente (D4):** el badge "Sin QE vinculado" aparece junto a "Crear QE". Con QE vinculado se muestra el aviso "El estado de este incidente se actualiza con el QE {numero}".
- **Enlaces de notificaciones (D7):** el backend genera rutas válidas. Una migración de datos corrige las notificaciones ya guardadas y alinea el estado de los incidentes que ya tienen QE. El router agrega redirecciones `/incidentes/:id` y `/no-conformidades/:id`.
- **MSW:** se replican el 422, la vinculación atómica, la sincronización de estado y el campo nuevo del dashboard.

## Capabilities

### New Capabilities

- `incident-qe-sync`: el estado del incidente lo gobierna su QE. Cubre la vinculación atómica al crear el QE O1, el mapeo D6 de estados, el audit trail `ESTADO_SINCRONIZADO_QE` y el efecto de eliminar o reactivar el QE.
- `notification-links`: los enlaces de toda notificación apuntan a rutas reales del frontend. Incluye la corrección de las notificaciones ya guardadas y las redirecciones de rutas en español.

### Modified Capabilities

- `be-incidentes-api`: el endpoint de estado queda restringido a la anulación sin QE, `PATCH /:id` deja de aceptar la vinculación del QE y se agrega el aviso al crear un incidente.
- `be-quality-events-api`: la vinculación con el incidente de origen pasa a ser server-side y atómica.
- `be-notifications-api`: nuevo escaneo idempotente de incidentes sin QE (preaviso y vencido).
- `be-dashboard-api`: el resumen JEFE_CALIDAD suma `incidentesSinQeVencidos` y `incidentesSinQeVencidosTotal`.
- `incident-detail`: el badge "Sin QE vinculado" en el detalle y el aviso de estado gobernado por el QE.
- `dashboard-jefecalidad-view`: el widget "Incidentes sin QE vencidos".
- `quality-event-form`: crear un QE O1 ya no dispara un segundo PATCH al incidente.
- `incident-msw-handlers`: `PATCH /status` replica el 422 `ESTADO_GOBERNADO_POR_QE`.
- `quality-event-msw-handlers`: vinculación atómica y sincronización de estado del incidente.

## Impact

- **Backend (`ShcMvpEndPoint/`):**
  - QualityEvents: `CrearQualityEvent`, `TransicionarEstadoQE`, `CambiarEstadoAccionCorrectivaQE`, `FirmarCierreQE`, `VerificacionEficaciaQE`, `Shared/QEReaperturaHelper` (también cubre `ForzarVencimientoVerificacion`), `EliminarQualityEvent` y `ReactivarQualityEvent`.
  - Incidentes: `CambiarEstadoIncidente`, `ActualizarInvestigacion`, `CrearIncidente`, `Shared/IIncidenteNotificationSender`, `Shared/IncidenteNotificationSender`, más los archivos nuevos `Shared/IncidenteQeSync.cs` y `Shared/IncidentePlazoQe.cs`.
  - Notifications: `VencimientoScanner` y `AsignacionNotificationSender`, más sus 3 call sites.
  - NoConformidades: `NoConformidadNotificationSender`.
  - Dashboard: `DashboardSummaryDtos` y `DashboardSummaryBuilder`.
  - **Migración** `FixLinksNotificacionesYEstadoIncidentes`, solo de datos. No hace falta cambiar el índice único (ver design D7).
- **Frontend (`shc-controldoc/src/`):**
  - incidents: `IncidentDetailPage` y `hooks/useIncidents.ts` (se retira `useVincularQE`);
  - quality-events: `QualityEventForm`, `useDeleteQualityEvent` y `useUpdateQEAccion`;
  - dashboard: `IncidentesSinQeVencidosWidget` (nuevo), `JefeCalidadDashboard` y los tipos del summary;
  - `router/index.tsx`;
  - i18n `es-PE`/`en-US`;
  - MSW: `incidents.handlers.ts`, `quality-events.handlers.ts` y `dashboard.handlers.ts`.
- **Dependencia de orden:** se apoya en `getIncidentQEPlazoInfo` y en el tooltip de `IncidentSinQEBadge`, que introduce `incidentes-ajustes-ui` (todavía activo). El apply debe esperar a que `fix-incidentes-detalle-nombres-ubicacion`, `incidentes-ajustes-ui` e `incidentes-edicion-campos-basicos` estén cerrados.
