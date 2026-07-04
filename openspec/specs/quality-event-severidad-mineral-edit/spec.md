# Spec: quality-event-severidad-mineral-edit

## Purpose

Reduced edit flow for `JEFE_CALIDAD_SYST` users who satisfy RN-QE-011 (severidad) and/or RN-QE-012 (mineral) but not RN-QE-010 (reporte inicial). Defines the `QEEditSeveridadMineralModal` component opened inline from `QEList`, allowing severidad and/or mineralInvolucrado edits without navigating to the full `QualityEventForm`.

---

## Requirements

### Requirement: QEEditSeveridadMineralModal renders the reduced JEFE_CALIDAD_SYST edit flow
The system SHALL render a `QEEditSeveridadMineralModal` component at `src/features/quality-events/components/QEEditSeveridadMineralModal.tsx`, opened from `QualityEventList`'s Acciones column when `resolveQEEditAccess(qe, usuario)` returns `reporteInicial: false` and at least one of `severidad`/`mineral` is `true` (RN-QE-011/RN-QE-012, `quality-event-permissions`). The modal SHALL render a `severidad` select (populated from `QE_SEVERITY_LABELS`, defaulting to `qe.severidad`) only when `access.severidad` is `true`, and a `mineralInvolucrado` select (defaulting to `qe.mineralInvolucrado`) only when `access.mineral` is `true`. The modal SHALL NOT render `descripcion`, `areaAfectada`, `turno`, or `fechaHoraEvento`.

#### Scenario: Modal shows only severidad when access.mineral is false
- **WHEN** `QEEditSeveridadMineralModal` opens with `access: { reporteInicial: false, severidad: true, mineral: false }`
- **THEN** only the `severidad` select is rendered; no `mineralInvolucrado` select appears

#### Scenario: Modal shows only mineral when access.severidad is false
- **WHEN** `QEEditSeveridadMineralModal` opens for a `qe.tipo === 'OPERACIONAL'` with `access: { reporteInicial: false, severidad: false, mineral: true }`
- **THEN** only the `mineralInvolucrado` select is rendered; no `severidad` select appears

#### Scenario: Modal shows both fields when both flags are true
- **WHEN** `QEEditSeveridadMineralModal` opens with `access: { reporteInicial: false, severidad: true, mineral: true }`
- **THEN** both `severidad` and `mineralInvolucrado` selects are rendered

#### Scenario: Modal never renders reporte-inicial fields
- **WHEN** `QEEditSeveridadMineralModal` renders under any `access` combination
- **THEN** `descripcion`, `areaAfectada`, `turno`, and `fechaHoraEvento` are never present in the modal

---

### Requirement: QEEditSeveridadMineralModal submits changed fields sequentially
On submit, the system SHALL call `useEditarSeveridad().mutate({ id: qe.id, data: { severidad } })` when the `severidad` field changed from its original value, followed by `useEditarMineral().mutate({ id: qe.id, data: { mineralInvolucrado } })` when the `mineralInvolucrado` field changed, awaiting the first mutation's resolution before firing the second so audit-trail entries are appended in a deterministic order. A field left unchanged SHALL NOT trigger its corresponding mutation. On success of all triggered mutations, the modal SHALL close, show one `toast.success`, and invalidate the QE detail and list queries.

#### Scenario: Only severidad changed triggers only useEditarSeveridad
- **WHEN** the user changes `severidad` but leaves `mineralInvolucrado` unchanged and submits
- **THEN** `useEditarSeveridad().mutate` is called and `useEditarMineral().mutate` is never called

#### Scenario: Both fields changed trigger both mutations in order
- **WHEN** the user changes both `severidad` and `mineralInvolucrado` and submits
- **THEN** `useEditarSeveridad().mutate` resolves before `useEditarMineral().mutate` is called

#### Scenario: No fields changed disables the submit button
- **WHEN** neither `severidad` nor `mineralInvolucrado` differs from the QE's current values
- **THEN** the submit button is disabled and no mutation is called

---

### Requirement: QEEditSeveridadMineralModal shows the CRITICA re-notification banner
The system SHALL render the same CRITICA warning banner pattern used by `QualityEventForm` (RN-QE-005 message) immediately below the `severidad` select when the selected value is `'CRITICA'` and differs from `qe.severidad`, indicating the Gerencia notification (RN-QE-011) will fire on save.

#### Scenario: Banner appears when changing severidad to CRITICA
- **WHEN** the user selects `CRITICA` in the modal's `severidad` select and the QE's current `severidad` is `'ALTA'`
- **THEN** the RN-QE-005/011 warning banner is rendered below the select

#### Scenario: Banner does not appear when severidad is already CRITICA and unchanged
- **WHEN** the modal opens for a QE with `severidad: 'CRITICA'` and the user makes no change
- **THEN** no warning banner is rendered

---

### Requirement: QEEditSeveridadMineralModal cancel discards changes
The system SHALL render a "Cancelar" button that closes the modal without calling any mutation, discarding any in-progress field changes.

#### Scenario: Cancel closes without mutating
- **WHEN** the user changes `severidad` and then clicks "Cancelar"
- **THEN** the modal closes, no mutation is called, and the QE's `severidad` is unchanged
