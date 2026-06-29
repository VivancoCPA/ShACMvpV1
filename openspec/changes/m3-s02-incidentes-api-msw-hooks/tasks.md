## 1. API Client

- [x] 1.1 Crear `src/features/incidents/api/incidents.api.ts` importando la instancia Axios de `src/lib/axios.ts`
- [x] 1.2 Implementar `getIncidents(filters?: IncidentFilters)` — GET /api/incidents con params
- [x] 1.3 Implementar `getIncident(id)` — GET /api/incidents/:id
- [x] 1.4 Implementar `createIncident(data)` — POST /api/incidents
- [x] 1.5 Implementar `updateIncident(id, data)` — PATCH /api/incidents/:id
- [x] 1.6 Implementar `updateIncidentStatus(id, data)` — PATCH /api/incidents/:id/status
- [x] 1.7 Implementar `deleteIncident(id)` — DELETE /api/incidents/:id
- [x] 1.8 Implementar `restoreIncident(id)` — PATCH /api/incidents/:id/restore
- [x] 1.9 Implementar `createAC(incidenteId, data)` — POST /api/incidents/:id/acciones
- [x] 1.10 Implementar `updateAC(incidenteId, acId, data)` — PATCH /api/incidents/:incidenteId/acciones/:acId

## 2. MSW Fixtures

- [x] 2.1 Crear `src/mocks/fixtures/incidents.fixtures.ts` con el array `incidentFixtures` de 14 elementos
- [x] 2.2 Agregar fixtures #1–#3 (ACCIDENTE: CERRADO/EN_INVESTIGACION/ABIERTO)
- [x] 2.3 Agregar fixtures #4–#6 (INCIDENTE: ABIERTO/EN_EJECUCION/ANALISIS_COMPLETADO)
- [x] 2.4 Agregar fixtures #7–#9 (CUASI_ACCIDENTE: ABIERTO/EN_INVESTIGACION/PENDIENTE_CIERRE)
- [x] 2.5 Agregar fixtures #10–#12 (CONDICION_INSEGURA: ABIERTO/EN_EJECUCION/CERRADO)
- [x] 2.6 Agregar fixture #13 (ACCIDENTE/ANULADO) y fixture #14 (INCIDENTE/ABIERTO con deletedAt)
- [x] 2.7 Verificar que fixture #2 tiene entrada `REPORTE_TARDIO` en auditTrail
- [x] 2.8 Verificar que fixture #5 tiene 2 ACs completas y fixture #11 tiene 1 AC
- [x] 2.9 Exportar `incidentFixtures` desde `src/mocks/fixtures/index.ts`

## 3. MSW Handlers

- [x] 3.1 Crear `src/mocks/handlers/incidents.handlers.ts` con `let incidents = [...incidentFixtures]`
- [x] 3.2 Implementar handler `GET /api/incidents` con filtrado por tipo, estado, severidad, areaId, turno, fechaDesde, fechaHasta, showDeleted y search
- [x] 3.3 Implementar paginación en GET /api/incidents (page, pageSize, totalItems, totalPages)
- [x] 3.4 Implementar handler `GET /api/incidents/:id` con búsqueda incluyendo eliminados
- [x] 3.5 Implementar handler `POST /api/incidents` con validación de campos requeridos y descripción mínima 20 chars
- [x] 3.6 Implementar cálculo automático de severidad con `getAutoSeveridad` en POST handler
- [x] 3.7 Implementar detección de reporte tardío (> 24h entre fechaEvento y timestamp actual) en POST
- [x] 3.8 Implementar handler `PATCH /api/incidents/:id` para actualizar campos de investigación
- [x] 3.9 Implementar handler `PATCH /api/incidents/:id/status` con tabla de transiciones válidas y retorno 422 si inválida
- [x] 3.10 Implementar handler `DELETE /api/incidents/:id` — verificar estado ABIERTO y !deletedAt antes de setear deletedAt
- [x] 3.11 Implementar handler `PATCH /api/incidents/:id/restore` — verificar deletedAt definido, luego limpiar
- [x] 3.12 Implementar handler `POST /api/incidents/:id/acciones` — generar AC y append al array
- [x] 3.13 Implementar handler `PATCH /api/incidents/:incidenteId/acciones/:acId` — actualizar AC específica

## 4. Registro en MSW index

- [x] 4.1 Importar `incidentHandlers` en `src/mocks/handlers/index.ts` y spread en el array `handlers`
- [x] 4.2 Verificar que los handlers de M1 (`documentHandlers`) y M2 (`nonconformityHandlers`) siguen presentes

## 5. TanStack Query Hooks

- [x] 5.1 Crear `src/features/incidents/hooks/useIncidents.ts` con `INCIDENT_QUERY_KEYS`
- [x] 5.2 Implementar `useIncidents(filters)` — useQuery con staleTime de 5 minutos
- [x] 5.3 Implementar `useIncident(id)` — useQuery con `enabled: !!id`
- [x] 5.4 Implementar `useCreateIncident()` — useMutation con invalidación de `['incidents']` y toasts
- [x] 5.5 Implementar `useUpdateIncident()` — mutate arg `{ id, data }`, invalidar `['incidents']`
- [x] 5.6 Implementar `useUpdateIncidentStatus()` — mutate arg `{ id, estado, comentario? }`, invalidar `['incidents']`
- [x] 5.7 Implementar `useDeleteIncident()` — mutate arg `id: string`, invalidar `['incidents']`
- [x] 5.8 Implementar `useRestoreIncident()` — mutate arg `id: string`, invalidar `['incidents']`
- [x] 5.9 Implementar `useCreateACIncidente(incidenteId)` — invalidar `detail(incidenteId)` en onSuccess
- [x] 5.10 Implementar `useUpdateACIncidente(incidenteId)` — mutate arg `{ acId, data }`, invalidar `detail(incidenteId)`
- [x] 5.11 Verificar que no hay ningún `any` en el archivo (compilar con strict: true)

## 6. Barrel export y verificación final

- [x] 6.1 Actualizar `src/features/incidents/index.ts` — re-exportar hooks y funciones del API client
- [x] 6.2 Agregar claves i18n de toasts al namespace `incidents` en `src/i18n/es-PE.json` y `src/i18n/en-US.json`
- [x] 6.3 Ejecutar `tsc --noEmit` y confirmar cero errores TypeScript
- [x] 6.4 Arrancar la app con MSW activo y verificar en Network tab que los handlers interceptan correctamente
