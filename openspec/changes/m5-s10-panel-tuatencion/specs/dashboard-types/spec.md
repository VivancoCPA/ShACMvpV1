## MODIFIED Requirements

### Requirement: Tipos de dashboard específicos por rol
El sistema SHALL definir en `src/features/dashboard/types/dashboardData.types.ts` seis interfaces distintas — `OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData`, `JefeControlDocDashboardData` — cada una reflejando los widgets propios de ese rol, sin un tipo genérico de "widget" compartido entre ellas:
- `OperarioDashboardData`: `misIncidentesReportados: IncidenteResumen[]`, `misQEReportados: QEResumen[]`, `accionesCorrectivasAsignadas: AccionCorrectivaResumen[]`, `documentosPendientesLectura: DocumentoResumen[]`.
- `SupervisorDashboardData`: `kpisArea: KpiResult[]`, `qePorEstado: Record<QEStatus, number>`, `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`, `incidentesRecientes: IncidenteResumen[]`, `semaforoPlazos: { verde: number; amarillo: number; rojo: number }`.
- `JefeCalidadDashboardData`: `kpis: KpiResult[]`, `qeCriticosAbiertos: QEResumen[]`, `ncPendientesVerificacion: NCResumen[]`, `distribucionQEPorTipo: Record<QEType, number>`, `tendenciaMensualCierres: { periodo: string; cerrados: number }[]`.
- `AltaDireccionDashboardData`: `kpisEstrategicos: KpiResult[]`, `resumenPorModulo: { documentos: { total: number; publicados: number; vencidosRevision: number }; noConformidades: { total: number; abiertas: number; cerradas: number }; incidentes: { total: number; conLesionados: number }; qualityEvents: { total: number; criticosAbiertos: number } }`, `alertasCriticas: QEResumen[]`, `tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]`.
- `AuditorDashboardData`: `hallazgosAuditoriaAbiertos: QEResumen[]`, `ncPorOrigenAuditoria: NCResumen[]`, `kpisCumplimiento: KpiResult[]`, `documentosProximaRevision: DocumentoResumen[]`.
- `JefeControlDocDashboardData`: `Record<string, never>` — sin campos propios en v1; el contenido de `JefeControlDocumentarioDashboard` es exclusivamente `AccionesRequeridasWidget`, que no depende de `useDashboardSummary()`. Este tipo existe para preservar el patrón "una interfaz por rol, unión discriminada por `rol`" y queda listo para ganar campos en un spec futuro sin romper la forma de la unión.

#### Scenario: Cada tipo de rol expone solo sus propios widgets
- **WHEN** se compara `OperarioDashboardData` con `AltaDireccionDashboardData`
- **THEN** no comparten ningún campo con el mismo nombre y forma (ambos son interfaces independientes, no una extensión de un tipo base de widgets)

#### Scenario: SupervisorDashboardData no expone KPIs organizacionales completos
- **WHEN** se construye un `SupervisorDashboardData`
- **THEN** `kpisArea` contiene únicamente los `KpiResult` relevantes al alcance de un Supervisor (no los 9 KPIs completos que sí ve `JefeCalidadDashboardData.kpis`)

#### Scenario: JefeControlDocDashboardData no tiene campos requeridos
- **WHEN** un desarrollador construye un `JefeControlDocDashboardData`
- **THEN** `{}` es un valor válido — el tipo no exige ninguna propiedad

---

### Requirement: Discriminated union y mapeo de rol a tipo de dashboard
El sistema SHALL exportar un tipo `DashboardSummaryData` como unión discriminada por el campo `rol` (`'OPERARIO' | 'SUPERVISOR' | 'JEFE_CALIDAD' | 'ALTA_DIRECCION' | 'AUDITOR' | 'JEFE_CONTROL_DOC'`), donde cada variante empareja el valor de `rol` con su interfaz correspondiente (`data: OperarioDashboardData` cuando `rol === 'OPERARIO'`, ..., `data: JefeControlDocDashboardData` cuando `rol === 'JEFE_CONTROL_DOC'`). El sistema SHALL exportar una función `getDashboardDataTypeForRole(rol: UserRole): DashboardSummaryData['rol']` en `src/features/dashboard/utils/dashboardRoleMapping.ts` que mapea los 6 `UserRole` con acceso a `/dashboard` a una de las 6 variantes, mapeando `JEFE_CONTROL_DOCUMENTARIO` a `'JEFE_CONTROL_DOC'` (ya no a `'JEFE_CALIDAD'`).

#### Scenario: OPERARIO mapea a su propio tipo
- **WHEN** se llama `getDashboardDataTypeForRole('OPERARIO')`
- **THEN** retorna `'OPERARIO'`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO mapea a su propio tipo, no a JefeCalidadDashboardData
- **WHEN** se llama `getDashboardDataTypeForRole('JEFE_CONTROL_DOCUMENTARIO')`
- **THEN** retorna `'JEFE_CONTROL_DOC'`

#### Scenario: ADMINISTRADOR_SISTEMA no tiene mapeo
- **WHEN** se llama `getDashboardDataTypeForRole('ADMINISTRADOR_SISTEMA')`
- **THEN** la función retorna `undefined` o lanza, dado que este rol no tiene acceso a `/dashboard`
