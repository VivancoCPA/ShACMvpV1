## MODIFIED Requirements

### Requirement: Locales MSW fixtures define two active locals with planoPngUrl and one inactive
The system SHALL define and export `localFixtures: Local[]` from `src/mocks/fixtures/locales.fixtures.ts` containing exactly 4 locales. Local #1 (`LOC-001`, `nombre: 'Almacén Principal'`, `activo: true`, `empresaId: 'empresa-001'`, `planoPngUrl: '/mock/plano-placeholder.png'`) and Local #2 (`LOC-002`, `nombre: 'Patio de Minerales'`, `activo: true`, `empresaId: 'empresa-001'`, `planoPngUrl: '/mock/plano-placeholder.png'`) SHALL be active. Local #3 (`LOC-003`, `nombre: 'Bodega Norte'`, `activo: false`, `empresaId: 'empresa-001'`, `planoPngUrl: undefined`) SHALL be inactive. A new Local #4 (`loc-e2-001`, `empresaId: 'empresa-002'`, `activo: false`, `planoPngUrl: '/mock/plano-placeholder.png'`) SHALL represent `empresa-002`'s site; it is seeded as **inactive** specifically to preserve the existing RN-LOC-001 active-locales count that `src/mocks/handlers/locales.handlers.test.ts` depends on across its sequential, non-reset test chain — that pre-existing suite hardcodes absolute active-locale counts (4, 5) built on a baseline of exactly 2 pre-existing active locals, and adding a third active local at the fixture level would shift every downstream assertion in that file. The file SHALL also export `zonaFixtures: Zona[]` with 7 zones: 3 belonging to `LOC-001`, 2 belonging to `LOC-002`, and 2 belonging to `loc-e2-001`, all with `activo: true` (zones are not subject to RN-LOC-001's active-locale cap). Every zone's `empresaId` SHALL equal the `empresaId` of its parent local.

#### Scenario: localFixtures has exactly 4 locals
- **WHEN** `localFixtures` is imported
- **THEN** the array has exactly 4 elements

#### Scenario: First two locals are active with planoPngUrl
- **WHEN** `localFixtures.filter(l => l.activo && l.empresaId === 'empresa-001')` is evaluated
- **THEN** the result has length 2, and both have `planoPngUrl: '/mock/plano-placeholder.png'`

#### Scenario: Third local is inactive with no planoPngUrl
- **WHEN** `localFixtures[2]` is accessed
- **THEN** `activo` is `false` and `planoPngUrl` is `undefined`

#### Scenario: zonaFixtures has 7 zones across 3 locals
- **WHEN** `zonaFixtures` is imported
- **THEN** the array has 7 elements: 3 with `localId` matching LOC-001, 2 with `localId` matching LOC-002, and 2 with `localId` matching `loc-e2-001`

#### Scenario: All pre-existing locales and zonas belong to empresa-001
- **WHEN** `localFixtures` and `zonaFixtures` are filtered to only the elements that existed before this change (identified by their pre-existing `id` values)
- **THEN** every one of them has `empresaId === 'empresa-001'`

#### Scenario: New empresa-002 local exists and is seeded inactive
- **WHEN** `localFixtures` is filtered by `empresaId === 'empresa-002'`
- **THEN** exactly 1 element is returned, with `activo === false` (its zones remain `activo: true` and visible via `GET /api/zonas`)

#### Scenario: Zona empresaId matches its parent Local's empresaId
- **WHEN** each element of `zonaFixtures` is checked against `localFixtures` by `localId`
- **THEN** the zone's `empresaId` equals the matching local's `empresaId`

---

### Requirement: Locales MSW handlers intercept GET /api/locales and GET /api/zonas
The system SHALL define and export `localesHandlers` from `src/mocks/handlers/locales.handlers.ts`. The handler for `GET /api/locales` SHALL accept an optional `activo` query param and filter `localFixtures` accordingly. The handler for `GET /api/zonas` SHALL accept an optional `localId` query param and filter `zonaFixtures` by `localId`. Both handlers SHALL apply `await delay(400)` and return `ApiResponse<Local[]>` / `ApiResponse<Zona[]>` with `success: true`. `localesHandlers` SHALL be added to the combined handlers array in `src/mocks/handlers/index.ts`. Neither handler SHALL filter by `empresaId` in this phase — that is Fase 3.

#### Scenario: GET /api/locales?activo=true returns only active locals
- **WHEN** a request `GET /api/locales?activo=true` is intercepted by MSW
- **THEN** the response body contains `data` with exactly 2 locals (both belonging to `empresa-001`; `empresa-002`'s local is seeded inactive)

#### Scenario: GET /api/locales without filter returns all locals
- **WHEN** a request `GET /api/locales` is intercepted without `activo` param
- **THEN** the response body contains `data` with all 4 locals, across both empresas

#### Scenario: GET /api/zonas?localId=LOC-001 returns only zones of that local
- **WHEN** a request `GET /api/zonas?localId=LOC-001` is intercepted
- **THEN** the response body contains `data` with exactly 3 zones belonging to `LOC-001`

#### Scenario: localesHandlers is registered in index.ts
- **WHEN** `src/mocks/handlers/index.ts` exports the combined handlers array
- **THEN** handlers from `localesHandlers` are included
