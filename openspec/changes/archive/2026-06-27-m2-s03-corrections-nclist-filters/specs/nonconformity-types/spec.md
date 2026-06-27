## MODIFIED Requirements

### Requirement: NCDominio union type
The system SHALL define `NCDominio` as a TypeScript string literal union covering the five organizational business areas: `'CALIDAD' | 'SST' | 'ADUANERO' | 'OPERACIONAL' | 'PROVEEDOR'`. The `'PROVEEDOR'` value represents Proveedor/Contratista non-conformities and determines the `NC-PRV` prefix in the NC number. This determines the `numero` prefix (NC-CAL, NC-SST, NC-ADU, NC-OPE, NC-PRV).

#### Scenario: NCDominio has exactly five values including PROVEEDOR
- **WHEN** a developer assigns a `NCDominio` value
- **THEN** TypeScript accepts only `'CALIDAD'`, `'SST'`, `'ADUANERO'`, `'OPERACIONAL'`, or `'PROVEEDOR'` and rejects any other string

#### Scenario: NCDominio PROVEEDOR maps to NC-PRV prefix
- **WHEN** a developer reads `noConformidad.numero` on a PROVEEDOR non-conformity
- **THEN** the value matches the pattern `NC-PRV-YYYY-NNN` (e.g., `'NC-PRV-2025-001'`)

#### Scenario: NCDominio is orthogonal to NCTipo
- **WHEN** a developer constructs a `NoConformidad` with `dominio='PROVEEDOR'` and `tipo='SERVICIO'`
- **THEN** TypeScript accepts the combination without error, since both fields are independent

## ADDED Requirements

### Requirement: NoConformidad includes optional fechaCierre field
The system SHALL add a `fechaCierre?: string` optional field to the `NoConformidad` interface in `src/features/nonconformities/types/nonconformity.types.ts`. This field represents the expected closing deadline of the non-conformity (ISO 8601 date string), set by the supervisor when creating or updating the NC. It is distinct from `AccionCorrectiva.fechaCierre` (which is the actual close date of a corrective action). The field SHALL be optional to support NCs that have not yet had a closing deadline assigned.

#### Scenario: NoConformidad accepts fechaCierre as undefined
- **WHEN** a developer constructs a `NoConformidad` without `fechaCierre`
- **THEN** TypeScript accepts the object without error

#### Scenario: NoConformidad accepts a valid ISO date string as fechaCierre
- **WHEN** a developer constructs a `NoConformidad` with `fechaCierre: '2026-03-15'`
- **THEN** TypeScript accepts the value without error

#### Scenario: fechaCierre is typed as string or undefined
- **WHEN** a developer reads `noConformidad.fechaCierre`
- **THEN** TypeScript infers the type as `string | undefined`, not `string`
