## ADDED Requirements

### Requirement: QEOriginBadge renders the 4 QE origins as icon+label pill
The system SHALL export a `QEOriginBadge` component from `src/features/quality-events/components/QEOriginBadge.tsx` that accepts an `origin: QEOrigin` prop and renders a compact pill containing a Lucide icon and a short text label. The icon+label mapping SHALL be: `O1_INCIDENTE_CAMPO` → `AlertTriangle` icon + label from `QE_ORIGIN_LABELS['O1_INCIDENTE_CAMPO']` (displayed as `'Campo'` compact label), `O2_NC_DETECTADA` → `ClipboardX` icon + `'NC'`, `O3_HALLAZGO_AUDITORIA` → `Search` icon + `'Auditoría'`, `O4_REPORTE_EXTERNO` → `Mail` icon + `'Externo'`. The icon SHALL have `aria-hidden="true"` and the component SHALL accept an optional `className` prop.

#### Scenario: O1_INCIDENTE_CAMPO renders AlertTriangle icon
- **WHEN** `<QEOriginBadge origin="O1_INCIDENTE_CAMPO" />` is rendered
- **THEN** an `AlertTriangle` icon and a label containing `'Campo'` are visible in the output

#### Scenario: O2_NC_DETECTADA renders ClipboardX icon
- **WHEN** `<QEOriginBadge origin="O2_NC_DETECTADA" />` is rendered
- **THEN** a `ClipboardX` icon and the label `'NC'` are visible in the output

#### Scenario: O3_HALLAZGO_AUDITORIA renders Search icon
- **WHEN** `<QEOriginBadge origin="O3_HALLAZGO_AUDITORIA" />` is rendered
- **THEN** a `Search` icon and the label `'Auditoría'` are visible in the output

#### Scenario: O4_REPORTE_EXTERNO renders Mail icon
- **WHEN** `<QEOriginBadge origin="O4_REPORTE_EXTERNO" />` is rendered
- **THEN** a `Mail` icon and the label `'Externo'` are visible in the output

#### Scenario: Icon is hidden from assistive technology
- **WHEN** `QEOriginBadge` renders any origin value
- **THEN** the icon element has `aria-hidden="true"` so screen readers skip it
