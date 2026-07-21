## Why

El criterio de aceptación original de M4 (`QE-AC-009`) exige que el Jefe de Calidad pueda exportar un Quality Event completo en PDF (cabecera, cuerpo, ACs, evidencias, firmas, audit trail) en menos de 5 segundos, pero nunca se materializó en una spec propia y quedó diferido a v1.1. Ese PDF es la evidencia de auditoría ISO 9001/45001 que Alta Dirección y auditores externos necesitan poder generar sin depender del sistema en vivo. M5-S09 (export Excel/PDF de KPIs) ya dejó instalado y probado el patrón técnico (`jspdf` + `jspdf-autotable`) que esta spec reutiliza en lugar de introducir un enfoque nuevo.

## What Changes

- Nuevo botón "Exportar PDF" en el header de `QualityEventDetail` (`QEHeaderSection`), visible para `JEFE_CALIDAD_SYST`, `SUPERVISOR`, `AUDITOR_INTERNO` y `ALTA_DIRECCION` (los mismos roles con acceso de lectura al módulo QE hoy). Genera un PDF individual con el QE completo: cabecera, descripción, causa raíz (5 Porqués/Ishikawa), plan de ACs, cierre/firmas, audit trail íntegro (todos los ciclos si `ciclo > 1`), y pie de página con número de QE + paginación + timestamp de generación + usuario exportador.
- Nueva selección múltiple en `QEList`: checkbox por fila + "Seleccionar todos los visibles" (respeta filtros activos) + botón "Exportar seleccionados" en una nueva toolbar. Genera un `.zip` (vía `jszip`, dependencia nueva) con un PDF por QE seleccionado — cada PDF es idéntico en contenido al que se generaría exportándolo individualmente. Límite de 50 QEs por operación; sobre ese límite el botón se deshabilita con mensaje explicativo.
- Cada exportación (individual o parte de un lote) registra una entrada `EXPORTACION_PDF` en el audit trail del QE **antes** de completar la descarga, de modo que exportaciones posteriores del mismo QE ya la incluyan.
- Nuevo `accion` de audit trail `EXPORTACION_PDF` con ícono y label i18n en `QEAuditTrail`.
- Nueva regla de permisos `puedeExportarPDF` (mismo criterio que lectura del módulo QE: `OPERARIO` sin acceso; `JEFE_CONTROL_DOCUMENTARIO`/`ADMINISTRADOR_SISTEMA` deny-all, consistente con que ninguno de los dos tiene acceso operativo a QE).
- Nuevas reglas de negocio `RN-QE-017` a `RN-QE-020` (renumeradas desde el borrador original `RN-QE-014`–`017` tras detectar colisión con `RN-QE-014/015/016` ya existentes — ventana de corrección, edición de severidad, edición de mineral; confirmado con Toño).

## Capabilities

### New Capabilities

- `quality-event-pdf-export`: Generación del PDF individual de un QE (las 6 secciones completas de contenido, paginación de audit trail con `jspdf-autotable`, pie de página con "Página X de Y"), el botón de export en `QualityEventDetail`, y el registro de la entrada de audit trail `EXPORTACION_PDF` antes de la descarga.
- `quality-event-batch-pdf-export`: Selección múltiple en `QEList` (checkboxes, "seleccionar todos los visibles", toolbar), empaquetado en `.zip` con `jszip` reutilizando la generación de `quality-event-pdf-export` por cada QE, y el límite de 50 QEs por operación.

### Modified Capabilities

- `quality-event-detail-page`: agrega el botón "Exportar PDF" al header de la página, gateado por `puedeExportarPDF`.
- `quality-event-list-view`: agrega columna de selección, "seleccionar todos los visibles" y toolbar de acciones en lote.
- `quality-event-permissions`: agrega el helper `puedeExportarPDF(rol)` y su cobertura explícita para todos los valores de `UserRole` (incluye el caso deny-all para `OPERARIO`, `JEFE_CONTROL_DOCUMENTARIO`, `ADMINISTRADOR_SISTEMA`).
- `quality-event-audit-trail`: agrega el `accion` `EXPORTACION_PDF` al set reconocido, con su ícono y descripción legible.
- `quality-event-msw-handlers`: agrega el endpoint que registra la entrada de audit trail `EXPORTACION_PDF` (invocado por el cliente antes de generar el PDF, individual o en lote).

## Impact

- **Código nuevo:** `src/features/quality-events/export/` (generación de PDF individual, construcción de secciones, empaquetado zip para lote) — espejo de `src/features/dashboard/export/` de M5-S09.
- **Código modificado:** `QEHeaderSection.tsx` (botón export), `QEList.tsx` (selección + toolbar), `QEAuditTrail.tsx` (ícono/label nuevo `accion`), `qualityEventPermissions.ts` (`puedeExportarPDF`), `mocks/handlers/quality-events.handlers.ts` (endpoint de registro de export), `i18n/es-PE.json` / `en-US.json` (namespace `qualityEvents`).
- **Dependencias:** nueva — `jszip` (empaquetado de lote). Reutilizadas sin cambios — `jspdf`, `jspdf-autotable` (ya en `package.json` desde M5-S09).
- **Fuera de alcance:** incrustar binarios de evidencias en el PDF, firma digital criptográfica, envío por email, marca de agua tipo "COPIA NO CONTROLADA" (no aplica — QE no maneja niveles de confidencialidad).
