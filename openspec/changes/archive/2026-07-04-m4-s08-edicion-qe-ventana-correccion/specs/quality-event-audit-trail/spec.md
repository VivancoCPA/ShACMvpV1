## ADDED Requirements

### Requirement: QEAuditTrail renders the three edit-related accion types
`QEAuditTrail` SHALL recognize three additional `accion` values produced by the RN-QE-010/011/012 edit endpoints: `QE_REPORTE_INICIAL_EDITADO`, `QE_SEVERIDAD_EDITADA`, and `QE_MINERAL_EDITADO`. Each SHALL render with a distinct `lucide-react` icon (consistent with the existing per-`accion` icon-selection pattern) and a human-readable description built from `campoModificado`, `valorAnterior`, and `valorNuevo` (e.g. "Área afectada: Almacén Norte → Almacén Sur").

#### Scenario: QE_REPORTE_INICIAL_EDITADO entry shows the field diff
- **WHEN** `QEAuditTrail` renders an entry with `accion: 'QE_REPORTE_INICIAL_EDITADO'`, `campoModificado: 'areaAfectada'`, `valorAnterior: 'Almacén Norte'`, `valorNuevo: 'Almacén Sur'`
- **THEN** the rendered description includes both the prior and new values

#### Scenario: QE_SEVERIDAD_EDITADA entry shows severity diff
- **WHEN** `QEAuditTrail` renders an entry with `accion: 'QE_SEVERIDAD_EDITADA'`, `valorAnterior: 'MEDIA'`, `valorNuevo: 'CRITICA'`
- **THEN** the rendered description shows the severity change from `MEDIA` to `CRITICA`

#### Scenario: QE_MINERAL_EDITADO entry shows mineral diff
- **WHEN** `QEAuditTrail` renders an entry with `accion: 'QE_MINERAL_EDITADO'`, `valorAnterior: 'Cobre'`, `valorNuevo: 'Zinc'`
- **THEN** the rendered description shows the mineral change from `Cobre` to `Zinc`

#### Scenario: Each edit accion type uses a distinct icon
- **WHEN** `QEAuditTrail` renders one entry of each of `QE_REPORTE_INICIAL_EDITADO`, `QE_SEVERIDAD_EDITADA`, and `QE_MINERAL_EDITADO`
- **THEN** each entry displays a different icon from the other two
