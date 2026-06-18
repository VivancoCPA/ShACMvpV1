## 1. i18n Keys

- [x] 1.1 Add `documents.list.*` keys to `src/i18n/es-PE.json` (`title`, `empty`, `columns.*`, `pagination.*`, `filters.*`, `actions.*`, `semaforo.proximo`, `semaforo.vencido`)
- [x] 1.2 Add the same keys to `src/i18n/en-US.json` with English translations

## 2. Shared Component — StatusBadge

- [x] 2.1 Create `src/components/shared/StatusBadge.tsx` accepting `status: DocStatus | QEStatus` prop
- [x] 2.2 Implement color-token mapping for all six `DocStatus` values (BORRADOR→muted, EN_REVISION→amber, EN_APROBACION→coral, PUBLICADO→success, OBSOLETO→error+line-through, EN_REVISION_PERIODICA→teal)
- [x] 2.3 Apply `rounded-[9999px]` pill shape and dark-mode variants on every color class
- [x] 2.4 Use `t()` for the label; forward-declare QEStatus values without mapping (no-op fallback)

## 3. RevisionSemaforo Component

- [x] 3.1 Create `src/features/documents/components/RevisionSemaforo.tsx` accepting `fechaRevisionProxima: string | undefined`
- [x] 3.2 Compute `diasRestantes` with `differenceInCalendarDays(parseISO(fechaRevisionProxima), new Date())` from `date-fns`
- [x] 3.3 Implement 4-tier logic: green dot (>30), yellow dot + tooltip (8–30), red dot + `semaforo.proximo` badge (1–7), red `animate-pulse` + `semaforo.vencido` badge (≤0)
- [x] 3.4 Render `—` when `fechaRevisionProxima` is `undefined`
- [x] 3.5 Add accessible tooltip with `role="tooltip"` and `aria-describedby` on the yellow and red tiers

## 4. useDocumentList Hook

- [x] 4.1 Create `src/features/documents/hooks/useDocumentList.ts`
- [x] 4.2 Read `search`, `estado`, `tipo`, `area`, `page` from `useSearchParams`; coerce `page` to integer with default 1
- [x] 4.3 Build `DocFilters` object with `pageSize: 20` and call `useDocuments(filters)`
- [x] 4.4 Return `{ documentos, isLoading, isError, pagination, refetch }` — no JSX, no UI logic

## 5. DocumentListFilters Component

- [x] 5.1 Create `src/features/documents/components/DocumentListFilters.tsx`
- [x] 5.2 Render search `<input>` with `aria-label`, connected to `search` URL param via `useSearchParams`; debounce writes by 300 ms using `useDebounce` from `src/hooks/`
- [x] 5.3 Render `<select>` for `estado` (DocStatus + "Todos" option) wired to `estado` URL param; label associated via `htmlFor`
- [x] 5.4 Render `<select>` for `tipo` (DocType + "Todos" option) wired to `tipo` URL param; label associated via `htmlFor`
- [x] 5.5 Render `<select>` for `area` from `AREAS_SHAC` constant + "Todos" option, wired to `area` URL param; label associated via `htmlFor`
- [x] 5.6 Show "Limpiar filtros" button only when any of `search | estado | tipo | area` params are present; clicking removes all four params and resets `page` to 1

## 6. DocumentListRow Component

- [x] 6.1 Create `src/features/documents/components/DocumentListRow.tsx` accepting a `Documento` and `userRole: UserRole`
- [x] 6.2 Call `getDocumentPermissions(documento.estado, docRoleFromUserRole(userRole))` to resolve action flags
- [x] 6.3 Render action buttons conditionally: edit (only if `canEdit && estado !== 'OBSOLETO'`), review start (`canStartReview`), delete (`canDelete`) — with `aria-label` on icon-only buttons
- [x] 6.4 Show warning icon with `aria-label` when `documento.qeVinculados.length > 0` (RN-DOC-005)
- [x] 6.5 Render `<StatusBadge status={documento.estado} />` in Estado column
- [x] 6.6 Render `<RevisionSemaforo fechaRevisionProxima={documento.fechaRevisionProxima} />` in Próx. Revisión column
- [x] 6.7 Apply row Tailwind: `hover:bg-coral/5 dark:hover:bg-coral/10 cursor-pointer`, alternating `bg-canvas / bg-hairline/30 dark:bg-surface-dark-elevated/30`; `border-b border-hairline dark:border-hairline/20`
- [x] 6.8 Block write actions entirely for `AUDITOR_INTERNO` and `ALTA_DIRECCION` roles (map to read-only `DocRole` before calling `getDocumentPermissions`)

## 7. DocumentList Component

- [x] 7.1 Create `src/features/documents/components/DocumentList.tsx` consuming `useDocumentList()`
- [x] 7.2 Render `<table>` with 8-column `<thead>` (Código, Título, Tipo, Versión, Estado, Área, Próx. Revisión, Acciones) — table `bg-canvas dark:bg-surface-dark`, `border border-hairline dark:border-hairline/20`
- [x] 7.3 Loading state: render 5 `<tr>` rows with `<td>` cells using `bg-hairline animate-pulse rounded h-4` skeleton blocks
- [x] 7.4 Empty state: render centered `t('documents:list.empty')` message; conditionally show "Nuevo Documento" CTA if user has create permission
- [x] 7.5 Error state: render error message and "Reintentar" button that calls `refetch()`
- [x] 7.6 Render one `<DocumentListRow>` per document; attach `onClick={() => navigate('/documents/' + doc.id)}` at the `<tr>` level
- [x] 7.7 Render pagination controls below the table: previous button, page number buttons, next button, and "Mostrando X–Y de Z" text using `t('documents:list.pagination.showing', { from, to, total })`
- [x] 7.8 Pagination buttons update the `page` URL param via `useSearchParams`

## 8. DocumentsPage

- [x] 8.1 Create `src/features/documents/pages/DocumentsPage.tsx`
- [x] 8.2 Read `userRole` from `authStore`; render "Nuevo Documento" button only for `JEFE_CONTROL_DOCUMENTARIO` and `JEFE_CALIDAD_SYST`
- [x] 8.3 Compose `<DocumentListFilters />` above `<DocumentList />` inside a `<PageWrapper title={t('documents:list.title')}>`
- [x] 8.4 Wrap `<DocumentList />` in the feature-level `<ErrorBoundary>` component

## 9. Verification

- [x] 9.1 Confirm all visible strings use `t()` — no hardcoded Spanish text in JSX
- [x] 9.2 Confirm zero `any` in TypeScript across all new files (`tsc --noEmit`)
- [x] 9.3 Confirm dark mode renders correctly by toggling `dark` class on `<html>` in the browser
- [x] 9.4 Confirm filter state survives page refresh via URL params (open URL in new tab)
- [x] 9.5 Confirm `OBSOLETO` rows show no edit button for any role
- [x] 9.6 Confirm `AUDITOR_INTERNO` and `ALTA_DIRECCION` see no write-action buttons
- [x] 9.7 Confirm `RevisionSemaforo` renders all 4 tiers by temporarily overriding `fechaRevisionProxima` in fixtures
- [x] 9.8 Confirm `StatusBadge` renders pill shape with correct colors for all six DocStatus values
