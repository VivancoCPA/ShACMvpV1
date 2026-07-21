## Context

`QualityEventDetail` (`src/features/quality-events/pages/QualityEventDetail.tsx`) hoy no tiene una zona de acciones/toolbar en el header — es un back-link seguido de una columna `space-y-6` de secciones (`QEHeaderSection` → `QEStatusTransitionPanel` → `QEInvestigationSection` → `QEACSection` → `QECierreSection` → `QEVerificacionSection` → `QEAuditTrail`). `QEHeaderSection.tsx:72-90` ya tiene un `div` `flex flex-wrap items-center gap-2.5` con número + badges donde puede anclarse un botón nuevo.

`QEList.tsx` no tiene selección de filas ni toolbar — solo chips de filtro y una tabla con columna final de acciones por fila (ver/editar/eliminar/reactivar).

El audit trail de QE **no tiene un helper cliente compartido**: cada mutación empuja su entrada directamente dentro del handler MSW correspondiente (`src/mocks/handlers/quality-events.handlers.ts`), no hay una función central `appendAuditTrailEntry`. `QEAuditTrail.tsx:24-38` mapea cada `accion` a un ícono `lucide-react` vía un objeto `ACCION_ICONS`.

El patrón de PDF de M5-S09 (`src/features/dashboard/export/`) expone `exportToPdf(sections, meta, i18n): Promise<void>` que arma un `jsPDF`, dibuja una portada, y una página por `section` (dispatch a `drawTablaSection` con `autoTable(doc, {startY, head, body, margin, styles})` o `drawGraficoTendenciaSection` con `html2canvas`). **No implementa pie de página / "Página X de Y"** — esa pieza es net-new para esta spec. `jspdf` y `jspdf-autotable` ya están en `package.json`; `jszip` no está instalado.

## Goals / Non-Goals

**Goals:**
- Generar, desde datos ya cargados en el cliente (React Query cache), un PDF completo de un QE reutilizando el patrón `jspdf` + `jspdf-autotable` de M5-S09, con pie de página nuevo (paginación + timestamp + usuario).
- Registrar la entrada de audit trail `EXPORTACION_PDF` vía un endpoint MSW **antes** de generar el PDF, para que la exportación quede reflejada en el propio documento generado.
- Permitir selección múltiple en `QEList` y empaquetar N PDFs en un `.zip` client-side sin tocar backend (no existe backend real).
- Garantizar paridad exacta de contenido entre el PDF individual y cada PDF dentro de un lote (RN-QE-019): ambos caminos deben invocar la misma función de generación de documento.

**Non-Goals:**
- Incrustar binarios de evidencias (fotos/adjuntos) — se listan por nombre/referencia.
- Firma digital criptográfica del PDF.
- Envío por email o cualquier entrega server-side del archivo.
- Un helper genérico de audit trail para todo el módulo QE (fuera de alcance; esta spec solo añade el endpoint específico de export, sin refactorizar el resto de mutaciones).

## Decisions

**D1 — Función de generación única, compartida entre individual y lote.**
`buildQualityEventPdf(qe: QualityEvent, meta: QEExportMeta): jsPDF` vive en `src/features/quality-events/export/buildQualityEventPdf.ts` y produce el documento completo (las 6 secciones + pie de página). Tanto el botón individual de `QEHeaderSection` como el loop de export en lote llaman a esta misma función — es la única forma de cumplir RN-QE-019 (paridad lote = individual) sin duplicar lógica. El único parámetro que varía es `meta` (usuario exportador, timestamp de generación), no el contenido del QE.
*Alternativa descartada:* dos funciones separadas (una para modal individual, otra optimizada para lote) — se descarta porque duplicar la lógica de las 6 secciones es exactamente el riesgo que RN-QE-019 busca evitar; un cambio futuro en el contenido individual podría no propagarse al lote.

**D2 — Secuencia de audit-trail-antes-de-descarga vía mutation síncrona.**
El flujo de export (individual o cada QE dentro de un lote) es: `useExportQualityEventPdf` mutation → `POST /api/quality-events/:id/export-pdf` (handler MSW que empuja la entrada `EXPORTACION_PDF` al `auditTrail` del QE en el store mutable y devuelve el QE actualizado) → `onSuccess` genera el PDF con `buildQualityEventPdf(qeActualizado, meta)` usando el QE devuelto por la mutation (que ya incluye la nueva entrada), no el valor cacheado antes de la llamada. Esto es lo que garantiza CA-QE-EXP-03 sin una segunda espera/refetch.
*Alternativa descartada:* invalidar la query y esperar un refetch — más lento y con estado de carrera (el usuario podría cerrar la página antes de que el refetch resuelva); usar el payload de la propia respuesta de la mutation es inmediato y determinista.

