## Why

Al abrir un QE (p. ej. QE-2026-006 en PENDIENTE_CIERRE) nadie que no sea el JCA puede ver qué falta, quién debe hacerlo ni desde cuándo está trabado: en PENDIENTE_CIERRE sin `resultadoCierre` la sección de cierre no muestra nada a los demás roles, y la cabecera no indica el paso pendiente de ningún estado. Toño necesita esa información para hacer el seguimiento (decisiones D1/D2 del 2026-11-19).

## What Changes

- Backend: nuevo `QESiguientePasoResolver` (función pura) que, a partir del QE cargado, calcula el paso pendiente (`Paso`), sus responsables con nombres (`ResponsablePaso`), la fecha de entrada al estado actual (`EstadoDesde`), el plazo informativo según PRD §1.3 (`PlazoFecha`, `PlazoRegla`) y, en EN_EJECUCION, el progreso de AC.
- Backend: nuevo helper `DiasHabiles.Sumar(desde, dias)` (lunes a viernes, hora de Lima, sin feriados).
- Backend: `GET /api/quality-events/:id` agrega `siguientePaso` a la respuesta. El listado no cambia.
- Frontend: nuevo `QESiguientePasoBanner` en la parte superior de `QEHeaderSection`, visible para todos: paso, responsables (máx. 3 + "+N"), "en este estado desde", plazo con semáforo y tooltip, progreso de AC, banner neutro al finalizar y resaltado "Te toca a ti" si el usuario es responsable.
- Frontend: `QECierreSection` muestra siempre, en PENDIENTE_CIERRE y para todos los roles, el bloque de pasos con una fila nueva "Paso 1 — Registrar el resultado del cierre (Jefe de Calidad)", además de Firma 1 y Firma 2.
- MSW: el detalle devuelve un `siguientePaso` coherente (resolver simplificado) y los fixtures incluyen un QE en PENDIENTE_CIERRE sin resultado y otro esperando la firma del supervisor.
- i18n `qualityEvents` (es-PE / en-US): claves `detail.siguientePaso.*` y `detail.cierre.paso1`.
- Sin migración: todo es lectura y cálculo. El plazo es solo informativo (no genera notificaciones).

## Capabilities

### New Capabilities
- `quality-event-siguiente-paso`: cálculo server-side del siguiente paso de un QE (paso, responsables, estado desde, plazo PRD §1.3, progreso) y su banner informativo en el detalle.

### Modified Capabilities
- `quality-event-cierre`: el bloque de pasos/firmas de cierre se muestra siempre en PENDIENTE_CIERRE (también sin `resultadoCierre`) y suma la fila "Paso 1 — Registrar el resultado del cierre".
- `be-quality-events-api`: el detalle de QE incluye `siguientePaso`.

## Impact

- `ShcMvpEndPoint/Features/QualityEvents/Shared/` (resolver nuevo, `DiasHabiles`), `ObtenerQualityEvent/ObtenerQualityEventHandler.cs`, `ShcMvpEndPoint.Domain/Entities/QualityEvent.cs` (propiedad `[NotMapped]`), tests en `ShcMvpEndPoint.Tests`.
- `shc-controldoc/src/features/quality-events/` (componente nuevo, `QEHeaderSection`, `QECierreSection`, tipos), `src/mocks/handlers|fixtures/quality-events.*`, `src/i18n/*.json`.
- Sin cambios de esquema de base de datos ni de contratos de escritura.
