# nonconformity-types

## MODIFIED Requirements

### Requirement: NCStatus union type
The system SHALL define `NCStatus` as a TypeScript string literal union covering all valid non-conformity lifecycle states: `ABIERTA | EN_INVESTIGACION | ANALISIS_COMPLETADO | EN_EJECUCION | PENDIENTE_CIERRE | CERRADA | ANULADA`.

#### Scenario: NCStatus covers all 7 M2 lifecycle states
- **WHEN** a developer imports `NCStatus` from `src/features/nonconformities/types/nonconformity.types.ts`
- **THEN** the union includes exactly the seven values: `ABIERTA`, `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, `EN_EJECUCION`, `PENDIENTE_CIERRE`, `CERRADA`, `ANULADA` and TypeScript rejects any other string

#### Scenario: Previous M2-S01 NCStatus values are no longer valid
- **WHEN** a developer assigns `'DETECTADA'` or `'EN_CORRECCION'` or `'REABIERTA'` as an `NCStatus` value
- **THEN** TypeScript emits a compile error because those literals are not members of the updated union

---

### Requirement: NCSeveridad union type
The system SHALL define `NCSeveridad` as a TypeScript string literal union with 4 levels: `BAJA | MEDIA | ALTA | CRITICA`, aligning with the SHAC severity scale used in Quality Events (`QESeverity`) and the shared `SeverityBadge` component.

#### Scenario: NCSeveridad covers 4 SHAC severity levels
- **WHEN** a developer imports `NCSeveridad` from `src/features/nonconformities/types/nonconformity.types.ts`
- **THEN** the union includes exactly the four values: `BAJA`, `MEDIA`, `ALTA`, `CRITICA` and TypeScript rejects any other string

#### Scenario: Previous M2-S01 NCSeveridad values are no longer valid
- **WHEN** a developer assigns `'MENOR'` or `'MAYOR'` as an `NCSeveridad` value
- **THEN** TypeScript emits a compile error because those literals are not members of the updated union

---

### Requirement: NCFilters interface includes dominio field
The system SHALL update the `NCFilters` interface to include an optional `dominio?: NCDominio` field in addition to the existing optional fields (`estado`, `tipo`, `severidad`, `origen`, `areaAfectada`, `reportadoPorId`, `search`, `page`, `pageSize`). The `fechaDesde` and `fechaHasta` fields (both `string?` in ISO date format) SHALL also be added.

#### Scenario: NCFilters accepts dominio as an optional field
- **WHEN** a developer passes `{ dominio: 'SST' }` as `NCFilters`
- **THEN** TypeScript accepts it without casting

#### Scenario: NCFilters accepts fechaDesde and fechaHasta as optional fields
- **WHEN** a developer passes `{ fechaDesde: '2025-01-01', fechaHasta: '2025-06-30' }` as `NCFilters`
- **THEN** TypeScript accepts it without casting

#### Scenario: NCFilters with no fields is still valid
- **WHEN** a developer passes an empty object `{}` as `NCFilters`
- **THEN** TypeScript accepts it without error
