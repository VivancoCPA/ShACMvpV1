## MODIFIED Requirements

### Requirement: AuditorDashboard compone los 4 widgets de auditoría
El componente `AuditorDashboard` (`src/features/dashboard/pages/AuditorDashboard.tsx`) SHALL consumir `useDashboardSummary()`, mostrar un estado de carga con `WidgetSkeleton` mientras `isLoading` es verdadero o `data.rol !== 'AUDITOR'`, y en el caso exitoso renderizar en un contenedor `space-y-8` dentro de `PageWrapper`, en este orden: `HallazgosPorNormaWidget`, `HallazgosPorEstadoWidget`, `EvidenciasHallazgosWidget`, `TasaCierrePorAreaWidget`.

#### Scenario: Carga muestra skeletons
- **WHEN** `useDashboardSummary()` está en `isLoading`
- **THEN** `AuditorDashboard` renderiza 4 `WidgetSkeleton` y ningún widget de datos

#### Scenario: Datos cargados renderizan los 4 widgets en orden
- **WHEN** `useDashboardSummary()` resuelve con `{ rol: 'AUDITOR', data }`
- **THEN** se renderizan, en orden, `HallazgosPorNormaWidget`, `HallazgosPorEstadoWidget`, `EvidenciasHallazgosWidget` y `TasaCierrePorAreaWidget`

## ADDED Requirements

### Requirement: HallazgosPorNormaWidget muestra el conteo de hallazgos O3 por norma, sin navegación
`HallazgosPorNormaWidget` (`src/features/dashboard/components/HallazgosPorNormaWidget.tsx`) SHALL renderizar `hallazgosPorNorma: { norma: NormaISO; total: number }[]` (ya ordenado descendentemente por `total`, calculado en `buildHallazgosPorNorma()`) como una lista de filas no interactivas (norma + conteo), sin enlace a `/quality-events` — mismo patrón de no-navegación que el widget anterior. Cada fila SHALL mostrar la etiqueta legible de la norma (`'ISO 9001:2015'`, `'ISO 45001:2018'`, o `'Otra normativa'` para `norma === 'OTRA'`), no el código enum crudo. Todos los QE con `normativaVinculada.norma === 'OTRA'` SHALL agruparse bajo una única fila `'Otra normativa'`, sin desglosar por `normativaVinculada.normaOtraDetalle`.

#### Scenario: Filas ordenadas de mayor a menor conteo
- **WHEN** `hallazgosPorNorma` contiene `[{ norma: 'ISO_45001_2018', total: 1 }, { norma: 'ISO_9001_2015', total: 3 }]` en ese orden de llegada
- **THEN** el widget respeta el orden recibido (la ordenación ya la hizo el backend) mostrando "ISO 9001:2015" antes que "ISO 45001:2018" solo si así viene ordenado el arreglo

#### Scenario: Widget vacío cuando no hay hallazgos O3
- **WHEN** `hallazgosPorNorma` es un arreglo vacío
- **THEN** `HallazgosPorNormaWidget` muestra un estado vacío, no un error

#### Scenario: Ninguna fila es un elemento clicable
- **WHEN** se renderiza `HallazgosPorNormaWidget` con datos
- **THEN** ninguna fila es un `<button>` ni tiene `onClick` — son contenedores estáticos

#### Scenario: norma OTRA se muestra con etiqueta legible y agrupada
- **WHEN** existen dos hallazgos O3 con `normativaVinculada.norma === 'OTRA'`, uno con `normaOtraDetalle: 'SUNAT'` y otro con `normaOtraDetalle: 'MINEM'`
- **THEN** ambos se cuentan en una sola fila con la etiqueta `'Otra normativa'` y `total: 2`, sin filas separadas por `normaOtraDetalle`

## REMOVED Requirements

### Requirement: HallazgosPorAreaWidget muestra el conteo de hallazgos O3 por área, sin navegación
**Reason**: El widget se había descopeado a agrupar por `areaAfectada` por falta de un campo estructurado de normativa en los QE de origen O3. Con `normativaVinculada` ya disponible (ver `quality-event-normativa-catalog` y `quality-event-types`), el widget agrupa por norma real, que es la dimensión que Auditoría necesita para priorizar hallazgos por incumplimiento normativo.
**Migration**: `buildHallazgosPorArea()` se renombra a `buildHallazgosPorNorma()` en `dashboard.handlers.ts`, `AuditorDashboardData['hallazgosPorArea']` se renombra a `hallazgosPorNorma` con la forma `{ norma: NormaISO; total: number }[]`, y el componente `HallazgosPorAreaWidget` se renombra a `HallazgosPorNormaWidget`. `AuditorDashboard.tsx` actualiza su import y el nombre usado en el orden de composición (ver el requirement MODIFIED "AuditorDashboard compone los 4 widgets de auditoría" en este mismo delta). Este cambio no afecta a `TasaCierrePorAreaWidget`, que sigue agrupando por `areaAfectada` para todos los QE (no solo O3) — es una métrica distinta.
