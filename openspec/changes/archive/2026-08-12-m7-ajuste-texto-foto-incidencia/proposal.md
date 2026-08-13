## Why

Hoy una evidencia fotográfica de un incidente (mobile o escritorio) solo lleva metadatos automáticos (nombre de archivo, tamaño, fecha). Quien reporta no tiene forma de anotar qué muestra cada foto (p. ej. "válvula de escape dañada, vista lateral") sin recurrir al campo `descripcion` general del incidente, que mezcla ese detalle con el relato del evento. Un texto corto y opcional por foto permite documentar cada evidencia de forma independiente, sin afectar el flujo de envío existente.

## What Changes

- `IncidentEvidencia` gana un campo nuevo `descripcion?: string` (máx. 140 caracteres), opcional y no bloqueante.
- **Formulario mobile** (`IncidentQuickReportForm`): cada thumbnail de foto adjunta muestra un input de texto asociado para capturar el caption antes de enviar.
- **Formulario de escritorio** (`IncidentForm`): mismo campo de texto por foto en la zona de carga de evidencias, en la creación de un incidente nuevo.
- El caption viaja junto a la foto tanto en el envío online directo como al encolar offline (`enqueue()` → IndexedDB → `useOfflineIncidentSync` al sincronizar), reconstruyéndose en `IncidentEvidencia.descripcion` en ambos casos.
- `IncidentDetailPage` muestra el caption como texto bajo cada thumbnail en el sub-bloque "Evidencias adjuntas", cuando existe.
- Alcance explícitamente limitado a evidencias nuevas subidas en esta misma sesión de creación: evidencias ya existentes (subidas antes de este cambio, o mostradas en modo edición de escritorio como thumbnails no eliminables) **no** reciben caption retroactivo y no se vuelven editables por este cambio.
- Validación Zod: opcional, no bloqueante, límite de 140 caracteres por caption, en ambos schemas de formulario.
- Claves i18n nuevas bajo `incidents:form.evidencias.*`, `incidents:mobile.form.evidencias.*` y `incidents:detail.evidencias.*` en `es-PE.json`/`en-US.json`.

## Capabilities

### New Capabilities
_(ninguna — esta change extiende capabilities existentes, no introduce un dominio nuevo)_

### Modified Capabilities
- `incident-form`: la interfaz `IncidentEvidencia` (definida en el requirement "Tipo IncidentEvidencia y campo `evidencias` en schema Zod") gana `descripcion?: string`; la "Zona de carga de evidencias" agrega un input de texto opcional por foto adjunta, con validación de 140 caracteres.
- `mobile-incident-report`: el requirement "Captura de foto opcional con preview" se extiende para incluir un input de caption por thumbnail, y "Envío con cola offline ante falta de conexión" se extiende para que el caption viaje junto al payload/photoBlobs tanto en envío online como al encolar.
- `offline-incident-queue`: el requirement "Esquema de cola local en IndexedDB" gana un campo nuevo (array paralelo de captions alineado por índice a `photoBlobs`, mismo criterio de compatibilidad hacia atrás que `retryCount` en `m7-f3-hardening`).
- `offline-incident-sync`: el requirement "Reutilización de la mutation de creación de incidentes existente" se extiende para que la reconstrucción de evidencias desde blobs (`buildEvidenciasFromBlobs`) propague el caption correspondiente a `IncidentEvidencia.descripcion`.
- `incident-detail`: el requirement "Bloque 'Descripción del evento' con datos del reporte" (sub-bloque "Evidencias adjuntas") se extiende para mostrar el caption de cada evidencia cuando existe.

## Impact

- **Tipos**: `src/features/incidents/types/incident.types.ts` (`IncidentEvidencia`).
- **Schemas Zod**: `src/features/incidents/schemas/incidentForm.schema.ts` (escritorio), `src/features/incidents/schemas/mobileIncidentReport.schema.ts` (mobile) — nuevo campo de caption por foto, validado con límite de 140 caracteres.
- **Componentes**: `IncidentQuickReportForm.tsx` (mobile), `IncidentForm.tsx` / `EvidenciasZona` (escritorio) — sin componente de thumbnail compartido entre ambos hoy, el input de caption se agrega de forma independiente en cada uno.
- **Cola offline**: `src/lib/offlineQueue.ts` (`QueuedIncident`, `EnqueueInput`, `enqueue()`), `src/features/incidents/hooks/useOfflineIncidentSync.ts` (`buildEvidenciasFromBlobs`).
- **Detalle**: `src/features/incidents/pages/IncidentDetailPage.tsx` (`EvidenciasSubBlock`).
- **i18n**: `src/i18n/es-PE.json`, `src/i18n/en-US.json`.
- **Tests**: unitarios de ambos schemas, ambos formularios, `offlineQueue.test.ts`, `useOfflineIncidentSync.test.ts` — incluyendo un caso de compatibilidad hacia atrás para entradas de cola encoladas antes de este cambio (sin el nuevo campo de captions).
- Sin impacto en backend real (aún no existe) ni en handlers MSW más allá de aceptar el campo `descripcion` ya presente en el payload de `evidencias` que los handlers de `POST /api/incidents` ya reciben como `IncidentEvidencia[]` procesados.
