# Spec: nc-form

## Purpose

React Hook Form + Zod form for creating and editing No Conformidades. Domain-aware UX with business-rule warnings, NC-SST IPER enforcement, and duplicate detection modal.

---

## Requirements

### Requirement: NCForm renders all required fields with correct controls
The system SHALL render an `NCForm` component in `src/features/nonconformities/components/NCForm.tsx` using React Hook Form registered against the appropriate Zod schema. The form SHALL include the following controls:
- `numero`: readonly text input, visible only when editing an existing NC (not on create).
- `dominio`: `<select>` with options for `NC-CAL`, `NC-SST`, `NC-ADU`, `NC-OPE`, `NC-PRV`, displaying human-readable labels (e.g., "Calidad", "SST", "Aduanero", "Operacional", "Proveedores") sourced from `NC_DOMINIO_LABELS` in the nonconformity constants file.
- `severidad`: `<select>` with options for `BAJA`, `MEDIA`, `ALTA`, `CRITICA`, displaying human-readable labels.
- `titulo`: `<input type="text">`, required.
- `descripcion`: `<textarea>`, required, min 10 chars.
- `areaAfectada`: `<select>` populated from `AREAS_SHAC` in `src/constants/shared.constants.ts`.
- `procesoInvolucrado`: `<input type="text">`, required.
- `fechaDeteccion`: `<input type="date">`, required. Display format dd/mm/yyyy via browser locale; internal value ISO 8601.
- `fechaCierre`: `<input type="date">`, required. Must be after `fechaDeteccion` (Zod superRefine).
- `detectadoPor`: `<input type="text">`, optional.
- `requiereIPER`: `<input type="checkbox">`. Disabled and forced to `true` when `dominio === 'NC-SST'`.

#### Scenario: dominio select shows human-readable labels
- **WHEN** the user opens the dominio select
- **THEN** the options display "Calidad", "SST", "Aduanero", "Operacional", "Proveedores" — not the raw codes

#### Scenario: numero field visible only when editing
- **WHEN** `NCForm` is rendered in create mode (no `nc` prop)
- **THEN** the `numero` field is not rendered

#### Scenario: requiereIPER checkbox is disabled and checked when dominio is NC-SST
- **WHEN** the user selects "SST" in the dominio select
- **THEN** the `requiereIPER` checkbox becomes checked and its input is disabled

#### Scenario: fechaCierre Zod validation rejects dates before fechaDeteccion
- **WHEN** the user sets `fechaCierre` to a date earlier than `fechaDeteccion` and submits
- **THEN** a validation error is shown under the `fechaCierre` field

---

### Requirement: NCForm shows business rule warning when dominio is NC-SST
The system SHALL display an inline informational alert with text from `t('nonconformities:form.warnings.requiereIPER')` immediately below the `dominio` select when the selected value is `'NC-SST'`. The alert SHALL appear and disappear reactively as the user changes the dominio value, without requiring form submission.

#### Scenario: IPER warning appears when NC-SST is selected
- **WHEN** the user selects "SST" in the dominio select
- **THEN** an inline warning reading `t('nonconformities:form.warnings.requiereIPER')` appears below the select

#### Scenario: IPER warning disappears when dominio changes away from NC-SST
- **WHEN** the user changes dominio from "SST" to "Calidad"
- **THEN** the IPER warning is no longer rendered

---

### Requirement: NCForm shows business rule warning when dominio is NC-ADU
The system SHALL display an inline informational alert with text from `t('nonconformities:form.warnings.aduanaNotificacion')` immediately below the `dominio` select when the selected value is `'NC-ADU'`.

#### Scenario: Aduana notification warning appears when NC-ADU is selected
- **WHEN** the user selects "Aduanero" in the dominio select
- **THEN** an inline alert reading `t('nonconformities:form.warnings.aduanaNotificacion')` appears

---

### Requirement: NCForm shows inline Zod validation errors on all required fields
The system SHALL display field-level validation error messages below each invalid control when the form is submitted or when a field is blurred. Error messages SHALL use `t('nonconformities:form.errors.<fieldName>')` keys. No hardcoded Spanish error strings.

#### Scenario: Submitting with empty titulo shows validation error
- **WHEN** the user submits the form with an empty `titulo`
- **THEN** an error message from `t('nonconformities:form.errors.titulo')` appears below the titulo input

#### Scenario: Errors are cleared when field becomes valid
- **WHEN** the user corrects an invalid `descripcion` field
- **THEN** the error message below descripcion disappears

---

### Requirement: NCForm submit calls the correct mutation and shows Sonner toast
On a valid create submission, `NCForm` SHALL call `useCreateNonconformity().mutate(data)`. On success (and no duplicate warning), it SHALL navigate to `/nonconformities/<newId>`. On a valid edit submission, it SHALL call `useUpdateNonconformity().mutate({ id, data })` and stay on the detail page. On mutation error, the Sonner `toast.error` from the hook fires (no additional toast in the form). The "Cancelar" button SHALL navigate back to `/nonconformities` without submitting.

#### Scenario: Successful create navigates to new NC detail page
- **WHEN** the form is submitted with valid data and no duplicate warning
- **THEN** the browser navigates to `/nonconformities/<newNC.id>`

#### Scenario: Cancelar button navigates to list without submitting
- **WHEN** the user clicks "Cancelar"
- **THEN** the browser navigates to `/nonconformities` and `mutate` is never called

---

### Requirement: NCForm shows duplicate detection modal when server returns POSIBLE_DUPLICADO
The system SHALL detect when `useCreateNonconformity`'s `onSuccess` receives `data.warning === 'POSIBLE_DUPLICADO'` and open a `DuplicateModal` overlay displaying the list of `data.ncsSimilares` (at minimum: numero and descripcion for each). The modal SHALL offer two actions:
- "Vincular a NC existente" — navigates to the selected similar NC's detail page.
- "Guardar como nueva NC" — calls `useCreateNonconformity().mutate({ ...data, forzar: true })` and then navigates to the newly created NC on success.

#### Scenario: Duplicate modal opens when POSIBLE_DUPLICADO warning received
- **WHEN** `onSuccess` fires with `data.warning === 'POSIBLE_DUPLICADO'`
- **THEN** `DuplicateModal` is rendered with the list of `ncsSimilares`

#### Scenario: Vincular a NC existente navigates to the selected NC
- **WHEN** the user clicks "Vincular a NC existente" on one of the ncsSimilares entries
- **THEN** the browser navigates to `/nonconformities/<selectedNc.id>` and the create form is abandoned

#### Scenario: Guardar como nueva NC re-submits with forzar flag
- **WHEN** the user clicks "Guardar como nueva NC" in the duplicate modal
- **THEN** `mutate` is called again with `forzar: true` in the payload and the modal closes

---

### Requirement: NCForm used inside NonconformityNewPage for create flow
The system SHALL export a `NonconformityNewPage` component from `src/features/nonconformities/pages/NonconformityNewPage.tsx` that renders `NCForm` in create mode wrapped in a `PageWrapper` with breadcrumb `"No Conformidades > Nueva NC"` and title from `t('nonconformities:form.createTitle')`.

#### Scenario: NonconformityNewPage renders NCForm in create mode
- **WHEN** a user navigates to `/nonconformities/new`
- **THEN** `NCForm` renders with no `numero` field and a submit button labeled `t('nonconformities:form.submitCreate')`
