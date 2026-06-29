# Spec: incident-locales

## Purpose

Define el hook `useLocales()`, el cliente API para locales, y los artefactos MSW (fixtures y handlers) necesarios para el catálogo de `Local` y `Zona` del módulo M3. Los tipos `Local` y `Zona` ya están definidos en `incident-types`; esta spec cubre la capa de datos de desarrollo (MSW) y el hook de consulta.

---

## ADDED Requirements

### Requirement: useLocales hook retorna locales activos con TanStack Query
The system SHALL export `useLocales` from `src/features/incidents/hooks/useLocales.ts`. It SHALL call `GET /api/locales` via the `localesApi.getLocales({ activo: true })` function and delegate to `useQuery`. The query key SHALL be `['locales', 'list', { activo: true }]`. The hook SHALL return `{ locales: Local[], isLoading: boolean, isError: boolean }` where `locales` defaults to `[]` when data is undefined. No UI logic or JSX SHALL appear in this hook.

#### Scenario: useLocales returns only active locals
- **WHEN** `useLocales()` is called and the MSW handler responds with 2 active and 1 inactive local
- **THEN** the returned `locales` array has length 2, containing only the active locals

#### Scenario: useLocales returns empty array while loading
- **WHEN** `useLocales()` is called and the query is pending
- **THEN** `locales` is `[]` and `isLoading` is `true`

#### Scenario: useLocales returns isError true on network failure
- **WHEN** the `/api/locales` request fails
- **THEN** `isError` is `true`

---

### Requirement: localesApi client provides getLocales function
The system SHALL define a `localesApi` object in `src/api/endpoints/locales.api.ts` with a `getLocales(params: { activo?: boolean }): Promise<ApiResponse<Local[]>>` function that calls `api.get('/api/locales', { params })` using the shared Axios instance from `src/lib/axios.ts`.

#### Scenario: getLocales sends activo param to the endpoint
- **WHEN** `localesApi.getLocales({ activo: true })` is called
- **THEN** the HTTP request is `GET /api/locales?activo=true`

---

### Requirement: Locales MSW fixtures define two active locals with planoPngUrl and one inactive
The system SHALL define and export `localFixtures: Local[]` from `src/mocks/fixtures/locales.fixtures.ts` containing exactly 3 locales. Local #1 (`LOC-001`, `nombre: 'Almacén Principal'`, `activo: true`, `planoPngUrl: '/mock/plano-placeholder.png'`) and Local #2 (`LOC-002`, `nombre: 'Patio de Minerales'`, `activo: true`, `planoPngUrl: '/mock/plano-placeholder.png'`) SHALL be active. Local #3 (`LOC-003`, `nombre: 'Bodega Norte'`, `activo: false`, `planoPngUrl: undefined`) SHALL be inactive. The file SHALL also export `zonaFixtures: Zona[]` with 5 zones: 3 belonging to `LOC-001` and 2 belonging to `LOC-002`, all with `activo: true`.

#### Scenario: localFixtures has exactly 3 locals
- **WHEN** `localFixtures` is imported
- **THEN** the array has exactly 3 elements

#### Scenario: First two locals are active with planoPngUrl
- **WHEN** `localFixtures.filter(l => l.activo)` is evaluated
- **THEN** the result has length 2, and both have `planoPngUrl: '/mock/plano-placeholder.png'`

#### Scenario: Third local is inactive with no planoPngUrl
- **WHEN** `localFixtures[2]` is accessed
- **THEN** `activo` is `false` and `planoPngUrl` is `undefined`

#### Scenario: zonaFixtures has 5 zones across 2 locals
- **WHEN** `zonaFixtures` is imported
- **THEN** the array has 5 elements: 3 with `localId` matching LOC-001 and 2 with `localId` matching LOC-002

---

### Requirement: Locales MSW handlers intercept GET /api/locales and GET /api/zonas
The system SHALL define and export `localesHandlers` from `src/mocks/handlers/locales.handlers.ts`. The handler for `GET /api/locales` SHALL accept an optional `activo` query param and filter `localFixtures` accordingly. The handler for `GET /api/zonas` SHALL accept an optional `localId` query param and filter `zonaFixtures` by `localId`. Both handlers SHALL apply `await delay(400)` and return `ApiResponse<Local[]>` / `ApiResponse<Zona[]>` with `success: true`. `localesHandlers` SHALL be added to the combined handlers array in `src/mocks/handlers/index.ts`.

#### Scenario: GET /api/locales?activo=true returns only active locals
- **WHEN** a request `GET /api/locales?activo=true` is intercepted by MSW
- **THEN** the response body contains `data` with exactly 2 locals (both active)

#### Scenario: GET /api/locales without filter returns all locals
- **WHEN** a request `GET /api/locales` is intercepted without `activo` param
- **THEN** the response body contains `data` with all 3 locals

#### Scenario: GET /api/zonas?localId=LOC-001 returns only zones of that local
- **WHEN** a request `GET /api/zonas?localId=LOC-001` is intercepted
- **THEN** the response body contains `data` with exactly 3 zones belonging to `LOC-001`

#### Scenario: localesHandlers is registered in index.ts
- **WHEN** `src/mocks/handlers/index.ts` exports the combined handlers array
- **THEN** handlers from `localesHandlers` are included
