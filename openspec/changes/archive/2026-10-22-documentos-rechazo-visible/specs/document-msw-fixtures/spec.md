## ADDED Requirements

### Requirement: Fixture rejection and cancellation entries use the dedicated actions
Any fixture audit trail entry that represents a historical rejection or cancellation (an entry that previously used `accion: 'ESTADO_CAMBIADO'` with `estadoAnterior` in `EN_REVISION`/`EN_APROBACION` and `estadoNuevo: 'BORRADOR'`) SHALL use the matching action instead: `RECHAZADO_EN_REVISION` or `RECHAZADO_EN_APROBACION` with a `motivo` string, or `REVISION_CANCELADA` with no `motivo`. Fixtures that only ever moved forward (e.g. `BORRADOR → EN_REVISION`, `EN_REVISION → EN_APROBACION`, `_ → PUBLICADO`, `PUBLICADO → OBSOLETO`) are unaffected and keep `accion: 'ESTADO_CAMBIADO'`.

#### Scenario: Fixture rejection entries use the new actions
- **WHEN** a document fixture's audit trail represents a past rejection (an entry moving the document back from `EN_REVISION` or `EN_APROBACION` to `BORRADOR` with a reason)
- **THEN** that entry uses `accion: 'RECHAZADO_EN_REVISION'` or `'RECHAZADO_EN_APROBACION'` (matching the prior estado) with a non-empty `motivo`, not `accion: 'ESTADO_CAMBIADO'`

#### Scenario: Forward transitions are untouched
- **WHEN** a document fixture's audit trail entry represents `BORRADOR → EN_REVISION`, `EN_REVISION → EN_APROBACION`, a transition to `PUBLICADO`, or `PUBLICADO → OBSOLETO`
- **THEN** that entry keeps `accion: 'ESTADO_CAMBIADO'` unchanged
