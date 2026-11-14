## MODIFIED Requirements

### Requirement: AltaDireccionDashboard compone los widgets ejecutivos en orden fijo
El componente `AltaDireccionDashboard` (`src/features/dashboard/pages/AltaDireccionDashboard.tsx`) SHALL consumir `useDashboardSummary()` y `useDashboardKpis(periodo)`, con el `periodo` de `usePeriodoKpi()`, y componer `DashboardLayout` así:
- **alertas**:
  - "QE críticos activos" (error; enlace): `valor` = `alertasCriticas.length`; lleva a `/quality-events?severidad=CRITICA`.
  - "Reaperturas del período" (warning; enlace): `valor` = las `reaperturas` cuya `fechaReapertura` cae en el rango del período elegido; lleva a `/quality-events?soloReincidencias=true`.
  - "Extensiones de plazo por aprobar" (`extensiones`; warning; selectora): `valor` = `filtrarSolicitudesGerenciaPendientes(acsConSolicitudAjustePlazo).length`, es decir, las AC con una solicitud `PENDIENTE` que requiere aprobación de Gerencia. Al hacer clic, hace scroll a `ACsExtensionPlazoWidget`, que renderiza **ese mismo arreglo**.
- **indicadores:** `KpisEjecutivosWidget`, con `PeriodoSelector`.
- **trabajoPrincipal:** `AccionesRequeridasWidget` (montado fuera del bloque condicional de carga, cubierto por `dashboard-acciones-requeridas`) y `ComparativaMensualWidget`.
- **trabajoLateral:** `QEsCriticosWidget`, `ReaperturasWidget` y `ACsExtensionPlazoWidget` (`id="acs-extension-plazo"`). `ACsExtensionPlazoWidget` recibe el arreglo ya filtrado por `filtrarSolicitudesGerenciaPendientes` y no vuelve a filtrar.
- **mapa:** `HeatmapIncidentesWidget`.

Mientras `isLoading` es verdadero o `data.rol !== 'ALTA_DIRECCION'`, las zonas que dependen del summary SHALL mostrar `WidgetSkeleton`.

#### Scenario: Carga muestra skeletons
- **WHEN** `useDashboardSummary()` está en `isLoading`
- **THEN** `AltaDireccionDashboard` renderiza skeletons para los widgets que dependen del summary, sin bloquear `AccionesRequeridasWidget`

#### Scenario: Datos cargados renderizan los widgets en sus zonas
- **WHEN** `useDashboardSummary()` resuelve con `{ rol: 'ALTA_DIRECCION', data }`
- **THEN** se renderizan 3 alertas; `KpisEjecutivosWidget` en "Indicadores"; `AccionesRequeridasWidget` y `ComparativaMensualWidget` en la columna principal; `QEsCriticosWidget`, `ReaperturasWidget` y `ACsExtensionPlazoWidget` en la lateral; y `HeatmapIncidentesWidget` en "Dónde ocurre"

#### Scenario: Reaperturas del período
- **WHEN** el período es `mes` (noviembre de 2026) y `reaperturas` tiene una con `fechaReapertura` el 2026-11-03 y otra el 2026-10-20
- **THEN** la alerta "Reaperturas del período" muestra `1`

#### Scenario: Extensiones cuenta lo mismo que muestra la lista
- **WHEN** `acsConSolicitudAjustePlazo` tiene 3 AC: una con solicitud `PENDIENTE` que requiere Gerencia, una con solicitud `PENDIENTE` que no la requiere y otra con solicitud `APROBADA`
- **THEN** la alerta "Extensiones de plazo por aprobar" muestra `1`, y `ACsExtensionPlazoWidget` muestra 1 fila

#### Scenario: Clic en extensiones selecciona la tarjeta
- **WHEN** el usuario hace clic en "Extensiones de plazo por aprobar"
- **THEN** la URL tiene `alerta=extensiones` y la tarjeta tiene `aria-pressed="true"`
