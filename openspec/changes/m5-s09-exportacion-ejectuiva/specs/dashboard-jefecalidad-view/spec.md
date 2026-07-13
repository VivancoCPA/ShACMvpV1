## ADDED Requirements

### Requirement: JefeCalidadDashboard monta el punto de entrada de exportación ejecutiva
`JefeCalidadDashboard.tsx` SHALL montar `ExportButton` (`dashboard-export-ejecutivo`) dentro de `PageWrapper`, visible solo para `JEFE_CALIDAD_SYST`, sin alterar el orden ni comportamiento de `AccionesRequeridasWidget` ni `KpiGridWidget` existentes.

#### Scenario: ExportButton visible en JefeCalidadDashboard
- **WHEN** un usuario `JEFE_CALIDAD_SYST` visualiza `JefeCalidadDashboard` con datos cargados
- **THEN** `ExportButton` está presente en la página

#### Scenario: Widgets existentes no cambian de orden ni comportamiento
- **WHEN** se agrega `ExportButton` a `JefeCalidadDashboard`
- **THEN** `AccionesRequeridasWidget` sigue siendo el primer widget visible y `KpiGridWidget` sigue renderizando las 9 tarjetas de KPI sin cambios
