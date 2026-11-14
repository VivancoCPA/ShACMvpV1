## ADDED Requirements

### Requirement: AC vencidas del JCA y tipos de acción requerida de cierre
`JefeCalidadDashboardData` (`types/dashboardData.types.ts`) SHALL incluir `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`. `AccionRequeridaTipo` (`types/accionesRequeridas.types.ts`) SHALL incluir `'QE_REGISTRAR_CIERRE'` y `'QE_FIRMAR_CIERRE_JCA'`, y NO SHALL incluir `'QE_CERRAR'`.

#### Scenario: Campo tipado
- **WHEN** `DashboardSummaryData` tiene `rol: 'JEFE_CALIDAD'`
- **THEN** `data.accionesCorrectivasVencidas` es `AccionCorrectivaResumen[]` para TypeScript

#### Scenario: QE_CERRAR no existe
- **WHEN** se asigna `'QE_CERRAR'` a una variable de tipo `AccionRequeridaTipo`
- **THEN** TypeScript reporta un error de tipos