**D3 — Lote: generación secuencial en memoria + `jszip`, sin backend.**
El export en lote itera los QEs seleccionados, por cada uno ejecuta la mutation de D2 y llama a `buildQualityEventPdf`, convierte el `jsPDF` a `Blob` (`doc.output('blob')`) y lo agrega a una instancia de `JSZip` con el nombre `${qe.numero}.pdf`. Al terminar, `zip.generateAsync({type:'blob'})` + descarga vía el patrón Blob-download ya establecido en el proyecto para MSW (`<a download>` temporal + `URL.createObjectURL`/`revokeObjectURL` — mismo patrón usado para `archivoOriginalUrl`/`archivoDistribucionUrl` en M1, ver CLAUDE.md). La generación es secuencial (no `Promise.all`) para no disparar 50 mutaciones MSW concurrentes contra el mismo store mutable de audit trail y para poder mostrar progreso ("Generando 12/50...") en el toast/UI.
*Alternativa descartada:* enviar los QEs al backend para empaquetar — descartado explícitamente en la propuesta porque no existe backend real hoy; todo corre sobre MSW client-side.

**D4 — Pie de página con `jspdf-autotable`'s `didDrawPage` hook.**
El pie de página ("QE-2025-001 · Página X de Y · generado 2026-07-18 10:32 (Lima) · usuario") se dibuja con el hook `didDrawPage` de `autoTable` en la tabla de audit trail (la única sección con paginación real vía `jspdf-autotable`), más una pasada final post-generación que recorre `doc.getNumberOfPages()` para completar "Página X de **Y**" en todas las páginas (el total de páginas no se conoce hasta terminar de dibujar) — mismo patrón estándar de jsPDF para totales de página.

**D5 — Permiso `puedeExportarPDF` como función pura en `qualityEventPermissions.ts`, no un campo del objeto de permisos por estado.**
Los helpers existentes (`getQualityEventPermissions(estado, rol, esResponsable)`) están pensados para acciones que dependen del **estado** del QE (firmar, cerrar, avanzar). Exportar PDF no depende del estado — un QE en cualquier estado es exportable. Por eso `puedeExportarPDF(rol: UserRole): boolean` es una función independiente con un `switch` exhaustivo sobre `UserRole` (siguiendo la nota técnica de M6-S01 en CLAUDE.md: nunca un `default` genérico), en vez de agregar un campo más al objeto de permisos por estado.

## Risks / Trade-offs

- [Riesgo] Generar 50 PDFs secuenciales con audit trail íntegro puede tardar varios segundos y bloquear la interacción → Mitigación: generación secuencial con feedback de progreso (toast actualizable "Generando N/50"), y el límite duro de RN-QE-020 (50) acota el peor caso.
- [Riesgo] `jszip` es una dependencia nueva sin precedente en el proyecto → Mitigación: es la librería estándar de facto para zip en navegador, ampliamente usada, sin dependencias nativas; se instala solo para `quality-event-batch-pdf-export`.
- [Riesgo] La mutation de audit trail por QE en el lote multiplica las llamadas a MSW (hasta 50 `POST` secuenciales) → Mitigación: aceptable dado el límite de 50 y que ya es el patrón existente (M5-S09 no tenía este problema por no mutar estado); si el rendimiento resulta insuficiente en verificación manual, se puede evaluar un endpoint de audit-trail en lote como follow-up, pero no bloquea esta spec.
- [Riesgo] Colisión de numeración RN-QE-* ya ocurrió una vez con este mismo rango (014-017) → Mitigación: renumerado a RN-QE-017–020 tras confirmar con Toño (ver proposal.md); verificado contra `openspec/specs/**` antes de escribir esta spec.

## Migration Plan

No aplica migración de datos — es una capability nueva sin cambios de esquema en `QualityEvent`. Rollout es el ciclo normal de OpenSpec (`apply` → verificar en navegador → `sync`/archivar). Sin flag de feature: el botón de export aparece directamente para los roles autorizados en cuanto se despliega.

## Open Questions

Ninguna pendiente — alcance, formato de lote y numeración RN-QE ya confirmados con Toño antes de esta versión del design.
