## ADDED Requirements

### Requirement: ACs of QE-referenced NC fixtures carry qeId
For the NC fixtures already cross-referenced from `quality-events.fixtures.ts` (i.e., NCs whose `id` matches an `ncId` used by a QE fixture), at least one of that NC's `accionesCorrectivas` SHALL have `qeId` set to the id of the QE that references it.

#### Scenario: Referenced NC's AC carries the owning QE's id
- **WHEN** a `nonconformityFixtures` entry has `id === 'nc-002'` (referenced by `qe-2026-002` via `ncId`)
- **THEN** at least one AC in that NC's `accionesCorrectivas` has `qeId === 'qe-2026-002'`
