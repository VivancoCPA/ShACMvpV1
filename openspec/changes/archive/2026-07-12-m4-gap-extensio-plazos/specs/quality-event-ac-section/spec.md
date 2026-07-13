## MODIFIED Requirements

### Requirement: AccionCorrectivaQE is owned by the Quality Event (Modelo B)
The system SHALL type `AccionCorrectivaQE` in `src/features/quality-events/types/qualityEvent.types.ts` with `qeId: string` as the primary reference (the QE that owns the AC) and the following fields, matching the shape already used by `AccionCorrectiva` (M2) and `AccionCorrectivaIncidente` (M3): `id`, `titulo?`, `descripcion`, `responsableId`, `responsableNombre`, `plazoFecha`, `prioridad?` (`'BAJA'|'MEDIA'|'ALTA'|'CRITICA'`), `estado` (`'PENDIENTE'|'EN_EJECUCION'|'CERRADA'`), `creadoEn`, `actualizadoEn`, `descripcionEvidencia?`, `evidenciaUrl?`, `fechaCierre?`, `solicitudesAjustePlazo: SolicitudAjustePlazoAC[]`.

#### Scenario: AccionCorrectivaQE requires qeId
- **WHEN** a developer constructs an `AccionCorrectivaQE` without `qeId`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectivaQE accepts absence of prioridad and evidence fields
- **WHEN** a developer constructs an `AccionCorrectivaQE` with `prioridad`, `descripcionEvidencia`, and `evidenciaUrl` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: AccionCorrectivaQE requires solicitudesAjustePlazo as an array
- **WHEN** a developer constructs an `AccionCorrectivaQE` without `solicitudesAjustePlazo`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: A new AccionCorrectivaQE defaults solicitudesAjustePlazo to an empty array
- **WHEN** an AC is created via `POST /api/quality-events/:id/acciones-correctivas` (see `quality-event-ac-section`'s creation requirement)
- **THEN** the returned AC has `solicitudesAjustePlazo: []`
