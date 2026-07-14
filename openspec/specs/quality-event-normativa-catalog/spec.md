# Spec: quality-event-normativa-catalog

## Purpose

Structured normativa vinculada for Quality Events of origin `O3_HALLAZGO_AUDITORIA`: the `NormaISO`/`NormativaVinculada` types, the curated `CLAUSULAS_ISO` clause catalog for ISO 9001:2015 and ISO 45001:2018, and the `NormativaVinculadaCombobox` component that lets users select a cataloged norma/cláusula pair or fall back to free text when `norma === 'OTRA'` or no catalog entry matches.

---

## Requirements

### Requirement: NormaISO and NormativaVinculada types
The system SHALL define a `NormaISO` type (`'ISO_9001_2015' | 'ISO_45001_2018' | 'OTRA'`) and a `NormativaVinculada` interface in `src/features/quality-events/types/qualityEvent.types.ts`, with fields: `norma` (`NormaISO`, required), `clausula` (string, required), `normaOtraDetalle` (string, optional). `normaOtraDetalle` SHALL only be meaningful when `norma === 'OTRA'`.

#### Scenario: NormativaVinculada accepts an ISO norma without normaOtraDetalle
- **WHEN** a developer constructs `{ norma: 'ISO_9001_2015', clausula: '8.4.1' }` as a `NormativaVinculada`
- **THEN** TypeScript accepts the object without requiring `normaOtraDetalle`

#### Scenario: NormativaVinculada accepts norma OTRA with normaOtraDetalle
- **WHEN** a developer constructs `{ norma: 'OTRA', clausula: '3.2', normaOtraDetalle: 'Auditoría Operacional' }` as a `NormativaVinculada`
- **THEN** TypeScript accepts the object without error

---

### Requirement: clausulasISO catalog constant
The system SHALL export a `CLAUSULAS_ISO` constant from `src/constants/clausulasISO.constants.ts`, typed as `Record<'ISO_9001_2015' | 'ISO_45001_2018', ClausulaISO[]>`, where `ClausulaISO` is `{ codigo: string; titulo: string; subclausulas?: { codigo: string; titulo: string }[] }`. The catalog SHALL cover the principal clauses of ISO 9001:2015 and ISO 45001:2018 relevant to quality/SyST audits (clauses 4 through 10 of each standard), each with its most commonly referenced subclauses. The catalog SHALL NOT include an entry for `'OTRA'` — that case has no catalog, only free text.

#### Scenario: CLAUSULAS_ISO is importable and covers both ISO standards
- **WHEN** a developer imports `CLAUSULAS_ISO` from `src/constants/clausulasISO.constants.ts`
- **THEN** the import resolves without error and both `ISO_9001_2015` and `ISO_45001_2018` keys are present with at least one clause each

#### Scenario: A clause entry exposes subclausulas when applicable
- **WHEN** a developer reads the clause entry for ISO 9001:2015 clause `8.4` (control of externally provided processes)
- **THEN** the entry has a non-empty `subclausulas` array including subclause `8.4.1`

---

### Requirement: NormativaVinculadaCombobox component
The system SHALL export a `NormativaVinculadaCombobox` component from `src/features/quality-events/components/NormativaVinculadaCombobox.tsx`. The component SHALL accept `value: NormativaVinculada | undefined`, `onChange: (value: NormativaVinculada | undefined) => void`, and `ariaLabel: string`. It SHALL first render a `norma` `<select>` populated from `NormaISO` (`ISO_9001_2015`, `ISO_45001_2018`, `OTRA`). When `norma` is `'ISO_9001_2015'` or `'ISO_45001_2018'`, the component SHALL render a text-filterable dropdown of `CLAUSULAS_ISO[norma]` (filtering by `codigo` and `titulo` as the user types, following the same filter-as-you-type interaction pattern as `SearchableSelect`), allowing selection of a cataloged clause OR switching to free-text entry when no catalog entry matches the typed text. When `norma === 'OTRA'`, the component SHALL render a free-text `<input>` for `clausula` directly (no catalog dropdown) plus a required free-text `<input>` for `normaOtraDetalle`.

#### Scenario: Selecting an ISO norma shows the filterable clause dropdown
- **WHEN** the user selects `norma: 'ISO_9001_2015'`
- **THEN** a filterable dropdown of `CLAUSULAS_ISO['ISO_9001_2015']` entries renders, and no `normaOtraDetalle` input is shown

#### Scenario: Typing a clause code filters the dropdown in real time
- **WHEN** `norma` is `'ISO_45001_2018'` and the user types `"8.2"` into the clause filter input
- **THEN** only clause entries whose `codigo` or `titulo` match `"8.2"` remain visible in the dropdown

#### Scenario: No catalog match enables free-text clause entry
- **WHEN** the user types text into the clause filter that matches no entry in `CLAUSULAS_ISO[norma]`
- **THEN** the component allows submitting the typed text as a free-text `clausula` value instead of forcing a catalog selection

#### Scenario: Selecting OTRA shows free-text clausula and requires normaOtraDetalle
- **WHEN** the user selects `norma: 'OTRA'`
- **THEN** a free-text `clausula` input and a required `normaOtraDetalle` input both render, and no catalog dropdown is shown

#### Scenario: onChange emits the full NormativaVinculada object
- **WHEN** the user selects `norma: 'ISO_9001_2015'` and clause `'7.1.5'`
- **THEN** `onChange` is called with `{ norma: 'ISO_9001_2015', clausula: '7.1.5' }`
