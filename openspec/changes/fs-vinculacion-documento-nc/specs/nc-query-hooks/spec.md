## MODIFIED Requirements

### Requirement: useNonconformities hook for paginated list
The system SHALL export a `useNonconformities` hook with signature `(filters?: NCFilters, enabled?: boolean) => UseQueryResult<ApiResponse<NoConformidad[]>>` that calls `getNonconformities(filters)` via `useQuery` keyed by `QUERY_KEYS.nonconformities.list(filters ?? {})`. The query SHALL use a `staleTime` of 5 minutes. The `enabled` parameter SHALL default to `true` and be passed through to `useQuery`'s own `enabled` option, allowing a caller (such as `DocumentoNCCombobox`) to defer the fetch until a search should actually run — same pattern as `useDocuments(filters, enabled)`.

#### Scenario: useNonconformities returns data from getNonconformities
- **WHEN** a component calls `useNonconformities({ dominio: 'SST' })`
- **THEN** the hook fetches from `GET /api/nonconformities?dominio=SST` and exposes the paginated NC list via `data.data`

#### Scenario: useNonconformities re-fetches when filters change
- **WHEN** the `filters` argument changes from `{ dominio: 'SST' }` to `{ dominio: 'CALIDAD' }`
- **THEN** TanStack Query treats the new key as distinct and issues a new network request

#### Scenario: useNonconformities does not fetch when enabled is false
- **WHEN** a component calls `useNonconformities({ search: 'abc' }, false)`
- **THEN** the hook does not issue a network request until `enabled` becomes `true`

## ADDED Requirements

### Requirement: useVincularDocumento mutation hook
The system SHALL export a `useVincularDocumento(noConformidadId: string)` hook that wraps `vincularDocumento` in a `useMutation`, invalidating `QUERY_KEYS.nonconformities.detail(noConformidadId)` on success, and showing a Sonner error toast on failure (no success toast — linking is a lightweight, immediately-visible action, same criterion as `useVincularQE`/`useVincularDocumento` on the QE side).

#### Scenario: Successful link invalidates the NC detail query
- **WHEN** `useVincularDocumento('nc-2026-001').mutate('doc-001')` resolves successfully
- **THEN** the query for `QUERY_KEYS.nonconformities.detail('nc-2026-001')` is invalidated and refetches

### Requirement: useDesvincularDocumento mutation hook
The system SHALL export a `useDesvincularDocumento(noConformidadId: string)` hook that wraps `desvincularDocumento` in a `useMutation`, invalidating `QUERY_KEYS.nonconformities.detail(noConformidadId)` on success, and showing a Sonner error toast on failure.

#### Scenario: Successful unlink invalidates the NC detail query
- **WHEN** `useDesvincularDocumento('nc-2026-001').mutate('doc-001')` resolves successfully
- **THEN** the query for `QUERY_KEYS.nonconformities.detail('nc-2026-001')` is invalidated and refetches
