## Why

M4-S01 y M4-S02 establecieron los tipos, schemas, API client, MSW y hooks del módulo Quality Event, pero aún no existe ninguna pantalla visible para el usuario. Este sprint cierra esa brecha creando la página de listado `/quality-events`: la puerta de entrada al módulo M4, que permite a los usuarios explorar, filtrar y navegar a los QEs.

## What Changes

- Nueva página `src/features/quality-events/pages/QualityEventList.tsx` en ruta `/quality-events` con tabla paginada, filtros URL-driven y estados de carga/vacío/error.
- Nuevo hook de composición `src/features/quality-events/hooks/useQEList.ts` que mapea URL search params a `useQualityEvents`.
- Nuevos badges `QEStatusBadge`, `QEOriginBadge`, `QETypeBadge` en `src/features/quality-events/components/`.
- Extensión de `SeverityBadge` (compartido M2/M3) o nuevo `QESeverityBadge` según compatibilidad con `QE_SEVERITY_COLORS`.
- Claves i18n bajo `qualityEvents:list.*` en `es-PE.json` y `en-US.json`.
- Registro de la nueva ruta en el router de la aplicación.

## Capabilities

### New Capabilities

- `quality-event-list-view`: Página de listado `/quality-events` con tabla paginada, filtros URL-driven con badges removibles, skeleton de carga, estado vacío ilustrado, borde izquierdo rojo para severidad CRITICA y badge de reincidencia para `ciclo > 1`.
- `quality-event-status-badge`: Badge `QEStatusBadge` con los 9 estados del QE y colores semánticos.
- `quality-event-origin-badge`: Badge `QEOriginBadge` con icono + etiqueta compacta para los 4 orígenes.
- `quality-event-type-badge`: Badge `QETypeBadge` con chips de color suave para los 4 tipos.

### Modified Capabilities

- `routing`: Agregar la ruta `/quality-events` al router de la aplicación con el guard de rol correspondiente.
- `quality-event-permissions`: El helper `getQualityEventPermissions` ya expone `puedeEditarCabecera`; la lista lo consume sin cambios al contrato del spec original.

## Impact

- **Nuevos archivos:** `src/features/quality-events/pages/QualityEventList.tsx`, `src/features/quality-events/hooks/useQEList.ts`, `src/features/quality-events/components/QEStatusBadge.tsx`, `src/features/quality-events/components/QEOriginBadge.tsx`, `src/features/quality-events/components/QETypeBadge.tsx`.
- **Archivos modificados:** `src/i18n/es-PE.json` (claves `qualityEvents:list.*`), `src/i18n/en-US.json` (ídem), `src/App.tsx` o router principal (agregar ruta), `src/features/quality-events/index.ts` (re-exportar página y componentes nuevos).
- **Dependencias:** Consume `useQualityEvents` (M4-S02), `getQualityEventPermissions` (M4-S01), `QE_STATUS_LABELS`/`QE_ORIGIN_LABELS`/`QE_TYPE_LABELS`/`QE_SEVERITY_COLORS` (M4-S01), `FilterBar`, `Pagination`, `DeadlineBadge`, `TABLE_ROW_CLASS`.
- **Sin cambios en API ni MSW:** los 8 fixtures y handlers de M4-S02 son suficientes.
