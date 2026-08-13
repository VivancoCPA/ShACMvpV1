## 1. Tipo `IncidentEvidencia`

- [x] 1.1 Agregar `descripcion?: string` a la interfaz `IncidentEvidencia` en `src/features/incidents/types/incident.types.ts`, con comentario breve indicando que es el caption opcional de la foto (máx. 140 caracteres, validado en los schemas Zod de cada formulario).

## 2. Cola offline (`offlineQueue.ts`) — esquema y funciones

- [x] 2.1 Agregar `photoCaptions?: (string | undefined)[]` a `QueuedIncident` en `src/lib/offlineQueue.ts`, con comentario inline documentando la invariante de D1 (design.md): se construye siempre junto a `photoBlobs`, en el mismo `.map()`, nunca mutado por separado; una entrada sin este campo (esquema anterior) se trata como si ninguna foto tuviera caption.
- [x] 2.2 Agregar `photoCaptions?: (string | undefined)[]` a `EnqueueInput`.
- [x] 2.3 Actualizar `enqueue()` para persistir `photoCaptions` en la entrada nueva (si no viene en el input, omitir el campo o guardar `undefined`, nunca inventar valores).
- [x] 2.4 No requiere bump de `DB_VERSION` (campo opcional nuevo sobre el mismo object store, mismo criterio que `retryCount` en `m7-f3-hardening`).

## 3. Tests de `offlineQueue.ts`

- [x] 3.1 Test: `enqueue()` con `photoCaptions` persiste el array alineado por índice con `photoBlobs`.
- [x] 3.2 Test: `enqueue()` sin `photoCaptions` (todas las fotos sin caption) no lanza error y la entrada queda sin el campo o con `undefined`s.
- [x] 3.3 Test de compatibilidad hacia atrás (mismo patrón que el test existente de `retryCount` sin migrar, `offlineQueue.test.ts`): escribir una entrada directo en IndexedDB sin `photoCaptions` (bypaseando `enqueue()`), confirmar que se puede leer (`getById`) sin error y que el campo es `undefined`.

## 4. Propagación en `useOfflineIncidentSync.ts`

- [x] 4.1 Cambiar la firma de `buildEvidenciasFromBlobs` de `(blobs: Blob[], creadoPorId: string)` a `(blobs: Blob[], captions: (string | undefined)[] | undefined, creadoPorId: string)`, mapeando `descripcion: captions?.[i]` en cada `IncidentEvidencia` construida — omitir la clave si `captions?.[i]` es `undefined` (no asignar `descripcion: undefined` explícito, para no ensuciar el objeto).
- [x] 4.2 Actualizar el call site (`useOfflineIncidentSync.ts`, ciclo de sincronización) para pasar `entry.photoCaptions`.

## 5. Tests de `useOfflineIncidentSync.ts`

- [x] 5.1 Test: sincronización de una entrada con `photoCaptions` definido propaga cada caption a la `descripcion` de la evidencia correspondiente, respetando el índice.
- [x] 5.2 Test: sincronización de una entrada sin `photoCaptions` (simulando una entrada encolada antes de este cambio) reconstruye las evidencias sin `descripcion`, sin lanzar error.

## 6. Schema Zod y formulario mobile (`IncidentQuickReportForm.tsx`)

- [x] 6.1 Extender `mobileIncidentReportSchema` (`src/features/incidents/schemas/mobileIncidentReport.schema.ts`) con validación de caption opcional por foto: máximo 140 caracteres, normalizando `''` a `undefined`.
- [x] 6.2 Agregar `caption?: string` a la interfaz local `PhotoPreview` en `IncidentQuickReportForm.tsx`.
- [x] 6.3 Agregar, bajo cada thumbnail 80×80 del grid de fotos (`IncidentQuickReportForm.tsx` ~línea 377), un `<input type="text" maxLength={140}>` de una sola línea con `aria-label` (CLAUDE.md regla 10 — sin `<label>` visible por el layout compacto), que actualiza el `caption` de esa entrada en el estado `photos`.
- [x] 6.4 Confirmar que `removePhoto(index)` sigue funcionando correctamente sobre el array `photos` (que ahora incluye `caption`) sin desalinear captions de las fotos restantes.
- [x] 6.5 En la construcción de `evidencias: IncidentEvidencia[]` dentro de `onSubmit` (envío online), mapear `descripcion: p.caption` (normalizado, `''` → `undefined`) desde cada `PhotoPreview`.
- [x] 6.6 En la rama de `enqueue()` (envío offline), pasar `photoCaptions: photos.map((p) => p.caption)` junto con `photoBlobs: photos.map((p) => p.file)`.

## 7. Tests de `IncidentQuickReportForm.test.tsx` (mobile)

- [x] 7.1 Test: escribir un caption bajo una foto adjuntada y enviar online → la evidencia resultante incluye `descripcion` con ese valor.
- [x] 7.2 Test: caption vacío no aparece como `descripcion` en la evidencia enviada.
- [x] 7.3 Test: caption de más de 140 caracteres muestra error de validación inline y no envía la request.
- [x] 7.4 Test: envío offline con 2-3 fotos con captions distintos → `enqueue()` se invoca con `photoCaptions` alineado correctamente con `photoBlobs`.
- [x] 7.5 Test: remover una foto del medio conserva el caption correcto de las fotos restantes (regresión del riesgo de desalineación de índices).

## 8. Schema Zod y formulario de escritorio (`IncidentForm.tsx`)

