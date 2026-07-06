## MODIFIED Requirements

### Requirement: DocumentList renders a paginated table with loading, empty, and error states
The system SHALL render a `DocumentList` component with columns: Código, Título, Tipo, Versión, Estado, Área, Próx. Revisión, and Acciones. Default `pageSize` SHALL be 10, matching `QEList` and `IncidentList`. Pagination controls SHALL show page numbers and previous/next buttons with text "Mostrando X–Y de Z" using i18n keys. While loading, the table SHALL show 5 skeleton rows with `bg-hairline animate-pulse` styling instead of a global spinner. When the result set is empty, an i18n message from `t('documents:list.empty')` SHALL appear, plus a CTA button if the user has permission to create documents. When the query errors, an error message and a "Reintentar" button calling `refetch` SHALL appear. Clicking any row SHALL navigate to `/documents/:id`.

#### Scenario: Loading state renders 5 skeleton rows
- **WHEN** `useDocumentList` returns `isLoading: true`
- **THEN** the table body contains exactly 5 rows with skeleton pulse styling and no real document data

#### Scenario: Empty state shows localized message
- **WHEN** the query resolves with zero documents
- **THEN** `t('documents:list.empty')` is displayed and no table rows are present

#### Scenario: Error state shows retry button
- **WHEN** the query resolves with `isError: true`
- **THEN** an error message and a button that calls `refetch` are rendered

#### Scenario: Row click navigates to detail
- **WHEN** a user clicks anywhere on a `DocumentListRow`
- **THEN** the router navigates to `/documents/<id>` for that document

#### Scenario: Pagination controls update the page param
- **WHEN** a user clicks page 2 in the pagination controls
- **THEN** the URL param `page=2` is set and the list re-fetches with `page: 2`

#### Scenario: Opening /documents without filters shows 10 rows per page by default
- **WHEN** a user navigates to `/documents` with no `page` or filter params applied and more than 10 documents exist
- **THEN** exactly 10 document rows are shown on the first page, consistent with `QEList` and `IncidentList`

### Requirement: useDocumentList maps URL search params to useDocuments query
The system SHALL export a `useDocumentList` hook from `src/features/documents/hooks/useDocumentList.ts` that reads `search`, `estado`, `tipo`, `area`, and `page` from `useSearchParams`, maps them to a `DocFilters` object with `pageSize: 10`, and delegates to `useDocuments()`. The hook SHALL return `{ documentos, isLoading, isError, pagination, refetch }` with no UI logic or JSX.

#### Scenario: Hook returns documentos array from query result
- **WHEN** `useDocumentList` is called and `useDocuments` resolves with data
- **THEN** `documentos` equals the `data.data` array from the query response

#### Scenario: Hook passes page from URL param
- **WHEN** the URL contains `page=3`
- **THEN** `useDocuments` is called with `page: 3`

#### Scenario: Hook returns isLoading true during fetch
- **WHEN** `useDocuments` is pending
- **THEN** `useDocumentList` returns `isLoading: true`

#### Scenario: Hook defaults to pageSize 10
- **WHEN** `useDocumentList` builds its filters object
- **THEN** `pageSize` is `10`, not `5`
