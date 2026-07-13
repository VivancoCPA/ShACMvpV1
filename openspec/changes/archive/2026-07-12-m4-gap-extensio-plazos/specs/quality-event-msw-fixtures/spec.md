## ADDED Requirements

### Requirement: Fixtures migrate to the solicitudesAjustePlazo array shape
Every seeded `AccionCorrectivaQE` in `qeAccionesCorrectivas` (`src/mocks/fixtures/quality-events.fixtures.ts`) SHALL define `solicitudesAjustePlazo: SolicitudAjustePlazoAC[]` (defaulting to `[]`). Any fixture that previously populated the removed singular `solicitudAjustePlazo` field SHALL have that object migrated to the first (and, at seed time, only) element of `solicitudesAjustePlazo`, gaining a generated `id` and `requiereAprobacionGerencia` computed from its owning QE's `severidad` and the stored `fechaSolicitada`.

#### Scenario: All seeded ACs expose solicitudesAjustePlazo
- **WHEN** `qeAccionesCorrectivas` is inspected
- **THEN** every `AccionCorrectivaQE` has a `solicitudesAjustePlazo` array (possibly empty)

#### Scenario: No fixture references the removed singular field
- **WHEN** `quality-events.fixtures.ts` is inspected
- **THEN** it contains no `solicitudAjustePlazo` (singular) property

---

### Requirement: At least one seeded PENDIENTE request requiring Gerencia approval
The fixture set SHALL include at least one `AccionCorrectivaQE` (on a QE with `severidad` of `ALTA` or `CRITICA`) with a `solicitudesAjustePlazo` entry having `estado: 'PENDIENTE'` and `requiereAprobacionGerencia: true`, so `ACsExtensionPlazoWidget.tsx` and the Alta Dirección dashboard have non-empty data in development. The fixture set SHALL also include at least one `PENDIENTE` entry with `requiereAprobacionGerencia: false` (Jefe de Calidad-only), to exercise the `QEACSection` approve/reject panel for that role.

#### Scenario: At least one Gerencia-pending fixture request exists
- **WHEN** all `solicitudesAjustePlazo` entries across `qeAccionesCorrectivas` are filtered by `s => s.estado === 'PENDIENTE' && s.requiereAprobacionGerencia === true`
- **THEN** the result has at least 1 element

#### Scenario: At least one Jefe-de-Calidad-pending fixture request exists
- **WHEN** all `solicitudesAjustePlazo` entries across `qeAccionesCorrectivas` are filtered by `s => s.estado === 'PENDIENTE' && s.requiereAprobacionGerencia === false`
- **THEN** the result has at least 1 element
