## Why

Toño publicó un documento con el flujo completo, pero la pestaña **Resumen** del detalle de documento (`/documentos/:id`) no muestra la información de publicación que el mockup aprobado (`Claude outputs/SHAC-Mockup-Detalle-Documento-Opcion1.html`) sí tenía. Hoy esa pestaña solo pinta `documento.descripcion` y, cuando aplica, la sección del archivo original — queda casi vacía en `PUBLICADO`/`EN_REVISION_PERIODICA`/`OBSOLETO`, donde el archivo original ya no es visible (RN-DOC-013) pero el documento ya tiene firmante, fecha de publicación, hash y motivo de versión disponibles en el propio objeto `documento` (nadie los pinta). Este change es un complemento de `detalle-documento-dos-columnas` (ya implementado, pendiente solo de QA manual) — no cambia su layout de pestañas/sidebar, solo completa el contenido de la pestaña Resumen.

## What Changes

- Nuevo helper compartido `getDatosPublicacion(documento)` en `features/documents/utils/publicacion.ts`: devuelve `{ firmadoPorId, fecha, hash } | undefined`, tomando la última entrada `FIRMA_REGISTRADA` del `auditTrail` (hash = su `valorNuevo`); si no existe, usa como respaldo la última `ESTADO_CAMBIADO → PUBLICADO` (sin hash) o, en último caso, `aprobadorId` + `fechaEmision`.
- `DocumentDetailSidebar` deja de tener su propia función local `getFechaPublicacion` y consume el mismo helper, para que no haya dos versiones de la misma lógica (hoy divergen: la sidebar no cubre el respaldo de `aprobadorId`+`fechaEmision`).
- La pestaña Resumen (`DocumentDetailPage`) gana, en este orden:
  1. "Sin descripción" en `muted` cuando no hay `descripcion` (en vez del "—" suelto actual).
  2. Tarjeta **"Documento publicado"** — solo en `PUBLICADO`, `EN_REVISION_PERIODICA` y `OBSOLETO` — con ícono + nombre de archivo, "Firmado por {nombre} · {fecha y hora} · hash abreviado" (hash completo en tooltip + botón copiar), botón "Ver" (misma acción/condición que "Ver documento" de la sidebar), y en `OBSOLETO` una línea adicional "Versión obsoleta desde {fechaObsolescencia}" si existe.
  3. "Motivo del cambio (v{version})" con `documento.motivoVersion`, en cualquier estado donde exista.
  4. "Vigente desde" con `fechaVigencia`, solo en `PUBLICADO`/`EN_REVISION_PERIODICA`.
  5. La sección del archivo original, sin cambios de condición.
- MSW: las fixtures de documentos `PUBLICADO` y `OBSOLETO` incorporan una entrada `FIRMA_REGISTRADA` con hash y un `motivoVersion`, para que la tarjeta tenga datos en modo mock.
- i18n: nuevas claves en `es-PE`/`en-US` para la tarjeta, "Sin descripción", "Copiar hash" y "Hash copiado".
- No se toca el backend ni el modelo de datos — toda la información ya existe en `documento`/`auditTrail`. No se crea el campo "Alcance" que aparecía en el mockup por error (no existe en el modelo real).

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `document-detail`: la pestaña Resumen gana la tarjeta "Documento publicado", "Motivo del cambio" y "Vigente desde"; se formaliza el helper compartido `getDatosPublicacion` que tanto la pestaña Resumen como la sidebar (`Sidebar ficha metadata card`, ya existente) deben usar para la fecha de publicación.

## Impact

- Frontend: `DocumentDetailPage.tsx` (contenido del panel Resumen), nuevo `features/documents/utils/publicacion.ts`, `DocumentDetailSidebar.tsx` (reemplaza su `getFechaPublicacion` local por el helper), `es-PE.json`/`en-US.json`.
- MSW: `mocks/fixtures/documents.fixtures.ts` (agregar `FIRMA_REGISTRADA` + `motivoVersion` a fixtures `PUBLICADO`/`OBSOLETO` relevantes).
- Sin cambios de backend, de tipos (`Documento`/`AuditTrailEntry` ya tienen todos los campos necesarios), ni de permisos.
