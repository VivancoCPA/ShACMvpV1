## ADDED Requirements

### Requirement: QEAuditTrail renders the three plazo-adjustment accion types
`QEAuditTrail` SHALL recognize three additional `accion` values produced by the AC deadline-extension flow (`ac-plazo-extension`): `AC_AJUSTE_PLAZO_SOLICITADO`, `AC_AJUSTE_PLAZO_APROBADO`, and `AC_AJUSTE_PLAZO_RECHAZADO`. Each SHALL render with a distinct `lucide-react` icon (consistent with the existing per-`accion` icon-selection pattern) and a human-readable description: `AC_AJUSTE_PLAZO_SOLICITADO` describes who requested and the proposed new date; `AC_AJUSTE_PLAZO_APROBADO` describes the approved new `plazoFecha`; `AC_AJUSTE_PLAZO_RECHAZADO` includes the `comentarioRevision`.

#### Scenario: AC_AJUSTE_PLAZO_SOLICITADO entry shows requester and proposed date
- **WHEN** `QEAuditTrail` renders an entry with `accion: 'AC_AJUSTE_PLAZO_SOLICITADO'`, `realizadoPorNombre: 'Ana Torres'`, `valorNuevo: '2026-08-15'`
- **THEN** the rendered description includes both the requester's name and the proposed date

#### Scenario: AC_AJUSTE_PLAZO_APROBADO entry shows the approved date
- **WHEN** `QEAuditTrail` renders an entry with `accion: 'AC_AJUSTE_PLAZO_APROBADO'`, `valorAnterior: '2026-08-01'`, `valorNuevo: '2026-08-15'`
- **THEN** the rendered description shows the plazo change from `2026-08-01` to `2026-08-15`

#### Scenario: AC_AJUSTE_PLAZO_RECHAZADO entry shows the rejection comment
- **WHEN** `QEAuditTrail` renders an entry with `accion: 'AC_AJUSTE_PLAZO_RECHAZADO'`, `campoModificado: 'comentarioRevision'`, `valorNuevo: 'Justificación insuficiente'`
- **THEN** the rendered description includes the rejection comment

#### Scenario: Each plazo-adjustment accion type uses a distinct icon
- **WHEN** `QEAuditTrail` renders one entry of each of `AC_AJUSTE_PLAZO_SOLICITADO`, `AC_AJUSTE_PLAZO_APROBADO`, and `AC_AJUSTE_PLAZO_RECHAZADO`
- **THEN** each entry displays a different icon from the other two
