# Spec: incident-tanstack-hooks

## Purpose

TanStack Query v5 hooks for the Incidents module (`src/features/incidents/hooks/useIncidents.ts` and co-located files). Provides one query hook and multiple mutation hooks that wrap the API client functions, manage cache invalidation, and display localized Sonner toasts on success/failure.

---

## Requirements

### Requirement: INCIDENT_QUERY_KEYS constant
The module SHALL export a typed `INCIDENT_QUERY_KEYS` constant with `all`, `list(filters)`, and `detail(id)` factories.

#### Scenario: Query keys are typed tuples
- **WHEN** `INCIDENT_QUERY_KEYS.all` is used as a query key
- **THEN** TypeScript infers the type as `readonly ['incidents']`

#### Scenario: List key includes filters
- **WHEN** `INCIDENT_QUERY_KEYS.list({ tipo: 'ACCIDENTE' })` is called
- **THEN** the resulting key is `['incidents', 'list', { tipo: 'ACCIDENTE' }]`

### Requirement: useIncidents hook
The module SHALL export `useIncidents(filters: IncidentFilters)` that calls `getIncidents` with those filters and returns the TanStack Query result.

#### Scenario: Returns paginated data
- **WHEN** `useIncidents({})` is used in a component
- **THEN** `data` is the `NCListResponse`-equivalent from `getIncidents` and the query key is `INCIDENT_QUERY_KEYS.list({})`

### Requirement: useIncident hook
The module SHALL export `useIncident(id: string)` that calls `getIncident(id)` and is only enabled when `id` is truthy.

#### Scenario: Disabled when id is empty
- **WHEN** `useIncident('')` is called
- **THEN** the query is not fired (enabled: false)

### Requirement: useCreateIncident mutation
The module SHALL export `useCreateIncident()` that calls `createIncident` and on success invalidates `INCIDENT_QUERY_KEYS.all` and shows a toast.

#### Scenario: Invalidates list on success
- **WHEN** `useCreateIncident().mutate(data)` resolves successfully
- **THEN** `queryClient.invalidateQueries({ queryKey: ['incidents'] })` is called

#### Scenario: Shows error toast on failure
- **WHEN** `useCreateIncident().mutate(data)` rejects
- **THEN** `toast.error` is called with a localized message from the `incidents` i18n namespace

### Requirement: useUpdateIncident mutation
The module SHALL export `useUpdateIncident()` whose `mutate` argument is `{ id: string; data: Partial<UpdateIncidentInvestigacionInput> }` with no `any` types.

#### Scenario: Typed mutate argument
- **WHEN** `useUpdateIncident().mutate({ id: 'inc-001', data: { condicionesEntorno: ['PISO'] } })` is called
- **THEN** TypeScript accepts the call without errors and `updateIncident` is invoked

### Requirement: useUpdateIncidentStatus mutation
The module SHALL export `useUpdateIncidentStatus()` whose `mutate` argument is `{ id: string; estado: IncidentStatus; comentario?: string }`.

#### Scenario: Valid status update call
- **WHEN** `useUpdateIncidentStatus().mutate({ id: 'inc-003', estado: 'EN_INVESTIGACION' })` is called
- **THEN** `updateIncidentStatus('inc-003', { estado: 'EN_INVESTIGACION' })` is invoked

### Requirement: useDeleteIncident mutation
The module SHALL export `useDeleteIncident()` whose `mutate` accepts `id: string` and on success invalidates `['incidents']`.

#### Scenario: Cache invalidated on delete
- **WHEN** `useDeleteIncident().mutate('inc-003')` resolves successfully
- **THEN** `queryClient.invalidateQueries({ queryKey: ['incidents'] })` is called

### Requirement: useRestoreIncident mutation
The module SHALL export `useRestoreIncident()` whose `mutate` accepts `id: string` and on success invalidates `['incidents']`.

#### Scenario: Cache invalidated on restore
- **WHEN** `useRestoreIncident().mutate('inc-014')` resolves successfully
- **THEN** `queryClient.invalidateQueries({ queryKey: ['incidents'] })` is called

### Requirement: useCreateACIncidente mutation factory
The module SHALL export `useCreateACIncidente(incidenteId: string)` that calls `createAC(incidenteId, data)` and on success invalidates `INCIDENT_QUERY_KEYS.detail(incidenteId)`.

#### Scenario: Invalidates detail on AC creation
- **WHEN** `useCreateACIncidente('inc-005').mutate(data)` resolves
- **THEN** `queryClient.invalidateQueries({ queryKey: ['incidents', 'detail', 'inc-005'] })` is called

### Requirement: useUpdateACIncidente mutation factory
The module SHALL export `useUpdateACIncidente(incidenteId: string)` whose `mutate` argument is `{ acId: string; data: Partial<AccionCorrectivaIncidente> }` and on success invalidates the detail query.

#### Scenario: Typed mutate argument for AC update
- **WHEN** `useUpdateACIncidente('inc-005').mutate({ acId: 'ac-001', data: { estado: 'COMPLETADA' } })` is called
- **THEN** TypeScript accepts the call and `updateAC('inc-005', 'ac-001', { estado: 'COMPLETADA' })` is invoked

### Requirement: No any types
All hooks MUST be free of `any` types in their TypeScript signatures and implementations.

#### Scenario: Strict TypeScript compilation
- **WHEN** `useIncidents.ts` is compiled with `strict: true`
- **THEN** there are zero TypeScript errors and no `any` in the file

### Requirement: Toast notifications use incidents i18n namespace
All `toast.success` and `toast.error` calls inside hooks MUST use `useTranslation('incidents')` keys.

#### Scenario: i18n namespace used for toasts
- **WHEN** a mutation succeeds or fails
- **THEN** `t('incidents:...')` produces the toast message (not a hardcoded Spanish string)
