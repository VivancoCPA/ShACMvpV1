## Why

Al cerrar un QE, después de la firma del Jefe de Calidad se pide la firma de "un supervisor", pero la pantalla no dice quién es ni si se le avisó (observación de Toño, 2026-11-04). El código lo confirma: el backend acepta la segunda firma de **cualquier** SUPERVISOR de la empresa (no valida el área del QE, contra PRD §1.5 P4/P5 "Supervisor del área afectada"), ningún paso del cierre envía aviso (P1, P4) salvo el final y solo a JCA con severidad ALTA/CRÍTICA, el supervisor no puede rechazar (P5 no existe) y `QECierreSection` busca una acción de audit (`FIRMA_CIERRE_JEFE_CALIDAD`) que el backend nunca escribe, así que la primera firma nunca se muestra.

## What Changes

- **Supervisores del área (D1):** nuevo `SupervisoresAreaResolver` (SUPERVISOR con asignación ACTIVA en la empresa, usuario activo y el área del QE en `AreaIds`). **BREAKING (regla de negocio):** la segunda firma exige ser supervisor del área → 403 `NO_ES_SUPERVISOR_DEL_AREA`. Si el área no tiene supervisores, `PATCH /:id/cerrar` y la primera firma responden 422 `AREA_SIN_SUPERVISOR`.
- **Avisos del cierre (D2):** P1 "listo para cierre" (JCA + supervisores del área, al pasar a PENDIENTE_CIERRE), P4 "espera tu firma" (supervisores del área, tras la firma del JCA), P6 "cerrado con doble firma" (reportante, responsable, JCA y, con ALTA/CRÍTICA, ALTA_DIRECCION). Best-effort, nunca al actor, sin duplicados.
- **Rechazo del cierre (D3):** nuevo `POST /api/quality-events/{id}/rechazar-cierre` con motivo (20–500). El QE vuelve a EN_EJECUCION, se borra la firma del JCA, se conserva `ResultadoCierre`, audit `CIERRE_RECHAZADO`, sincroniza el incidente vinculado y avisa al JCA.
- **RN-QE-003 en la transición manual:** `EN_EJECUCION → PENDIENTE_CIERRE` por `PATCH /:id/status` exige todas las AC cerradas con evidencia (hoy no se valida), para poder volver a cerrar tras un rechazo.
- **Nombres de los firmantes:** audit `FIRMA_CIERRE_JEFE_CALIDAD` / `FIRMA_CIERRE_SUPERVISOR` con el nombre en `ValorNuevo`; el detalle devuelve `cerradoPorNombre`, `cierreFirmaSupervisorNombre` y, en PENDIENTE_CIERRE, `supervisoresArea`.
- **Fix:** `RolNotificationHelper` deja de notificar asignaciones `UsuarioEmpresa` inactivas.
- **Frontend:** `QECierreSection` muestra Firma 1 / Firma 2 con nombre y fecha, la lista de quién puede firmar y "se les envió un aviso", gatea los botones con `supervisoresArea`, agrega "Rechazar cierre" con modal y el aviso ámbar del último rechazo, y muestra `AREA_SIN_SUPERVISOR`. Etiquetas nuevas en `QEAuditTrail`, i18n es-PE/en-US.
- **MSW:** paridad de todo lo anterior.
- Sin migración.

## Capabilities

### New Capabilities

_Ninguna._ El cierre ya tiene capabilities propias; se agregan requisitos a ellas.

### Modified Capabilities

- `be-quality-events-api`: supervisores del área, validación de la segunda firma por área, bloqueo `AREA_SIN_SUPERVISOR`, avisos P1/P4/P6, rechazo del cierre, RN-QE-003 en EN_EJECUCION→PENDIENTE_CIERRE, acciones de audit nuevas y nombres/supervisores en el detalle.
- `be-notifications-api`: los avisos por rol excluyen asignaciones inactivas.
- `quality-event-cierre`: estado de Firma 1 / Firma 2 con nombres, quién puede firmar, gating por `supervisoresArea`, rechazo con modal y aviso, `AREA_SIN_SUPERVISOR`; el mock de `/firmar-cierre` valida el área.
- `quality-event-audit-trail`: etiquetas de `FIRMA_CIERRE_JEFE_CALIDAD`, `FIRMA_CIERRE_SUPERVISOR` y `CIERRE_RECHAZADO`.
- `quality-event-msw-handlers`: `supervisoresArea` y nombres en el detalle, `rechazar-cierre`, 403/422 nuevos.

## Impact

- **Backend (`ShcMvpEndPoint/`):** nuevo `Features/QualityEvents/Shared/SupervisoresAreaResolver.cs`; slice nuevo `RechazarCierreQE/`; cambios en `FirmarCierreQEHandler`, `CerrarQEHandler`, `CambiarEstadoAccionCorrectivaQEHandler`, `TransicionarEstadoQEHandler`, `ObtenerQualityEventHandler`, `IQualityEventNotificationSender`/`QualityEventNotificationSender`, `RolNotificationHelper`; propiedades `[NotMapped]` en `QualityEvent`; registro en `Program.cs`. Tests de integración del cierre actualizados (necesitan sembrar un supervisor del área).
- **Frontend (`shc-controldoc/src/`):** `QECierreSection.tsx`, `QEAuditTrail.tsx`, `qualityEvent.types.ts`, `quality-events.api.ts`, hook nuevo `useRechazarCierreQE`, `accionesRequeridas.utils.ts` (dashboard), i18n.
- **MSW:** `quality-events.handlers.ts`.
- **Dependencias:** `IncidenteQeSync` (`incidentes-qe-estado-alertas`) y el patrón de nombres `[NotMapped]` + LEFT JOIN de `qe-precarga-incidente-responsable`.
