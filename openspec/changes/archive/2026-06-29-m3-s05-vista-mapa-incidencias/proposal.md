## Why

El módulo M3 registra coordenadas de ubicación (`localId`, `zonaId`, `ubicacion.x/y`) en cada incidente, pero actualmente no existe ninguna vista que las explote. Los supervisores y el jefe de SST necesitan detectar zonas de alta recurrencia de manera visual, algo que la tabla paginada no permite.

## What Changes

- Agregar una segunda pestaña "Mapa" junto a "Lista" en `IncidentListPage`, compartiendo los mismos filtros activos (sin resetear al cambiar de pestaña).
- Crear `IncidentMapView` como componente de página que compone el selector de local, el canvas PNG con marcadores agrupados, el tooltip, el panel lateral y la leyenda.
- Crear `IncidentMapCanvas` con agrupación por proximidad (radio 5 %), marcadores de 3 tamaños/colores según recurrencia, tooltip al hover y panel lateral al clic.
- Crear `IncidentMapLegend` como componente estático siempre visible en la esquina inferior izquierda del canvas.
- Crear `IncidentMapSidePanel` con resumen de incidente único o lista al hacer clic en un marcador agrupado.
- Agregar `useLocales()` hook + API client + MSW fixtures y handlers para el catálogo de locales activos.
- Extender las fixtures de incidentes para que 10 de las 14 tengan `localId`, `zonaId` y `ubicacion` definidos, distribuidos en 2 locales y con clusters visibles.
- Modificar `incident-list-view` spec para añadir el requisito de las pestañas Lista / Mapa.
- Modificar `incident-msw-fixtures` spec para añadir el requisito de cobertura de coordenadas.

## Capabilities

### New Capabilities
- `incident-map-view`: Vista de mapa completa — selector de local, canvas PNG con marcadores agrupados, tooltip, panel lateral, leyenda y estado vacío.
- `incident-locales`: Hook `useLocales()`, API client, MSW fixtures y handlers para el catálogo `Local` y `Zona` (ADD-03).

### Modified Capabilities
- `incident-list-view`: Añadir requisito de pestañas Lista / Mapa en cabecera de `IncidentListPage`, propagando filtros activos.
- `incident-msw-fixtures`: Ampliar cobertura de coordenadas — 10 de 14 incidentes con `localId`, `zonaId` y `ubicacion`, distribuidos en 2 locales distintos y con al menos un cluster visible de 5+ puntos.

## Impact

- `src/features/incidents/pages/IncidentListPage.tsx` — añadir tabs y renderizado condicional.
- `src/features/incidents/pages/IncidentMapView.tsx` — nuevo componente página.
- `src/features/incidents/components/IncidentMapCanvas.tsx` — nuevo.
- `src/features/incidents/components/IncidentMapLegend.tsx` — nuevo.
- `src/features/incidents/components/IncidentMapSidePanel.tsx` — nuevo.
- `src/features/incidents/hooks/useLocales.ts` — nuevo hook TanStack Query.
- `src/api/endpoints/locales.api.ts` — nuevo cliente Axios.
- `src/mocks/fixtures/incidents.fixtures.ts` — extender con coordenadas.
- `src/mocks/fixtures/locales.fixtures.ts` — nuevas fixtures de locales y zonas.
- `src/mocks/handlers/locales.handlers.ts` — nuevos handlers MSW para `/api/locales` y `/api/zonas`.
- `src/mocks/handlers/index.ts` — registrar `localesHandlers`.
- `src/i18n/es-PE.json` y `en-US.json` — claves nuevas bajo namespace `incidents`.
- Sin cambios en rutas (la vista mapa vive en `/incidents` con estado de tab en URL param `view`).
