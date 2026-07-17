## ADDED Requirements

### Requirement: revisorId and aprobadorId must not be the same user (RN-DOC-019)
The system SHALL enforce segregation of duties between the reviewer and approver of a document. `documentFormSchema` SHALL fail validation when `revisorId` and `aprobadorId` are both non-empty and equal, attaching the validation error to the `aprobadorId` field path. This rule applies identically in create mode and in edit mode (BORRADOR), since `DocumentForm` is the single point where both fields are editable. The rule SHALL NOT apply when either field is empty, and SHALL NOT be re-validated against documents or fixtures already persisted before this rule existed.

#### Scenario: Same user as revisorId and aprobadorId blocks create submission
- **WHEN** the user selects the same person for `revisorId` and `aprobadorId` in create mode and submits
- **THEN** an inline error message appears below the `aprobadorId` field and no API call is made

#### Scenario: Same user as revisorId and aprobadorId blocks edit submission
- **WHEN** the user edits a `BORRADOR` document, changes `revisorId` or `aprobadorId` so both end up equal, and submits
- **THEN** an inline error message appears below the `aprobadorId` field and no API call is made

#### Scenario: Different users for revisorId and aprobadorId pass validation
- **WHEN** the user selects two different people for `revisorId` and `aprobadorId`, even if both share the same `UserRole` (e.g. both `ALTA_DIRECCION`), and submits
- **THEN** no inline error appears for this rule and the API call proceeds

#### Scenario: Leaving revisorId or aprobadorId empty does not trigger this rule
- **WHEN** the user submits the form with `revisorId` set and `aprobadorId` left empty (or vice versa)
- **THEN** no inline error appears for this rule
