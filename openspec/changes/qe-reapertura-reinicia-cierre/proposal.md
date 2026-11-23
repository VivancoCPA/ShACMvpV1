## Why

En el QE-2026-006 (ciclo 2, PENDIENTE_CIERRE) el supervisor del área ve "Siguiente paso: Firma de cierre del supervisor del área · Te toca a ti", pero no tiene ningún botón para firmar. La causa es que `QEReaperturaHelper.ReabrirAsync` no limpia los datos del ciclo anterior: el resultado del cierre, las dos firmas, la verificación y la firma de la causa raíz siguen cargados, así que la sección de cierre los muestra como "confirmados", el backend rechazaría una firma nueva y el resolver del siguiente paso pide una firma que ya existe. Además, la firma de causa raíz arrastrada deja pasar el ciclo 2 a EN_EJECUCION sin un análisis aprobado de nuevo (RN-QE-002). Decisiones D1/D2 de Toño del 2026-11-19.

## What Changes

- Backend: al reabrir (ciclo N+1), `QEReaperturaHelper` registra una entrada de audit `CICLO_REINICIADO` con un resumen legible del ciclo que termina y luego pone en `null` `ResultadoCierre`, `PlazoVerificacionDias`, `CerradoPorId`, `CierreFirmaSupervisorId`, `FechaVerificacionProgramada`, `ResultadoVerificacion`, `CausaRaizAprobadaPorId` y `CausaRaizFirmadaEn`. Se conservan el texto del análisis y las AC anteriores.
- Backend: la transición manual EN_EJECUCION → PENDIENTE_CIERRE de un QE reabierto exige al menos una AC creada después de la última reapertura (las AC del ciclo anterior, ya cerradas, no bastan). La transición automática al verificar una AC aplica el mismo criterio.
- Backend: `QESiguientePasoResolver` devuelve el paso nuevo `CIERRE_INCONSISTENTE` (responsables: JCA, sin plazo) cuando en PENDIENTE_CIERRE ya existen las dos firmas, y nunca `FIRMA_SUPERVISOR` en ese caso.
- Backend: migración solo de datos `FixReaperturaCicloCierre` que limpia esos campos en los QE con `ciclo > 1`, activos y en EN_INVESTIGACION…PENDIENTE_CIERRE, cuando su respaldo de audit es anterior al último `REABIERTO`, con una entrada `CORRECCION_DATOS_REAPERTURA` por QE corregido. No cambia el esquema.
- Frontend: las filas de firma de `QECierreSection` solo toman entradas de audit del ciclo actual; el banner muestra `CIERRE_INCONSISTENTE`; el badge de la cabecera dice "Ciclo {n}"; el audit trail etiqueta `CICLO_REINICIADO` y `CORRECCION_DATOS_REAPERTURA`.
- MSW: la reapertura limpia los mismos campos y hay un fixture en ciclo 2, PENDIENTE_CIERRE, sin firmas.

## Capabilities

### New Capabilities
- `quality-event-reapertura-ciclo`: reinicio del cierre, la verificación y la firma de la causa raíz al reabrir un QE; AC del ciclo actual; migración de datos; presentación del ciclo en el detalle y en MSW.

### Modified Capabilities
- `be-quality-events-api`: la verificación NO_EFECTIVO (y el forzado dev-only) reinician el cierre; la transición manual a PENDIENTE_CIERRE exige AC del ciclo actual.
- `quality-event-siguiente-paso`: paso `CIERRE_INCONSISTENTE` en PENDIENTE_CIERRE con las dos firmas.

## Impact

- `ShcMvpEndPoint/Features/QualityEvents/Shared/` (`QEReaperturaHelper`, `QESiguientePasoResolver`, `AccionCorrectivaQEAcceso`), `TransicionarEstadoQE`, `VerificarAccionCorrectivaQE`, migración nueva en `ShcMvpEndPoint.Infrastructure/Persistence/Migrations/`, tests.
- `shc-controldoc/src/features/quality-events/` (`QECierreSection`, `QESiguientePasoBanner`, `QEHeaderSection`, tipos), `src/mocks/handlers|fixtures/quality-events.*`, `src/i18n/*.json`.
- Base de datos: actualización de datos sin cambio de esquema; requiere `dotnet ef database update`.
