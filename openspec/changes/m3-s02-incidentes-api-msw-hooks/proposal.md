## Why

M3-S01 estableció los tipos, schemas Zod y enums para el módulo de Incidentes SyST; sin la capa de comunicación (API client, MSW handlers, fixtures y hooks TanStack Query) ningún componente de UI puede consumir ni simular datos de incidentes. Este sprint completa la infraestructura de datos del módulo antes de iniciar las pantallas.

## What Changes

- Nuevo cliente Axios `incidents.api.ts` con 9 operaciones (CRUD + soft-delete/restore + ACs).
- 14 fixtures de incidentes con cobertura de todos los tipos, estados, severidades y turnos definidos en M3-S01.
- Handlers MSW v2 para todos los endpoints, incluyendo filtrado, paginación, validación de transiciones de estado y cálculo automático de severidad.
- 9 hooks TanStack Query v5 (`useIncidents`, `useIncident`, `useCreateIncident`, `useUpdateIncident`, `useUpdateIncidentStatus`, `useDeleteIncident`, `useRestoreIncident`, `useCreateACIncidente`, `useUpdateACIncidente`).
- Actualización de `src/mocks/handlers/index.ts` para registrar los nuevos handlers.
- Barrel export actualizado en `src/features/incidents/index.ts`.

## Capabilities

### New Capabilities

- `incident-api-client`: Cliente Axios tipado para todos los endpoints REST de incidentes, incluyendo filtros avanzados y operaciones sobre acciones correctivas.
- `incident-msw-fixtures`: 14 fixtures estáticos que cubren todos los valores de `IncidentType`, `IncidentStatus`, `IncidentSeveridad` y `IncidentTurno`, con auditTrail, ACs embebidas y un registro soft-deleted.
- `incident-msw-handlers`: Handlers MSW v2 que simulan el backend: filtrado multi-criterio, paginación, validación de transiciones de estado, cálculo de severidad automática y detección de reporte tardío.
- `incident-tanstack-hooks`: Hooks de TanStack Query v5 para lista, detalle y todas las mutaciones, con invalidación de caché en `onSuccess`.

### Modified Capabilities

## Impact

- **Nuevos archivos**: `src/features/incidents/api/incidents.api.ts`, `src/mocks/fixtures/incidents.fixtures.ts`, `src/mocks/handlers/incidents.handlers.ts`, `src/features/incidents/hooks/useIncidents.ts`.
- **Archivos modificados**: `src/mocks/handlers/index.ts` (agregar `incidentHandlers`), `src/features/incidents/index.ts` (re-exportar hooks y api).
- **Dependencias upstream**: `src/features/incidents/types/` y `src/features/incidents/schemas/` (M3-S01 — ya implementados).
- **Sin impacto en**: M1 (documentos), M2 (no conformidades) ni la capa de UI existente.
