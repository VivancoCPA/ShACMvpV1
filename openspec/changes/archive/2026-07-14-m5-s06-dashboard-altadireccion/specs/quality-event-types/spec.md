## MODIFIED Requirements

### Requirement: AccionCorrectivaQE stub interface
The system SHALL define an `AccionCorrectivaQE` interface in `src/features/quality-events/types/qualityEvent.types.ts` with the following fields: `id` (string), `qeId` (string), `titulo` (string or undefined), `descripcion` (string), `responsableId` (string), `responsableNombre` (string), `plazoFecha` (ISO 8601 date string), `prioridad` (`'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'` or undefined), `estado` (`'PENDIENTE' | 'EN_EJECUCION' | 'CERRADA'`), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string), `descripcionEvidencia` (string or undefined), `evidenciaUrl` (string or undefined), `fechaCierre` (ISO 8601 string or undefined), `solicitudAjustePlazo` (`SolicitudAjustePlazoAC` or undefined).

The system SHALL define a `SolicitudAjustePlazoAC` interface with the fields `fechaSolicitada` (ISO 8601 date string, the newly requested deadline), `justificacion` (string), `estado` (`'PENDIENTE' | 'APROBADA' | 'RECHAZADA'`), `solicitadoPorId` (string), `solicitadoEn` (ISO 8601 string). This is a read-only projection of a plazo-extension request: the interface does NOT include an approver field, a threshold-validation field, or any mutation endpoint — the approval workflow (written justification + 50% threshold validation, per QE-AC-007) remains an unimplemented M4 gap.

#### Scenario: AccionCorrectivaQE requires all mandatory fields
- **WHEN** a developer constructs an `AccionCorrectivaQE` without `plazoFecha`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectivaQE accepts absence of evidencia fields
- **WHEN** a developer constructs an `AccionCorrectivaQE` with `descripcionEvidencia`, `evidenciaUrl` and `fechaCierre` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: solicitudAjustePlazo is optional and absent by default
- **WHEN** a developer constructs an `AccionCorrectivaQE` without `solicitudAjustePlazo`
- **THEN** TypeScript accepts the object without error, and no plazo-extension request is implied

#### Scenario: solicitudAjustePlazo with estado PENDIENTE marks it as awaiting approval
- **WHEN** an `AccionCorrectivaQE` has `solicitudAjustePlazo.estado === 'PENDIENTE'`
- **THEN** the type does not expose any field to record who approved/rejected it or a threshold-validation result — only the request itself
