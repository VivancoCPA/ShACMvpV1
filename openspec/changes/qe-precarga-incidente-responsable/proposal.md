## Why

Al crear un QE desde un incidente (botón "Crear QE" en `IncidentDetailPage`), el formulario solo trae el área: descripción, fecha/hora, turno, severidad y tipo quedan vacíos aunque el incidente ya los tiene, y hay que retipearlos. Además, ningún endpoint escribe `QualityEvent.ResponsableInvestigacionId`: todos los QE quedan sin responsable, el permiso "SUPERVISOR responsable de la investigación" nunca se cumple y se puede pasar de ABIERTO a EN_INVESTIGACION sin investigador, contra lo que pide el PRD §1.3 (1 → 2: "Jefe Calidad asigna investigador"; condición: "QE tiene responsable de investigación asignado"). Tampoco se avisa a nadie cuando se crea un QE (PRD §1.3, estado ABIERTO).

## What Changes

- **Precarga desde el incidente (D1):** con `origen = O1_INCIDENTE_CAMPO` y un `incidenteId` (de la URL o elegido en el combo), el formulario de alta copia del incidente `descripcion`, `fechaHoraEvento` (en hora local), `turno`, `areaId`, `severidad` y `tipo = SST`. Todo sigue editable. Si el usuario ya tocó alguno de esos campos y cambia de incidente, se le pide confirmación antes de sobrescribirlos.
- **Fix de zona horaria en edición:** `fechaHoraEvento` en modo edición deja de usar `.slice(0, 16)` sobre el ISO UTC (corrimiento de 5 h) y usa el helper compartido `toDatetimeLocalValue`.
- **Responsable de investigación (D2):**
  - `GET /api/quality-events/candidatos-responsable`: SUPERVISOR y JEFE_CALIDAD_SYST activos de la empresa.
  - `POST /api/quality-events` acepta `responsableInvestigacionId` opcional (validado como candidato).
  - `PATCH /api/quality-events/{id}/responsable`: solo JEFE_CALIDAD_SYST; audit `RESPONSABLE_ASIGNADO` / `RESPONSABLE_CAMBIADO` con nombres; 422 `QE_CERRADO` en CERRADO/EN_VERIFICACION/VERIFICADO.
  - **BREAKING (regla de negocio):** ABIERTO → EN_INVESTIGACION exige responsable asignado; si no, 422 `QE_SIN_RESPONSABLE`.
  - Detalle y listado devuelven `responsableInvestigacionNombre`.
  - UI: campo opcional en el alta (solo JCA), fila "Responsable de investigación" en la cabecera con botón Asignar/Cambiar (solo JCA), botón EN_INVESTIGACION deshabilitado sin responsable.
  - `esResponsable` en el frontend pasa a calcularse como `qe.responsableInvestigacionId === usuario.id` (hoy el panel de transición lo fija en `false`).
- **Notificaciones (D3):** al asignar responsable se avisa al asignado (`ASIGNACION`); al crear un QE se avisa a JCA y SUPERVISOR de la empresa (`CAMBIO_ESTADO`), sin el actor. Best-effort.
- **MSW:** handlers y fixtures equivalentes.
- **Migración:** solo un índice sobre `quality_events.responsable_investigacion_id` (la columna ya existe, el índice no).

## Capabilities

### New Capabilities

_Ninguna._ El responsable de investigación es parte del contrato existente del QE; se agrega como requisitos nuevos a las capabilities que ya lo cubren.

### Modified Capabilities

- `be-quality-events-api`: candidatos a responsable, responsable opcional al crear, endpoint de asignación, bloqueo ABIERTO→EN_INVESTIGACION sin responsable, aviso de creación y de asignación, nombre del responsable en lectura.
- `quality-event-form`: precarga completa desde el incidente (URL o combo) con confirmación de reemplazo; campo responsable en el alta (solo JCA); fecha del evento en hora local en edición.
- `quality-event-detail-page`: fila de responsable en `QEHeaderSection` con asignación/cambio para JCA; `QEStatusTransitionPanel` bloquea EN_INVESTIGACION sin responsable.
- `quality-event-permissions`: `esResponsable` derivado de `qe.responsableInvestigacionId === usuario.id`.
- `quality-event-msw-handlers`: endpoints nuevos y 422 `QE_SIN_RESPONSABLE` en el mock.

## Impact

- **Backend (`ShcMvpEndPoint/`):** slices nuevos `Features/QualityEvents/CandidatosResponsable/` y `AsignarResponsableQE/`; helper `Shared/ResponsableInvestigacionValidator.cs`; cambios en `CrearQualityEvent*`, `TransicionarEstadoQEHandler`, `ObtenerQualityEventHandler`, `ListarQualityEventsHandler`, `IQualityEventNotificationSender`/`QualityEventNotificationSender`; propiedad `[NotMapped] ResponsableInvestigacionNombre` en `QualityEvent`; índice en `ShacDbContext` + migración `AddIndexResponsableInvestigacionQE`; registro de endpoints en `Program.cs`.
- **Frontend (`shc-controldoc/src/`):** `QualityEventForm.tsx`, `QEHeaderSection.tsx`, `QEStatusTransitionPanel.tsx`, `qualityEventPermissions.ts`, `qualityEvent.types.ts`, `quality-events.api.ts`, hooks nuevos `useCandidatosResponsableQE` / `useAsignarResponsableQE`, componente modal de asignación, helper de fecha movido a `utils/`, i18n es-PE/en-US.
- **MSW:** `quality-events.handlers.ts` y fixtures.
- **Dependencia:** usa la vinculación atómica y la sincronización de estado de `incidentes-qe-estado-alertas` (archivado 2026-10-26).
