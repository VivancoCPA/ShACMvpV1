## MODIFIED Requirements

### Requirement: DocumentActionPanel role-based action rendering
The `DocumentActionPanel` component SHALL display only actions permitted for the current user's role and the document's estado, as resolved by `getDocumentPermissions()`. The panel SHALL render as an inline, non-sticky button row in the page header, next to the document title — the same placement pattern used for the "Editar" action in `IncidentDetailPage`. When no actions are available, it SHALL render the i18n message `documents:detail.noActionsAvailable`. Every mutating action SHALL open a confirmation modal before executing — no direct mutations on click.

#### Scenario: No actions shown for OBSOLETO documents
- **WHEN** `documento.estado === 'OBSOLETO'`
- **THEN** the panel displays `t('documents:detail.noActionsAvailable')` and no action buttons

#### Scenario: No actions shown for OPERARIO on any state
- **WHEN** the user's role is `OPERARIO`
- **THEN** no action buttons are visible (OPERARIO has no write permissions)

#### Scenario: Actions gated by confirmation modal
- **WHEN** the user clicks any mutating action button
- **THEN** a modal opens asking for confirmation before the mutation is sent

#### Scenario: Actions render inline in the header, not in a sticky sidebar
- **WHEN** the document detail page renders with at least one available action
- **THEN** the action buttons appear inline next to the document title in the header, and no sticky right-column panel is present in the layout
