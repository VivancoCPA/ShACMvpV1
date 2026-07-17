## Why

Ningún RN-DOC actual impide que el mismo usuario quede asignado como `revisorId` y `aprobadorId` de un documento. Esto es alcanzable en la práctica: `ALTA_DIRECCION` está habilitado para actuar como Revisor y como Aprobador, y ambos campos se asignan de forma independiente en el formulario. A diferencia de RN-QE-004 (M4), en M1 no existe un rol por encima de `ALTA_DIRECCION` para escalar una segunda firma, así que la única solución consistente con segregación de funciones (ISO 9001 §5.3) es bloquear la asignación en el formulario.

## What Changes

- Nueva regla de negocio **RN-DOC-019 — Segregación de funciones Revisor ≠ Aprobador**: `revisorId` y `aprobadorId` de un mismo documento no pueden ser el mismo usuario.
- `documentFormSchema` (`src/features/documents/schemas/documentForm.schema.ts`) agrega una validación cruzada (`superRefine`) que falla cuando `revisorId` y `aprobadorId` son iguales y no vacíos, adjuntando el error a `aprobadorId`.
- El formulario (`DocumentForm.tsx`) bloquea el guardado (create y edit en `BORRADOR`, único punto donde ambos campos son editables) mostrando el mensaje de error vía el patrón `FieldError` ya existente — sin nuevo componente de UI.
- Nueva clave i18n (`documents:form.error_revisor_aprobador_same`) en `es-PE.json` y `en-US.json` para el mensaje de bloqueo.
- No se valida retroactivamente contra documentos/fixtures ya existentes — el `superRefine` solo se ejecuta al enviar el formulario (create/edit), nunca sobre datos ya persistidos.

## Capabilities

### New Capabilities

_Ninguna — esta regla se implementa como validación adicional sobre un schema Zod ya existente._

### Modified Capabilities

- `document-form`: agrega el requisito de que `documentFormSchema` rechace `revisorId === aprobadorId` (cuando ambos tienen valor), con el mensaje de error correspondiente expuesto en el formulario.

## Impact

- `shc-controldoc/src/features/documents/schemas/documentForm.schema.ts` — nueva regla `superRefine`.
- `shc-controldoc/src/features/documents/schemas/documentForm.schema.test.ts` (si no existe, crear) — casos de la nueva regla.
- `shc-controldoc/src/i18n/es-PE.json`, `shc-controldoc/src/i18n/en-US.json` — nueva clave de mensaje de error.
- `shc-controldoc/src/features/documents/components/DocumentForm.tsx` — sin cambios estructurales; el error se renderiza vía `FieldError` existente en `aprobadorId`.
- No afecta `createDocument.schema.ts` / `updateDocument.schema.ts` (`document-schemas`): estos schemas no están conectados a ningún flujo real (`useDocumentForm.ts` usa `documentFormSchema` directamente vía `api.post`/`api.put`), por lo que quedan fuera de alcance de este cambio.
