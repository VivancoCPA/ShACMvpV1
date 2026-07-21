# Spec: quality-event-audit-trail

## Purpose

Reverse-chronological audit trail timeline for the Quality Event detail page, backed by a dedicated MSW sub-resource endpoint and fixture coverage of at least 4 entries per QE.

---

## Requirements

### Requirement: GET /api/quality-events/:id/audit-trail endpoint
The system SHALL register a `GET /api/quality-events/:id/audit-trail` handler in `src/mocks/handlers/quality-events.handlers.ts` that returns the matching QE's `auditTrail` array (`QEAuditTrailEntry[]`) sorted by `timestamp` descending (most recent first). An unknown `:id` SHALL return 404 with `success: false`.

#### Scenario: Known id returns audit trail sorted descending
- **WHEN** `GET /api/quality-events/qe-2026-005/audit-trail` is requested for a QE with 4 audit entries
- **THEN** the response is 200 with `data` being an array of 4 entries ordered from most recent `timestamp` to oldest

#### Scenario: Unknown id returns 404
- **WHEN** `GET /api/quality-events/does-not-exist/audit-trail` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: QEAuditTrail renders the timeline in reverse chronological order
The system SHALL render a `QEAuditTrail` component at `src/features/quality-events/components/QEAuditTrail.tsx` that fetches `GET /api/quality-events/:id/audit-trail` and renders one entry per item, most recent first. Each entry SHALL show: an icon (from `lucide-react`) chosen by `accion` type, `realizadoPorNombre`, a human-readable description of the action, and the `timestamp` formatted as `dd/mm/yyyy HH:mm` via `Intl.DateTimeFormat`.

#### Scenario: Entries render most recent first
- **WHEN** `QEAuditTrail` receives entries with timestamps `2026-05-01`, `2026-05-03`, `2026-05-02`
- **THEN** they render in the order `2026-05-03`, `2026-05-02`, `2026-05-01`

#### Scenario: Entry shows formatted timestamp
- **WHEN** an entry has `timestamp: '2026-05-03T14:30:00Z'`
- **THEN** the rendered timestamp matches the `dd/mm/yyyy HH:mm` pattern

---

### Requirement: QEAuditTrail shows a Generado por IA badge
Each timeline entry with `generadoPorIA: true` SHALL display a "Generado por IA" badge; entries with `generadoPorIA: false` SHALL NOT display it.

#### Scenario: IA badge shown for AI-generated entries
- **WHEN** an audit entry has `generadoPorIA: true`
- **THEN** a "Generado por IA" badge is visible on that entry

#### Scenario: IA badge hidden for manual entries
- **WHEN** an audit entry has `generadoPorIA: false`
- **THEN** no "Generado por IA" badge is rendered on that entry

---

### Requirement: Fixture QEs carry at least 4 audit trail entries
The system SHALL ensure every fixture in `qualityEventFixtures` has at least 4 entries in `auditTrail`, covering at minimum: creation, a state change, a field edit, and causa raíz approval (for QEs that have progressed past `EN_INVESTIGACION`).

#### Scenario: Fixture QE has at least 4 audit entries
- **WHEN** any fixture QE's `auditTrail` is inspected
- **THEN** `auditTrail.length >= 4`

---

### Requirement: QEAuditTrail renders the three edit-related accion types
`QEAuditTrail` SHALL recognize three additional `accion` values produced by the RN-QE-014/015/016 edit endpoints: `QE_REPORTE_INICIAL_EDITADO`, `QE_SEVERIDAD_EDITADA`, and `QE_MINERAL_EDITADO`. Each SHALL render with a distinct `lucide-react` icon (consistent with the existing per-`accion` icon-selection pattern) and a human-readable description built from `campoModificado`, `valorAnterior`, and `valorNuevo` (e.g. "Área afectada: Almacén Norte → Almacén Sur").

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

---

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

---

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
