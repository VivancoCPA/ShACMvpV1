## 1. Fixtures de locales y zonas (MSW)

- [x] 1.1 Crear `src/mocks/fixtures/locales.fixtures.ts` — exportar `localFixtures` (3 locales: LOC-001 activo, LOC-002 activo, LOC-003 inactivo) y `zonaFixtures` (5 zonas: 3 en LOC-001, 2 en LOC-002)
- [x] 1.2 Crear `src/mocks/handlers/locales.handlers.ts` — handlers para `GET /api/locales` (filtrado por `activo`) y `GET /api/zonas` (filtrado por `localId`), con `delay(400)`
- [x] 1.3 Importar y agregar `localesHandlers` al array en `src/mocks/handlers/index.ts`

## 2. API client y hook de locales

- [x] 2.1 Crear `src/api/endpoints/locales.api.ts` — objeto `localesApi` con `getLocales(params: { activo?: boolean })` usando la instancia Axios compartida
- [x] 2.2 Crear `src/features/incidents/hooks/useLocales.ts` — `useQuery` con key `['locales', 'list', { activo: true }]`, retorna `{ locales, isLoading, isError }`

## 3. Ampliar fixtures de incidentes con coordenadas

- [x] 3.1 Editar `src/mocks/fixtures/incidents.fixtures.ts` — agregar `localId`, `zonaId`, `ubicacion`, `localNombre`, `zonaNombre` a 10 de los 14 fixtures: ≥ 5 en LOC-001 (dentro de radio 5% entre sí para el cluster rojo) y ≥ 4 en LOC-002; los 4 restantes sin datos de ubicación

## 4. Claves i18n

- [x] 4.1 Agregar claves de mapa en `src/i18n/es-PE.json` bajo el namespace `incidents`: `map.planUnavailable`, `map.noIncidents`, `map.multipleZones`, `map.legend.single`, `map.legend.twoToFour`, `map.legend.fivePlus`, `map.localSelector.label`, `list.tabs.list`, `list.tabs.map`
- [x] 4.2 Agregar las mismas claves con valores en inglés en `src/i18n/en-US.json`

## 5. IncidentMapLegend

- [x] 5.1 Crear `src/features/incidents/components/IncidentMapLegend.tsx` — `position: absolute` esquina inferior izquierda, fondo `bg-surface-card/80 dark:bg-surface-dark-elevated/80`, 3 ítems (azul, ámbar, rojo) con claves i18n; soporta dark mode

## 6. IncidentMapSidePanel

- [x] 6.1 Crear `src/features/incidents/components/IncidentMapSidePanel.tsx` — panel 320px ancho; cabecera con botón X (`aria-label` de `t('common:actions.close')`); vista detalle único (título, tipo, `IncidentStatusBadge`, área, fecha, zona, local, botón "Ver detalle" con `useNavigate`); vista multi-incidente (lista scrollable con `numero`, badge, fecha, clic → navega)

## 7. IncidentMapCanvas

- [x] 7.1 Crear `src/features/incidents/components/IncidentMapCanvas.tsx` — contenedor `position: relative overflow-hidden`; `<img>` con `object-fit: contain w-full h-full`; handler `onError` para estado "plano no disponible"
- [x] 7.2 Implementar `useMemo` de clustering: filtrar por `localId` + `ubicacion !== undefined`, ordenar por `x`, greedy scan con radio euclidiano ≤ 5 en espacio de porcentajes, computar centroide por media aritmética
- [x] 7.3 Renderizar marcadores — `div position: absolute`, `transform: translate(-50%, -50%)`, `left: x% top: y%`; tamaño/color según regla (1→`w-5 h-5 bg-blue-500`, 2–4→`w-[30px] h-[30px] bg-amber`, 5+→`w-10 h-10 bg-error`); número interior si N > 1; `opacity-85`
- [x] 7.4 Implementar tooltip al hover — estado `hoveredGroupId: string | null`; tooltip `div position: absolute` con conteo, zona, tipo más frecuente (`INCIDENT_TYPE_LABELS`), fecha más reciente (`formatDate()`)
- [x] 7.5 Integrar `IncidentMapLegend` como hijo del contenedor del canvas (la leyenda se posiciona absolutamente dentro)
- [x] 7.6 Mostrar estado vacío centrado con `t('incidents:map.noIncidents')` cuando el array filtrado es vacío (mantener PNG como fondo si cargó)

## 8. IncidentMapView

- [x] 8.1 Crear `src/features/incidents/pages/IncidentMapView.tsx` — leer `mapLocal` de `useSearchParams` (default: primer local activo de `useLocales()`); estado local `selectedGroup: MarkerGroup | null`
- [x] 8.2 Agregar selector de local — `<select>` poblado con `locales.filter(l => l.activo)`, onChange actualiza param `mapLocal` sin resetear otros filtros
- [x] 8.3 Consumir `useIncidentList()` para obtener `incidentes` (mismos hooks y filtros URL que la vista Lista); pasar array a `IncidentMapCanvas`
- [x] 8.4 Componer layout: selector arriba; canvas + leyenda (relativo) a la izquierda; `IncidentMapSidePanel` a la derecha cuando `selectedGroup !== null` (320px fijo); overlay en mobile < 640px

## 9. Tabs Lista / Mapa en IncidentListPage

- [x] 9.1 Editar `src/features/incidents/pages/IncidentListPage.tsx` — agregar los dos tab buttons "Lista" y "Mapa" en la cabecera; leer `view` de `useSearchParams` (default `'list'`); los tabs setean solo el param `view` sin tocar otros params
- [x] 9.2 Renderizado condicional — `view === 'map'` → `<IncidentMapView />`; `view === 'list'` (o ausente) → `<IncidentList />`
- [x] 9.3 Envolver `<IncidentMapView>` en su propio `<ErrorBoundary>` independiente del de `<IncidentList>`
- [x] 9.4 Aplicar estilos de tab activo/inactivo usando design tokens del proyecto (`bg-coral text-white` activo, `bg-canvas text-ink border border-hairline` inactivo); variantes `dark:` correspondientes

## 10. Tests unitarios

- [x] 10.1 Test de clustering: 6 incidentes dentro de radio 5% → un solo grupo con 6 miembros (CA-ADD03-04)
- [x] 10.2 Test de marcadores: cluster de 1 → `bg-blue-500 w-5 h-5`; de 3 → `bg-amber`; de 5 → `bg-error`
- [x] 10.3 Test de tabs: con filtros activos `tipo=ACCIDENTE`, clic en "Mapa" → URL conserva `tipo=ACCIDENTE` y agrega `view=map`
- [x] 10.4 Test de estado vacío: incidentes con `ubicacion undefined` → ningún marcador renderizado; mensaje `t('incidents:map.noIncidents')` visible
- [x] 10.5 Test de selector de local: incidentes de LOC-001 y LOC-002 → al seleccionar LOC-002 solo se renderizan marcadores con `localId === 'loc-002'` (CA-ADD03-09)
