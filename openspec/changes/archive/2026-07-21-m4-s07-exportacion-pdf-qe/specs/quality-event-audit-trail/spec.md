## ADDED Requirements

### Requirement: QEAuditTrail renders the EXPORTACION_PDF accion type
`QEAuditTrail` SHALL recognize the `accion` value `EXPORTACION_PDF`, produced by the export-pdf MSW endpoint (`quality-event-msw-handlers`) whenever a QE is exported individually or as part of a batch. It SHALL render with a distinct `lucide-react` icon (consistent with the existing per-`accion` icon-selection pattern, distinct from all other recognized `accion` icons) and a human-readable description built from `realizadoPorNombre` (e.g. "PDF exportado por Ana Torres").

#### Scenario: EXPORTACION_PDF entry shows who exported
- **WHEN** `QEAuditTrail` renders an entry with `accion: 'EXPORTACION_PDF'`, `realizadoPorNombre: 'Ana Torres'`
- **THEN** the rendered description includes "Ana Torres"

#### Scenario: EXPORTACION_PDF uses a distinct icon from other accion types
- **WHEN** `QEAuditTrail` renders one entry each of `EXPORTACION_PDF`, `'CREADO'`, and `'ESTADO_CAMBIADO'`
- **THEN** the `EXPORTACION_PDF` entry displays an icon different from the other two

#### Scenario: generadoPorIA is always false for EXPORTACION_PDF entries
- **WHEN** the export-pdf endpoint appends an `EXPORTACION_PDF` audit entry
- **THEN** the entry's `generadoPorIA` field is `false`, and no "Generado por IA" badge renders on it
