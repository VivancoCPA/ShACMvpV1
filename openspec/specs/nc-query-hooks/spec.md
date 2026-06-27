# Spec: nc-query-hooks

## Purpose

TanStack Query v5 hooks for the M2 Non-Conformities domain. Wrap the `nc-api-client` functions with query/mutation logic, correct cache invalidation, and Sonner toast feedback. All hooks live in `src/features/nonconformities/hooks/useNonconformities.ts` (or split into individual files per hook if preferred) and export a unified `QUERY_KEYS.nonconformities` key factory.

---

## Requirements

### Requirement: QUERY_KEYS.nonconformities key factory
The system SHALL export a `QUERY_KEYS` object from `src/features/nonconformities/hooks/useNonconformities.ts` (or a dedicated `src/features/nonconformities/hooks/queryKeys.ts`) with a `nonconformities` sub-object providing:
- `all: ['nonconformities'] as const`
- `list: (filters: NCFilters) => ['nonconformities', 'list', filters] as const`
- `detail: (id: string) => ['nonconformities', 'detail', id] as const`

#### Scenario: QUERY_KEYS.nonconformities.all is a stable reference
- **WHEN** two calls to `QUERY_KEYS.nonconformities.all` are compared
- **THEN** both return the array `['nonconformities']` with the same tuple type

#### Scenario: QUERY_KEYS.nonconformities.list includes filters in the key
- **WHEN** a developer calls `QUERY_KEYS.nonconformities.list({ estado: 'DETECTADA' })`
- **THEN** the returned key is `['nonconformities', 'list', { estado: 'DETECTADA' }]`

---

### Requirement: useNonconformities hook for paginated list
The system SHALL export a `useNonconformities` hook with signature `(filters?: NCFilters) => UseQueryResult<ApiResponse<NoConformidad[]>>` that calls `getNonconformities(filters)` via `useQuery` keyed by `QUERY_KEYS.nonconformities.list(filters ?? {})`. The query SHALL use a `staleTime` of 5 minutes.

#### Scenario: useNonconformities returns data from getNonconformities
- **WHEN** a component calls `useNonconformities({ dominio: 'SST' })`
- **THEN** the hook fetches from `GET /api/nonconformities?dominio=SST` and exposes the paginated NC list via `data.data`

#### Scenario: useNonconformities re-fetches when filters change
- **WHEN** the `filters` argument changes from `{ dominio: 'SST' }` to `{ dominio: 'CALIDAD' }`
- **THEN** TanStack Query treats the new key as distinct and issues a new network request

---

### Requirement: useNonconformity hook for single NC detail
The system SHALL export a `useNonconformity` hook with signature `(id: string) => UseQueryResult<ApiResponse<NoConformidad>>` that calls `getNonconformity(id)` via `useQuery` keyed by `QUERY_KEYS.nonconformities.detail(id)`. The hook SHALL set `enabled: false` when `id` is an empty string, preventing accidental fetches.

#### Scenario: useNonconformity fetches the NC with embedded ACs
- **WHEN** a component calls `useNonconformity('nc-001')`
- **THEN** the hook fetches from `GET /api/nonconformities/nc-001` and exposes `data.data.accionesCorrectivas`

#### Scenario: useNonconformity does not fetch when id is empty
- **WHEN** a component calls `useNonconformity('')`
- **THEN** no network request is made and `data` is `undefined`

---

### Requirement: useCreateNonconformity mutation hook
The system SHALL export a `useCreateNonconformity` hook that returns a `UseMutationResult` wrapping `createNonconformity`. On success: (1) invalidates `QUERY_KEYS.nonconformities.all`; (2) shows `toast.success(t('nonconformities:toasts.created'))`. If the response includes `warning: 'POSIBLE_DUPLICADO'`, additionally shows `toast.warning(t('nonconformities:toasts.posibleDuplicado'))`. On error: shows `toast.error(t('nonconformities:toasts.createError'))`.

#### Scenario: useCreateNonconformity invalidates nonconformities list on success
- **WHEN** a mutation triggered by `useCreateNonconformity` resolves successfully
- **THEN** TanStack Query invalidates all queries matching `['nonconformities']`, causing the list to re-fetch

#### Scenario: useCreateNonconformity shows success toast on creation
- **WHEN** the mutation resolves without a duplicate warning
- **THEN** `toast.success` is called with the key `'nonconformities:toasts.created'`

#### Scenario: useCreateNonconformity shows warning toast on possible duplicate
- **WHEN** the mutation resolves with `data.warning === 'POSIBLE_DUPLICADO'`
- **THEN** `toast.warning` is called with `'nonconformities:toasts.posibleDuplicado'` in addition to the success toast

#### Scenario: useCreateNonconformity shows error toast on failure
- **WHEN** the mutation rejects (e.g., 400 from missing required fields)
- **THEN** `toast.error` is called with `'nonconformities:toasts.createError'`

---

### Requirement: useUpdateNonconformity mutation hook
The system SHALL export a `useUpdateNonconformity` hook that returns a `UseMutationResult` wrapping `updateNonconformity(id, data)`. On success: (1) invalidates `QUERY_KEYS.nonconformities.all`; (2) shows `toast.success(t('nonconformities:toasts.updated'))`. On error: shows `toast.error(t('nonconformities:toasts.updateError'))`.

