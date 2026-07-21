## ADDED Requirements

### Requirement: QEHeaderSection gates the export action by puedeExportarPDF
`QEHeaderSection`'s top row (the `flex flex-wrap items-center gap-2.5` row holding `numero` and the status/type/origin/severity badges) SHALL additionally render the "Exportar PDF" button described in `quality-event-pdf-export`, positioned after the badges, but only when `puedeExportarPDF(rol)` evaluates to `true` for the current authenticated user. This requirement defines placement and visibility gating; the click behavior and PDF generation are defined in `quality-event-pdf-export`.

#### Scenario: Export button appears after the badge row for an authorized role
- **WHEN** a `SUPERVISOR` user renders `QEHeaderSection` for a loaded QE
- **THEN** the "Exportar PDF" button renders within the same header row as `numero` and the badges, after them

#### Scenario: Export button is absent for a role without puedeExportarPDF
- **WHEN** a user with role `JEFE_CONTROL_DOCUMENTARIO` renders `QEHeaderSection`
- **THEN** no "Exportar PDF" button is rendered anywhere in the header
