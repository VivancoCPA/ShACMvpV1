## Context

El módulo M3 ya registra datos de ubicación (`localId`, `zonaId`, `ubicacion.x/y`) por incidente, definidos en `incident-types` como parte del ADD-03. Hasta ahora, ninguna vista los aprovecha. La `IncidentListPage` solo muestra tabla paginada con filtros en URL. El backend no existe; MSW v2 es la única fuente de datos. Los tipos `Local`, `Zona` e `IncidenteUbicacion` están íntegramente definidos en `src/features/incidents/types/incident.types.ts`.

## Goals / Non-Goals

**Goals:**
- Agregar una pestaña "Mapa" en `IncidentListPage` que coexiste con la pestaña "Lista"
- Visualizar incidentes geolocalizados sobre el plano PNG del local seleccionado
- Propagar los filtros activos del URL (tipo, estado, turno, etc.) al mapa sin resetearlos al cambiar de pestaña
- Agrupar incidentes cercanos en marcadores visuales con tamaño y color según recurrencia
- Exponer hook `useLocales()` + MSW para el catálogo de locales activos

**Non-Goals:**
- No pan/zoom sobre el PNG (imagen estática con `object-fit: contain`)
- No librería de mapas (Leaflet, Mapbox, react-map-gl, etc.)
- Sin elemento `<canvas>` de HTML ni SVG
- Sin edición de zonas ni dibujo sobre el plano
- Sin actualizaciones en tiempo real ni WebSocket
- Sin modal global — el panel lateral es estado local en `IncidentMapView`

## Decisions

### D1: Estado de tab en URL param `view`
`?view=list` (default) / `?view=map`. Motivo: deep-linking, navegación back/forward, y los filtros ya viven en el URL — agregar un param más es la ruta natural. Alternativa descartada: estado en Zustand (acoplamiento innecesario para algo puramente visual).

### D2: Renderizado con `div` posicionados absolutamente
El PNG se renderiza con `<img>` dentro de un contenedor `position: relative`. Los marcadores son `div` con `position: absolute`, `left: x%`, `top: y%`. Las coordenadas en porcentaje mapean directamente a CSS sin necesidad de cálculos de píxel ni `ResizeObserver`. Alternativa descartada: `<canvas>` HTML (requeriría recalcular posiciones en cada resize y no integra bien con React state/eventos).

### D3: Algoritmo de agrupación — greedy scan en espacio de porcentajes
Ordenar incidentes por `x` (determinismo), luego escaneo O(n²): para cada incidente no asignado, recoger todos los que están dentro de radio r = 5 (5 puntos porcentuales). Centroide del grupo = media aritmética de coordenadas miembro. Complejidad aceptable para n ≤ 100 incidentes por local/filtro. Alternativa descartada: quadtree — sobreingeniería para el tamaño de dataset.

### D4: Radio de cluster en puntos porcentuales (no píxeles)
Distancia euclidiana `sqrt((Δx)² + (Δy)²) ≤ 5` en coordenadas porcentuales. Evita un `ResizeObserver`. Trade-off: en contenedores muy alargados, el radio visual se distorsiona levemente — aceptable para oficinas logísticas con pantallas de aspecto normal.

### D5: Tooltip — estado React local en `IncidentMapCanvas`
`hoveredGroupId: string | null` local al componente. El tooltip es un `div` `position: absolute` hermano del marcador, desplazado +8px/−8px. Descartado: portal o librería externa (overhead innecesario; tooltip simple sin necesidad de escapar del contenedor).

### D6: Panel lateral — estado en `IncidentMapView`
`selectedGroup: MarkerGroup | null` en el componente página. El panel es una columna lateral de 320px a la derecha del canvas. En pantallas < 640px, se superpone (overlay con `z-index`). Descartado: Zustand (no necesita persistencia entre sesiones ni coordinación con otros componentes).

### D7: `useLocales()` sigue el patrón estándar de TanStack Query del proyecto
`GET /api/locales?activo=true`. Fixtures: 2 locales activos + 1 inactivo para cubrir el filtrado. `planoPngUrl` apunta a `/mock/plano-placeholder.png` (asset público de placeholder hasta que el cliente entregue planos reales).

## Risks / Trade-offs

- [PNG no disponible o falla de carga] → Mostrar estado vacío "Plano no disponible". Mitigación: `onError` en el `<img>`, placeholder en `/public/mock/plano-placeholder.png` garantiza que el mock nunca falle.
- [Clusters distintos por orden de fixture] → Mitigado ordenando por `x` antes de clusterizar (resultado determinista).
- [Sensibilidad del radio 5%] → Radio fijo hoy. Si se necesita ajuste futuro, `IncidentMapCanvas` acepta prop `clusterRadius?: number` (YAGNI por ahora).
- [Panel en móvil obstruye el plano] → El caso de uso es escritorio de oficina; overlay aceptable en móvil.

## Migration Plan

Sin cambios en API real ni base de datos. La pestaña Mapa es aditiva; la vista Lista no se toca. Para producción futura: deshabilitar MSW (`VITE_ENABLE_MSW=false`) y apuntar `VITE_API_BASE_URL` al backend .NET.

## Open Questions

Ninguna — todas las decisiones están resueltas para el scope actual.
