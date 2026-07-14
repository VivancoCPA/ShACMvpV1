## ADDED Requirements

### Requirement: Widget de mapa de calor de Incidentes por local
El dashboard SHALL ofrecer un widget de solo lectura que muestre la
distribución de Incidentes sobre el plano PNG de un local seleccionado,
agrupados por proximidad mediante `computeClusters` de
`IncidentMapCanvas` (M3-S05), reutilizando ese componente sin
modificarlo.

#### Scenario: Local con 6 incidentes agrupados en una zona
- **WHEN** el usuario selecciona un local que tiene 6 incidentes con
  `ubicacion` dentro de la misma zona de proximidad (radio `CLUSTER_RADIUS`)
  en el período seleccionado
- **THEN** el widget renderiza un marcador grande rojo en esa zona
  (umbral ≥5 de `getMarkerStyle`)

#### Scenario: Hover muestra tooltip con detalle del grupo
- **WHEN** el usuario pasa el cursor sobre un grupo de 3 incidentes
- **THEN** el tooltip muestra conteo=3, zona y tipo de incidente más
  frecuente del grupo, con estilos legibles en light y dark mode

#### Scenario: Sin drill-down a incidente individual
- **WHEN** el usuario hace clic en un marcador o grupo
- **THEN** el widget no navega ni abre ningún panel lateral —
  `onGroupClick` es un no-op en este contexto

### Requirement: Selector de local aislado de los KPIs del dashboard
El widget SHALL exponer un selector de local (locales `activo: true` de
`useLocales()`, default el primero) cuyo cambio SHALL afectar únicamente
los datos renderizados dentro del propio widget.

#### Scenario: Cambiar de local no altera los KPIs del dashboard
- **WHEN** el usuario cambia el local seleccionado en el widget
- **THEN** los valores de KPI-01 a KPI-09 del resto del dashboard
  permanecen sin cambios y `useDashboardSummary` no se refetch por esta
  acción

#### Scenario: Local por defecto
- **WHEN** el widget se monta por primera vez
- **THEN** el local seleccionado por defecto es el primer local `activo`
  devuelto por `useLocales()`, igual que en `IncidentMapView`

### Requirement: Selector de período propio del widget
El widget SHALL exponer un selector de período independiente del resto
del dashboard, con opciones de 3, 6 y 12 meses y valor por defecto de 6
meses, siguiendo el mismo patrón de UI que `TendenciaMensualWidget`
(`role="group"`, botones con `aria-pressed`).

#### Scenario: Filtrado por período seleccionado
- **WHEN** el usuario selecciona el rango de 3 meses
- **THEN** solo los incidentes cuyo `fechaEvento` cae dentro de los
  últimos 3 meses se consideran para el clustering y el badge de
  exclusión

#### Scenario: Valor por defecto del período
- **WHEN** el widget se monta por primera vez
- **THEN** el período seleccionado es 6 meses

### Requirement: Estado vacío explícito sin incidentes en el período
El widget SHALL delegar en `IncidentMapCanvas` el renderizado de un
estado vacío explícito cuando el local seleccionado no tiene incidentes
con `ubicacion` dentro del período filtrado.

#### Scenario: Local sin incidentes geolocalizados en el período
- **WHEN** el local seleccionado no tiene incidentes con `ubicacion`
  dentro del período seleccionado
- **THEN** el widget muestra el estado vacío `map.noIncidents` de
  `IncidentMapCanvas`, no un plano en blanco silencioso ni un error

### Requirement: Badge de incidentes sin ubicación registrada
El widget SHALL mostrar un contador de incidentes del local y período
seleccionados que no tienen `ubicacion` registrada, calculado sobre el
mismo array filtrado por período que se pasa a `IncidentMapCanvas`.

#### Scenario: Incidentes sin ubicación se cuentan y no se pierden silenciosamente
- **WHEN** el local y período seleccionados incluyen 4 incidentes sin
  `ubicacion` registrada
- **THEN** el widget muestra un badge "4 incidentes sin ubicación
  registrada en el período" y esos incidentes no aparecen en el mapa

### Requirement: Visibilidad del widget restringida por rol
El widget SHALL ser visible únicamente para los roles ALTA_DIRECCION y
JEFE_CALIDAD_SYST (identificado en el dashboard como `'JEFE_CALIDAD'`),
montado dentro de la rama ya protegida por rol de cada página de
dashboard, sin introducir un guard de rol nuevo.

#### Scenario: Visible para Alta Dirección
- **WHEN** un usuario con rol ALTA_DIRECCION visualiza su dashboard
- **THEN** el widget de mapa de calor aparece después de
  `ACsExtensionPlazoWidget`

#### Scenario: Visible para Jefe de Calidad/SyST
- **WHEN** un usuario con `data.rol === 'JEFE_CALIDAD'` visualiza su
  dashboard
- **THEN** el widget de mapa de calor aparece después de
  `TendenciaMensualWidget`

#### Scenario: Ausente para otros roles
- **WHEN** un usuario con rol OPERARIO, SUPERVISOR, AUDITOR_INTERNO,
  JEFE_CONTROL_DOCUMENTARIO o ADMINISTRADOR_SISTEMA visualiza cualquier
  dashboard
- **THEN** el widget de mapa de calor no se renderiza en ningún
  dashboard