- [x] 8.1 Extender el schema Zod usado por `IncidentForm.tsx` (`incidentForm.schema.ts` — `createIncidentFormSchema`/`updateIncidentFormSchema`) con la misma validación de caption opcional por foto nueva: máximo 140 caracteres, `''` normalizado a `undefined`.
- [x] 8.2 Agregar `caption?: string` a la interfaz local `EvidenciaPreviewItem` en `IncidentForm.tsx`.
- [x] 8.3 Agregar, bajo cada preview de foto **nueva** en `EvidenciasZona` (no bajo evidencias existentes de modo edición, que permanecen de solo lectura sin input), un input de texto de una sola línea con `maxLength={140}` y `aria-label`/`<label>` asociado según corresponda al layout de escritorio.
- [x] 8.4 En la construcción de `mockEvidencias: IncidentEvidencia[]` dentro de `onSubmit`, mapear `descripcion: caption` normalizado desde cada `EvidenciaPreviewItem` nueva.

## 9. Tests de `IncidentForm.test.tsx` (escritorio)

- [x] 9.1 Test: escribir un caption bajo una foto nueva adjuntada y enviar → la evidencia resultante incluye `descripcion` con ese valor.
- [x] 9.2 Test: caption vacío no aparece como `descripcion` en la evidencia enviada.
- [x] 9.3 Test: caption de más de 140 caracteres muestra error de validación inline y no envía la request.
- [x] 9.4 Test: en modo edición, las evidencias existentes no muestran ningún input de caption (siguen siendo de solo lectura).

## 10. Presentación en `IncidentDetailPage.tsx`

- [x] 10.1 En `EvidenciasSubBlock`, cuando `ev.descripcion` esté definida para una evidencia de imagen, renderizar el texto bajo el thumbnail (`text-xs text-muted dark:text-on-dark-soft`, `line-clamp-2`), sin modificar el `alt` del `<img>` (sigue siendo `ev.nombre`).
- [x] 10.2 Test: evidencia con `descripcion` muestra el texto bajo su thumbnail.
- [x] 10.3 Test: evidencia sin `descripcion` no renderiza ningún texto adicional (sin regresión visual sobre el layout actual).

## 11. i18n

- [x] 11.1 Agregar bajo `incidents:form.evidencias.*` en `es-PE.json`/`en-US.json` (escritorio): `captionPlaceholder`, `captionAriaLabel`. Desviación respecto al enunciado original: no se agregó `captionLabel` (no hay `<label>` visible, solo `aria-label` + `placeholder`, por diseño D3) ni `captionErrorMaxLength` (el mensaje de validación Zod de este schema es texto plano hardcodeado, mismo patrón ya usado por el resto de mensajes de `incidentForm.schema.ts`/`mobileIncidentReport.schema.ts` — ninguno de esos schemas enruta sus mensajes por `t()`).
- [x] 11.2 Agregar bajo `incidents:mobile.form.evidencias.*` en ambos locales (mobile): `captionPlaceholder`/`captionAriaLabel` (mismo criterio que 11.1).
- [x] 11.3 Confirmar que ninguna clave nueva quede sin su contraparte en `en-US.json` (criterio de aceptación global de CLAUDE.md).

## 12. Verificación manual

- [x] 12.1 Build de producción (`npx vite build`). **Hecho** — build exitoso (`dist/sw.js` generado en modo `injectManifest`, sin errores; solo warnings preexistentes de chunk size y dynamic import ya presentes antes de este cambio). Flujo de escritorio (`/incidents/nuevo`) con 2 fotos con captions distintos, verificado en navegador real (Chromium vía Playwright contra el dev server con MSW): `IncidentDetailPage` de `INC-2026-021` muestra "Válvula de escape dañada..." y "Charco de aceite bajo la maquina 3" bajo cada thumbnail, correctamente alineados sin desalinear índices.
- [x] 12.2 Repetido desde `/m/incidentes/nuevo` con conexión activa (envío online, sesión 2026-08-12). Verificado vía `GET /api/incidents`: el incidente creado con descripción `MARCADOR-MOBILE-ONLINE` persiste `evidencias[].descripcion` = `["Online caption uno","Online caption dos"]`, alineado por índice.
- [x] 12.3 Repetido desde `/m/incidentes/nuevo` sin conexión (offline vía `context.setOffline(true)` de Playwright — confirmado el estado "Reporte guardado / No hay conexión" con badge "1 pendiente"), reconectado (`setOffline(false)` + evento `online`). Verificado vía `GET /api/incidents`: el incidente sincronizado (descripción `MARCADOR-UNICO-OFFLINE-TEST`) persiste `evidencias[].descripcion` = `["Offline caption uno","Offline caption dos"]`, correctamente reconstruido desde `photoCaptions` por `buildEvidenciasFromBlobs`.
- [x] 12.4 Verificado Light Mode y Dark Mode (vía `colorScheme: 'dark'` de Playwright) de los inputs de caption en ambos formularios (escritorio y mobile) y del texto de caption en `IncidentDetailPage` — sin defectos visuales en ningún caso: contraste correcto, bordes/focus ring visibles, texto legible bajo cada thumbnail en ambos temas.

**Verificación realizada 2026-08-12 vía sesión de Cowork** (no Claude Code): dev server local (`npx vite`) + Chromium headless (Playwright) contra `http://127.0.0.1:5180` con `VITE_ENABLE_MSW=true`. Screenshots y respuestas de API capturados como evidencia. Suite de tests (`npx vitest run`) no se pudo ejecutar en esta sesión por incompatibilidad de binarios nativos de `rolldown` entre el `node_modules` del repo (Windows) y el entorno de verificación (Linux) — pendiente correrla desde una terminal nativa antes de dar el proposal por cerrado del todo.