#### Scenario: useUpdateNonconformity invalidates cache on success
- **WHEN** the mutation resolves successfully
- **THEN** TanStack Query invalidates all nonconformity queries

#### Scenario: useUpdateNonconformity shows error toast on 409 conflict
- **WHEN** the mutation rejects with HTTP 409 (NC in CERRADA or ANULADA state)
- **THEN** `toast.error` is called with `'nonconformities:toasts.updateError'`

---

### Requirement: useAnularNonconformity mutation hook
The system SHALL export a `useAnularNonconformity` hook with mutation variables typed as `{ id: string; justificacion: string }`. The hook wraps `anularNonconformity(id, justificacion)`. On success: (1) invalidates `QUERY_KEYS.nonconformities.all`; (2) shows `toast.success(t('nonconformities:toasts.anulada'))`. On error: shows `toast.error(t('nonconformities:toasts.anularError'))`.

#### Scenario: useAnularNonconformity passes both id and justificacion to API
- **WHEN** a component calls `mutate({ id: 'nc-001', justificacion: 'NC duplicada' })`
- **THEN** the hook calls `anularNonconformity('nc-001', 'NC duplicada')`

#### Scenario: useAnularNonconformity invalidates cache on success
- **WHEN** the mutation resolves successfully
- **THEN** TanStack Query invalidates all nonconformity queries

---

### Requirement: useCreateAccionCorrectiva mutation hook
The system SHALL export a `useCreateAccionCorrectiva` hook that accepts `ncId: string` as a parameter and returns a `UseMutationResult` wrapping `createAccionCorrectiva(ncId, data)`. On success: (1) invalidates `QUERY_KEYS.nonconformities.detail(ncId)`; (2) shows `toast.success(t('nonconformities:toasts.acCreada'))`. On error: shows `toast.error(t('nonconformities:toasts.acCreateError'))`.

#### Scenario: useCreateAccionCorrectiva invalidates only the NC detail query
- **WHEN** the mutation resolves successfully for ncId='nc-001'
- **THEN** TanStack Query invalidates `['nonconformities', 'detail', 'nc-001']` only, not the full list

#### Scenario: useCreateAccionCorrectiva shows success toast
- **WHEN** the mutation resolves successfully
- **THEN** `toast.success` is called with `'nonconformities:toasts.acCreada'`

---

### Requirement: useUpdateAccionCorrectiva mutation hook
The system SHALL export a `useUpdateAccionCorrectiva` hook that accepts `ncId: string` as a parameter and returns a `UseMutationResult` wrapping `updateAccionCorrectiva(ncId, acId, data)` with mutation variables typed as `{ acId: string; data: UpdateACInput }`. On success: invalidates `QUERY_KEYS.nonconformities.detail(ncId)` and shows `toast.success(t('nonconformities:toasts.acUpdated'))`. On error: shows `toast.error(t('nonconformities:toasts.acUpdateError'))`.

#### Scenario: useUpdateAccionCorrectiva passes ncId and acId to API
- **WHEN** a component calls `mutate({ acId: 'ac-1', data: { estado: 'EN_EJECUCION' } })`
- **THEN** the hook calls `updateAccionCorrectiva(ncId, 'ac-1', { estado: 'EN_EJECUCION' })`

---

### Requirement: useCerrarAccionCorrectiva mutation hook
The system SHALL export a `useCerrarAccionCorrectiva` hook that accepts `ncId: string` as a parameter and returns a `UseMutationResult` wrapping `cerrarAccionCorrectiva(ncId, acId, data)` with mutation variables typed as `{ acId: string; data: CerrarACInput }`. On success: invalidates `QUERY_KEYS.nonconformities.detail(ncId)` and shows `toast.success(t('nonconformities:toasts.acCerrada'))`. On error: shows `toast.error(t('nonconformities:toasts.acCerrarError'))`.

#### Scenario: useCerrarAccionCorrectiva shows error toast when descripcionEvidencia is empty (400 from handler)
- **WHEN** the mutation rejects because `descripcionEvidencia` was empty
- **THEN** `toast.error` is called with `'nonconformities:toasts.acCerrarError'`

#### Scenario: useCerrarAccionCorrectiva invalidates NC detail on success
- **WHEN** the mutation resolves successfully
- **THEN** TanStack Query invalidates `QUERY_KEYS.nonconformities.detail(ncId)`

---

### Requirement: All hooks use t() for toast keys and no hardcoded Spanish strings
Every `toast.*` call in nc-query-hooks SHALL pass a `t('nonconformities:toasts.*')` key, not a hardcoded Spanish string. The key SHALL exist in the `nonconformities` i18n namespace declared in `es-PE.json` and `en-US.json`. Translation values are placeholder strings until M2-S03 fills them.

#### Scenario: Toast keys declared in nonconformities i18n namespace
- **WHEN** the i18n configuration loads `es-PE.json`
- **THEN** the `nonconformities.toasts` object contains keys for: `created`, `posibleDuplicado`, `createError`, `updated`, `updateError`, `anulada`, `anularError`, `acCreada`, `acCreateError`, `acUpdated`, `acUpdateError`, `acCerrada`, `acCerrarError`
