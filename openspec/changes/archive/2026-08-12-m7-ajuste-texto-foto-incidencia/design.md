## Context

`IncidentEvidencia` (definida en `src/features/incidents/types/incident.types.ts`) hoy solo lleva metadatos automáticos por foto (`id`, `url`, `nombre`, `tipo`, `tamanioKb`, `creadoEn`, `creadoPor`). Ni `IncidentQuickReportForm` (mobile) ni `IncidentForm`/`EvidenciasZona` (escritorio) comparten un componente de thumbnail — cada uno define su propio tipo de preview local (`PhotoPreview` en mobile, `EvidenciaPreviewItem` en escritorio) y su propio handler de selección de archivos. Esto significa que el input de caption se agrega dos veces, de forma independiente, no una vez en un componente compartido.

En el flujo offline (mobile, sin conexión), las fotos comprimidas se persisten como `Blob[]` planos en `QueuedIncident.photoBlobs` (IndexedDB, `src/lib/offlineQueue.ts`), sin ningún metadato asociado por foto. Al reconectar, `useOfflineIncidentSync.buildEvidenciasFromBlobs()` reconstruye `IncidentEvidencia[]` a partir de esos blobs. `m7-f3-hardening` ya estableció el precedente de cómo agregar un campo nuevo a `QueuedIncident` sin romper entradas ya encoladas por una versión anterior del esquema (`retryCount?: number`, tratado como `0` en todo punto de lectura vía `?? 0`) — ese mismo criterio de compatibilidad hacia atrás aplica aquí.

Decisiones ya tomadas fuera de este documento (ver proposal.md, sección "What Changes"): el caption es opcional y no bloqueante, límite de 140 caracteres, se muestra en `IncidentDetailPage`, y no aplica retroactivamente a evidencias ya existentes.

## Goals / Non-Goals

**Goals:**
- Permitir un texto opcional (máx. 140 caracteres) por foto adjunta, en ambos formularios (mobile y escritorio), para evidencias nuevas de la sesión de creación actual.
- Que el caption sobreviva el ciclo completo de la cola offline (encolar → IndexedDB → reconectar → sincronizar) sin pérdida ni desalineación entre foto y texto.
- Que una entrada de cola offline persistida por una versión anterior del esquema (sin el campo de captions) siga sincronizando correctamente, sin caption, sin error.
- Mostrar el caption en `IncidentDetailPage` bajo cada thumbnail cuando existe.

**Non-Goals:**
- No se unifica `PhotoPreview` (mobile) y `EvidenciaPreviewItem` (escritorio) en un componente compartido — cada formulario recibe el input de caption de forma independiente, siguiendo el patrón ya establecido de duplicación entre ambos formularios (fuera de alcance refactorizar eso en esta change).
- No se agrega edición de caption para evidencias ya existentes/guardadas (modo edición de escritorio, donde hoy son thumbnails no eliminables de solo lectura) — permanecen de solo lectura, sin caption.
- No se agrega caption en el lightbox de `IncidentDetailPage` más allá de una línea de texto bajo el thumbnail — no se rediseña el modal de lightbox.
- No hay backend real; los handlers MSW existentes de `POST /api/incidents` ya aceptan `evidencias` como `IncidentEvidencia[]` procesado, así que no requieren cambio de contrato — `descripcion` es simplemente un campo opcional más dentro de un objeto que ya aceptan.

## Decisions

### D1 — Forma del dato en `QueuedIncident`: array paralelo, no restructurar `photoBlobs`

**Decisión:** agregar `photoCaptions?: (string | undefined)[]` como campo nuevo y opcional en `QueuedIncident`, alineado por índice con `photoBlobs`. `photoBlobs: Blob[]` **no cambia de forma**.

**Alternativa considerada y descartada:** restructurar `photoBlobs: Blob[]` a `photos: { blob: Blob; caption?: string }[]`.

**Por qué se descarta la alternativa:** una entrada encolada por una versión anterior del esquema tiene `photoBlobs` como array plano de `Blob` — nunca tendrá un campo `photos`. Migrar a esa forma obligaría a todo punto de lectura (`useOfflineIncidentSync`, tests, cualquier consumidor futuro) a soportar **dos formas distintas de la misma información** (`entry.photos` si existe, si no reconstruir desde `entry.photoBlobs` sin captions) — una rama de compatibilidad estructural, no un simple `?? default` sobre un escalar. Es exactamente el tipo de migración más compleja que `retryCount` evitó al quedarse como campo opcional aditivo sobre la forma existente.

**Por qué el array paralelo es seguro aquí (a diferencia del riesgo típico de arrays paralelos):** `photoBlobs` y `photoCaptions` se construyen **en el mismo punto de código, a partir del mismo array fuente** (`photos: PhotoPreview[]` en el estado del formulario, ya sea al hacer `enqueue()` offline o al construir el payload online) — nunca se mutan por separado ni se persisten en momentos distintos. La garantía de alineación por índice viene de que ambos son un `.map()` sobre la misma lista en la misma línea de código, no de una invariante que dos código-paths distintos deban mantener manualmente sincronizada.

