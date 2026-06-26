# nc-msw-fixtures

## MODIFIED Requirements

### Requirement: Fixture dataset size and distribution
The system SHALL provide a `nonconformityFixtures` array exported from `src/mocks/fixtures/nonconformities.fixtures.ts` containing at least 18 NCs — expanded from the previous minimum of 8. The dataset SHALL satisfy all of the following distribution constraints simultaneously:
- At least 3 NCs with `severidad: 'CRITICA'`
- At least 2 NCs with `estado: 'ANULADA'`
- At least 3 NCs whose `accionesCorrectivas` array contains at least one AC with `estado: 'VENCIDA'`
- All 4 `NCDominio` values represented (CALIDAD, SST, ADUANERO, OPERACIONAL) with at least 3 NCs each
- All 7 `NCStatus` values represented (ABIERTA, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE, CERRADA, ANULADA)
- `fechaDeteccion` values distributed across the last 6 months relative to the fixture creation date, so that date-range filters produce non-empty result sets across different month windows

#### Scenario: Dataset has at least 18 fixtures
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** `nonconformityFixtures.length` is greater than or equal to 18

#### Scenario: At least 3 CRITICA NCs exist
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** filtering by `severidad === 'CRITICA'` returns at least 3 NCs

#### Scenario: At least 2 ANULADA NCs exist
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** filtering by `estado === 'ANULADA'` returns at least 2 NCs

#### Scenario: At least 3 NCs have overdue ACs
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** filtering NCs where `accionesCorrectivas.some(ac => ac.estado === 'VENCIDA')` returns at least 3 NCs

#### Scenario: pageSize 5 produces at least 4 pages
- **WHEN** a consumer paginates the full unfiltered fixture dataset with `pageSize: 5`
- **THEN** there are at least 4 pages (ceiling of 18 / 5 = 4 pages), making the sliding pagination window visible from the first render

#### Scenario: Date range filter on last 3 months returns a non-empty subset
- **WHEN** the MSW handler filters fixtures by `fechaDesde` = 3 months ago and `fechaHasta` = today
- **THEN** at least 5 NCs match (fixtures have dates spread across the last 6 months, not all clustered at one date)

#### Scenario: All 7 NCStatus values are represented
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** filtering by each of `ABIERTA`, `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, `EN_EJECUCION`, `PENDIENTE_CIERRE`, `CERRADA`, `ANULADA` returns at least one NC
