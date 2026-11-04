## ADDED Requirements

### Requirement: QEAuditTrail renders the ASISTENTE_IA_CONSULTADO accion type
`QEAuditTrail` SHALL recognize the `accion` value `ASISTENTE_IA_CONSULTADO` and render it with:
- the label `t('qualityEvents:detail.auditTrail.acciones.ASISTENTE_IA_CONSULTADO')` ("Consulta al asistente IA");
- a `Sparkles` icon;
- the "Generado por IA" badge, since the entry carries `generadoPorIA: true`.

When a `CAMPO_EDITADO` entry's `valorNuevo` ends with the server suffix "(sugerencia IA editada)", its description SHALL append `t('qualityEvents:detail.auditTrail.sugerenciaIAEditada')`, so the timeline distinguishes an AI suggestion the user edited from a value typed by hand.

#### Scenario: Consultation entry
- **WHEN** `QEAuditTrail` renders an entry with `accion: 'ASISTENTE_IA_CONSULTADO'`, `generadoPorIA: true`
- **THEN** it shows "Consulta al asistente IA" and the "Generado por IA" badge

#### Scenario: Edited AI suggestion
- **WHEN** `QEAuditTrail` renders a `CAMPO_EDITADO` entry whose `valorNuevo` ends with "(sugerencia IA editada)"
- **THEN** the description includes "sugerencia IA editada"