**Compatibilidad hacia atrás:** una entrada encolada antes de este cambio no tendrá `photoCaptions` (`undefined`). `buildEvidenciasFromBlobs()` lee `captions?.[i]` — `undefined` si el array no existe o el índice no tiene entrada — y ese valor pasa directo a `IncidentEvidencia.descripcion` (que ya es opcional). Sin rama condicional adicional, mismo patrón que `entry.retryCount ?? 0` de `m7-f3-hardening`, salvo que aquí el default es simplemente "sin definir" en vez de `0`.

### D2 — Validación del límite de 140 caracteres: por-foto, no agregada

Cada campo de texto de caption se valida de forma independiente (`z.string().max(140).optional()` por entrada), no como una validación agregada sobre el array completo. Un caption vacío (`''`) se normaliza a `undefined` antes de persistir/enviar (mismo criterio que el fix ya aplicado al `<select id="severidad">` en `m7-f2-offline-sync` tarea 4.6 — un string vacío nunca debe viajar como valor "presente").

### D3 — Ubicación del input de caption en cada formulario

- **Mobile** (`IncidentQuickReportForm`): el campo de texto aparece debajo de cada thumbnail 80×80 dentro del contenedor `flex flex-wrap` existente (`IncidentQuickReportForm.tsx` línea ~377), como un `<input type="text">` de una sola línea con `maxLength={140}` y `aria-label` (no `<label>` visible, para no romper el layout compacto de grid de thumbnails — CLAUDE.md regla 10 exige `aria-label` en ese caso).
- **Escritorio** (`EvidenciasZona` en `IncidentForm.tsx`): mismo patrón, input de una línea bajo cada preview nueva (no bajo las evidencias existentes de modo edición, que permanecen de solo lectura).
- El estado de caption vive en el mismo objeto que ya trackea cada foto (`PhotoPreview`/`EvidenciaPreviewItem` ganan un campo `caption?: string`), no en un array separado a nivel de formulario — evita drift de índices durante `removePhoto()`.

### D4 — Propagación en `useOfflineIncidentSync.buildEvidenciasFromBlobs`

La firma cambia de `buildEvidenciasFromBlobs(blobs: Blob[], creadoPorId: string)` a `buildEvidenciasFromBlobs(blobs: Blob[], captions: (string | undefined)[] | undefined, creadoPorId: string)`, mapeando `descripcion: captions?.[i]` en cada `IncidentEvidencia` construida. El call site (`useOfflineIncidentSync.ts` línea ~95) pasa `entry.photoCaptions`.

### D5 — Presentación en `IncidentDetailPage`

En `EvidenciasSubBlock`, cuando `ev.descripcion` existe, se renderiza como texto pequeño (`text-xs text-muted dark:text-on-dark-soft`) bajo el thumbnail de 80×80, truncado con `line-clamp-2` si excede el ancho disponible — no se agrega al lightbox ni al `alt` del `<img>` (el `alt` sigue siendo `ev.nombre`, no se sobrescribe con el caption, para no perder el nombre de archivo como fallback de accesibilidad).

## Risks / Trade-offs

- **[Riesgo]** Un futuro cambio que mute `photoBlobs` y `photoCaptions` en pasos separados (en vez de construirlos juntos desde la misma lista) reintroduciría el riesgo clásico de desalineación de arrays paralelos. → **Mitigación:** cualquier PR futuro que toque estos campos debe mantenerlos construidos en la misma expresión `.map()`; se documenta esta invariante como comentario inline en `QueuedIncident` (mismo estilo del comentario ya presente para `retryCount`).
- **[Riesgo]** Duplicar el input de caption en dos formularios (mobile y escritorio) sin componente compartido significa que un fix futuro de UX/accesibilidad debe aplicarse dos veces. → **Mitigación:** se acepta como Non-Goal explícito; ambos formularios ya duplican toda la lógica de thumbnail hoy, este cambio no introduce duplicación nueva en tipo, solo la extiende.
- **[Riesgo]** Un caption con contenido sensible o inapropiado no tiene ninguna validación de contenido (solo longitud). → **Mitigación:** fuera de alcance — mismo nivel de confianza que el resto de campos de texto libre del formulario (`descripcion` del incidente ya tiene el mismo nivel de exposición).

## Migration Plan

- No requiere bump de versión de IndexedDB (`DB_VERSION` en `offlineQueue.ts`) — `photoCaptions` es un campo opcional nuevo sobre el mismo `object store`, mismo criterio que `retryCount` en `m7-f3-hardening` (Migration Plan de esa fase).
- No hay rollback especial: si se revierte el código, las entradas que ya tengan `photoCaptions` persistido simplemente lo ignoran (campo no leído por código anterior), sin error.
- Test explícito de compatibilidad hacia atrás (mismo patrón que `offlineQueue.test.ts` para `retryCount`): escribir una entrada directo en IndexedDB sin `photoCaptions`, confirmar que `buildEvidenciasFromBlobs` la sincroniza sin caption y sin lanzar error.

## Open Questions

Ninguna pendiente — límite de caracteres (140), visibilidad en `IncidentDetailPage` (sí) y alcance no retroactivo fueron decididos antes de este documento (ver proposal.md).
