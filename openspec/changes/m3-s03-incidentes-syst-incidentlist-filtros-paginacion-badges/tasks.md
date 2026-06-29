## 1. Badge Components

- [x] 1.1 Create `src/features/incidents/components/IncidentStatusBadge.tsx` — pill badge with 7 states, colors from spec, labels from `INCIDENT_STATUS_LABELS`, dark mode variants
- [x] 1.2 Create `src/features/incidents/components/IncidentTypeBadge.tsx` — pill badge with icon (lucide-react) for 4 types, colors from spec, labels from `INCIDENT_TYPE_LABELS`, dark mode variants

## 2. Data Bridge Hook

- [x] 2.1 Create `src/features/incidents/hooks/useIncidentList.ts` — reads URL search params (`tipo`, `estado`, `severidad`, `areaId`, `turno`, `fechaDesde`, `fechaHasta`, `search`, `showDeleted`, `page`), maps to `IncidentFilters` with `pageSize: 10`, delegates to `useIncidents()`, returns `{ incidentes, isLoading, isError, pagination, refetch }`

## 3. IncidentList Component

- [x] 3.1 Create `src/features/incidents/components/IncidentList.tsx` — skeleton, wire `useIncidentList` hook
- [x] 3.2 Add page header: title `t('incidents:list.title')`, "Nuevo incidente" button (`Plus` icon) visible for `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST` via `getIncidentPermissions()`
- [x] 3.3 Add FilterBar with 8 filters using `useSearchParams` as source of truth: Tipo, Estado, Severidad, Área (`AREAS_SHAC`), Turno, Fecha desde, Fecha hasta, búsqueda libre (300ms debounce)
- [x] 3.4 Add "Mostrar eliminados" switch — visible only for `JEFE_CALIDAD_SYST`, syncs with `showDeleted` URL param
- [x] 3.5 Add "Limpiar filtros" button — appears only when at least one filter param is active, resets all params + `page`
- [x] 3.6 Add active filter chips below FilterBar — one dismissible chip per active filter param, uses `INCIDENT_STATUS_LABELS`/`INCIDENT_TYPE_LABELS`/`AREAS_SHAC` for labels
- [x] 3.7 Build table with 8 columns: Número (monospace), Tipo (`IncidentTypeBadge`), Descripción (60-char truncate + title tooltip), Área (name from `AREAS_SHAC`), Severidad (`SeverityBadge`), Estado (`IncidentStatusBadge`), Fecha evento (`formatDate()`), Acciones
- [x] 3.8 Apply `TABLE_ROW_CLASS` to every `<tr>` in the table
- [x] 3.9 Implement deleted row styles: `opacity-50` on the row, `line-through` on the Descripción cell
- [x] 3.10 Implement Acciones column: `Eye` (always for `canView`), `Trash2` (only for `canDelete && estado === 'ABIERTO' && !deletedAt`), `RotateCcw` (only for `canRestore && deletedAt`); all with `aria-label`
- [x] 3.11 Implement delete confirmation modal — title "¿Eliminar incidente?", shows incident number, "Cancelar" / "Eliminar" (danger) buttons; calls `useDeleteIncident` only on confirm; shows Sonner toast on success
- [x] 3.12 Implement restore confirmation modal — title "¿Restaurar incidente?", shows incident number, "Cancelar" / "Restaurar" (primary) buttons; calls `useRestoreIncident` only on confirm; shows Sonner toast on success
- [x] 3.13 Add empty state — "No se encontraron incidentes" with "Limpiar filtros" button; differentiated message when filters are active
- [x] 3.14 Add loading state — skeleton rows with `bg-hairline animate-pulse`
- [x] 3.15 Add error state — error message + "Reintentar" button calling `refetch`
- [x] 3.16 Wire `Pagination` shared component — passes `pagination` from hook, updates `page` URL param on change

## 4. Page Wrapper

- [x] 4.1 Create `src/features/incidents/pages/IncidentListPage.tsx` — wraps `IncidentList` with `ErrorBoundary` and `Suspense`

## 5. Router Integration

- [x] 5.1 Update `src/router/index.tsx` — add `/incidents` route with `<RoleGuard requiredRoles={['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'AUDITOR_INTERNO', 'ALTA_DIRECCION']}>` rendering `IncidentListPage`
- [x] 5.2 Add `/incidents/nuevo` static route (before `:id`) with same `RoleGuard`, renders placeholder "Próximamente" component
- [x] 5.3 Add `/incidents/:id` dynamic route with same `RoleGuard`, renders placeholder "Próximamente" component

## 6. Sidebar Integration

- [x] 6.1 Update `src/components/layout/Sidebar.tsx` — add "Incidentes SyST" nav item with `ShieldAlert` icon, path `/incidents`, positioned after "No Conformidades" and before "Quality Events", visible for `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`

## 7. i18n Keys

- [x] 7.1 Add `incidents:list.title`, `incidents:list.empty`, `incidents:list.emptyWithFilters` and filter label keys to `src/i18n/es-PE.json`
- [x] 7.2 Add corresponding English translations to `src/i18n/en-US.json`
- [x] 7.3 Add `common:nav.incidents` key to both locale files (`es-PE`: "Incidentes SyST", `en-US`: "SyST Incidents")

## 8. Exports & Index

- [x] 8.1 Update `src/features/incidents/index.ts` — export `IncidentList`, `IncidentListPage`, `IncidentStatusBadge`, `IncidentTypeBadge`, `useIncidentList`
