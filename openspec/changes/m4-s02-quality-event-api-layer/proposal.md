## Why

El módulo M4 — Quality Event es el núcleo del sistema SHAC y aún carece de su capa de datos: no existen el cliente Axios, los handlers MSW, los fixtures ni los hooks TanStack Query que los módulos M4-S03 (listado) y M4-S05 (detalle) necesitan para funcionar. Esta sprint cierra esa brecha sin tocar la UI.

## What Changes

- Nuevo archivo `src/features/quality-events/api/quality-events.api.ts` con 5 funciones Axios puras.
- Nuevos tipos en `src/features/quality-events/types/` para `QEListParams`, `QualityEventCreateInput`, `QualityEventUpdateInput`, `QEStatusTransitionInput`.
- 8 fixtures en `src/mocks/fixtures/quality-events.fixtures.ts` cubriendo los 4 orígenes, ≥5 estados, 4 tipos y 4 severidades. Usa IDs reales de NC (`nc-002`, `nc-003`) e incidentes (`inc-002`, `inc-001`).
- Handlers MSW en `src/mocks/handlers/quality-events.handlers.ts` con 5 endpoints (GET list, GET detail, POST create, PATCH update, PATCH status) y guards mock para RN-QE-002 y RN-QE-004.
- 5 hooks TanStack Query en `src/features/quality-events/hooks/`.
- Registro de handlers en `src/mocks/handlers/index.ts`.
- Test unitario de `useTransitionQEStatus` sobre fixture sin causa raíz firmada.

## Capabilities

### New Capabilities

- `quality-event-api`: Cliente Axios puro para los 5 endpoints del recurso Quality Event, con tipos de entrada/salida estrictos.
- `quality-event-msw`: Handlers MSW con fixtures reales, filtrado en memoria y guards de negocio mock (RN-QE-002, RN-QE-004).
- `quality-event-hooks`: Hooks TanStack Query (`useQualityEvents`, `useQualityEvent`, `useCreateQualityEvent`, `useUpdateQualityEvent`, `useTransitionQEStatus`) con invalidación de caché y feedback Sonner.

### Modified Capabilities

## Impact

- **Nuevos archivos:** `src/features/quality-events/api/quality-events.api.ts`, `src/features/quality-events/types/qualityEvent.types.ts` (extensión), `src/mocks/fixtures/quality-events.fixtures.ts`, `src/mocks/handlers/quality-events.handlers.ts`, `src/features/quality-events/hooks/useQualityEvents.ts`, `src/features/quality-events/hooks/useQualityEvent.ts`, `src/features/quality-events/hooks/useCreateQualityEvent.ts`, `src/features/quality-events/hooks/useUpdateQualityEvent.ts`, `src/features/quality-events/hooks/useTransitionQEStatus.ts`.
- **Archivos modificados:** `src/mocks/handlers/index.ts` (agregar `qualityEventHandlers`).
- **Sin cambios en UI:** ningún componente ni ruta se toca en este sprint.
- **Dependencias de fixtures:** referencias cruzadas reales a `nc-002` y `nc-003` (nonconformities) y a `inc-002` e `inc-001` (incidents).
