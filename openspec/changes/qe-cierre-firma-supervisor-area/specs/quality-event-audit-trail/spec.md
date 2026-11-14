## ADDED Requirements

### Requirement: QEAuditTrail renders the closure signature and rejection accion types
`QEAuditTrail` SHALL recognize the `accion` values `FIRMA_CIERRE_JEFE_CALIDAD` (`t('qualityEvents:detail.auditTrail.acciones.FIRMA_CIERRE_JEFE_CALIDAD')`, "Firma de cierre — Jefe de Calidad"), `FIRMA_CIERRE_SUPERVISOR` ("Firma de cierre — Supervisor") and `CIERRE_RECHAZADO` ("Cierre rechazado"). `CIERRE_RECHAZADO` SHALL show the motivo (`valorNuevo`) in its description. Legacy `FIRMA_REGISTRADA` entries SHALL keep rendering as before.

#### Scenario: Signature entries show their label
- **WHEN** `QEAuditTrail` renders entries with `accion: 'FIRMA_CIERRE_JEFE_CALIDAD'` and `accion: 'FIRMA_CIERRE_SUPERVISOR'`
- **THEN** they show "Firma de cierre — Jefe de Calidad" and "Firma de cierre — Supervisor"

#### Scenario: Rejection entry shows the motivo
- **WHEN** `QEAuditTrail` renders an entry with `accion: 'CIERRE_RECHAZADO'`, `valorNuevo: 'Falta evidencia de la AC 2 en campo'`
- **THEN** it shows "Cierre rechazado" and the motivo
