## Why

M3-S01 y M3-S02 establecieron los tipos, schemas, permisos, API client, hooks TanStack Query y handlers MSW para el módulo de Incidentes SyST. Falta la capa de presentación: el listado que los usuarios operan a diario para consultar, filtrar y gestionar incidentes. Sin esta vista el módulo M3 no es funcional para ningún rol.

## What Changes

- **Nuevo componente** `IncidentStatusBadge` — pill de estado con 7 valores (ABIERTO, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE, CERRADO, ANULADO) con paleta de colores semántica.
- **Nuevo componente** `IncidentTypeBadge` — pill de tipo con ícono lucide-react para ACCIDENTE, INCIDENTE, CUASI_ACCIDENTE, CONDICION_INSEGURA.
- **Nuevo componente de página** `IncidentList` — vista completa con encabezado, FilterBar con 8 filtros + búsqueda libre, tabla paginada de 8 columnas, modales de confirmación para eliminar/restaurar, estado vacío y chips de filtros activos.
- **Nueva page wrapper** `IncidentListPage` — envuelve `IncidentList` con `ErrorBoundary` y `Suspense`.
- **Actualización `src/router/index.tsx`** — agrega rutas `/incidents`, `/incidents/nuevo` e `/incidents/:id` (las dos últimas como placeholders), protegidas con `RoleGuard` para los roles autorizados.
- **Actualización `src/components/layout/Sidebar.tsx`** — agrega ítem "Incidentes SyST" con ícono `ShieldAlert` entre No Conformidades y Quality Events.

## Capabilities

### New Capabilities

- `incident-list-view`: Vista de listado de incidentes con FilterBar multi-criterio, tabla paginada, acciones condicionales por rol y estado, modales de confirmación, chips de filtros activos y soporte light/dark mode. Referencia canónica: `nc-list-view`.
- `incident-status-badge`: Componente visual para representar el estado de un incidente con paleta de colores semántica de 7 valores.
- `incident-type-badge`: Componente visual para representar el tipo de incidente con ícono y color según clasificación SyST.

### Modified Capabilities

- `routing`: Se agregan las rutas del módulo M3 (`/incidents`, `/incidents/nuevo`, `/incidents/:id`) con `RoleGuard` apropiado.
- `app-navigation`: Se agrega el ítem "Incidentes SyST" al Sidebar en la posición correcta del menú.

## Impact

- **Archivos nuevos**: `src/features/incidents/components/IncidentStatusBadge.tsx`, `IncidentTypeBadge.tsx`, `IncidentList.tsx`; `src/features/incidents/pages/IncidentListPage.tsx`.
- **Archivos modificados**: `src/router/index.tsx`, `src/components/layout/Sidebar.tsx`.
- **Dependencias M3-S01**: `getIncidentPermissions()`, tipos `Incident`, `IncidentStatus`, `IncidentType`, `IncidentSeverity`.
- **Dependencias M3-S02**: hooks `useIncidents`, `useDeleteIncident`, `useRestoreIncident`.
- **Componentes compartidos reutilizados** (sin modificación): `FilterBar`, `Pagination`, `SeverityBadge`, `PageWrapper`.
- **Constantes consumidas**: `INCIDENT_STATUS_LABELS`, `INCIDENT_TYPE_LABELS`, `AREAS_SHAC`, `TABLE_ROW_CLASS`.
