## MODIFIED Requirements

### Requirement: Tipos de resumen (proyecciones ligeras) para widgets de dashboard
El sistema SHALL definir en `src/features/dashboard/types/dashboardSummary.types.ts` los tipos `QEResumen`, `IncidenteResumen`, `NCResumen`, `DocumentoResumen`, `AccionCorrectivaResumen`, `QEReaperturaResumen` y `ACSolicitudAjustePlazoResumen`, cada uno como una proyección de un subconjunto de campos de su entidad completa (nunca la entidad completa), suficiente para renderizar una fila de widget: identificador, número/código, estado, severidad (cuando aplique), fecha relevante y área. `AccionCorrectivaResumen` SHALL incluir `origenTipo: 'QE' | 'NC' | 'INCIDENTE'` y `origenId: string` para permitir navegar al detalle correcto sin importar de qué dominio proviene la acción correctiva. `QEReaperturaResumen` SHALL extender `QEResumen` agregando `ciclo: number` y `fechaReapertura: string` (ISO 8601). `ACSolicitudAjustePlazoResumen` SHALL tener los campos `qeId: string`, `qeNumero: string`, `qeSeveridad: QESeverity`, `acId: string`, `acDescripcion: string`, `plazoFechaActual: string`, `solicitudAjustePlazo: SolicitudAjustePlazoAC` (tipo definido en `quality-event-types`, re-exportado o importado desde `qualityEvent.types.ts`).

#### Scenario: QEResumen no expone campos internos de análisis de causa raíz
- **WHEN** se construye un `QEResumen`
- **THEN** el tipo no incluye `cincoPorques`, `ishikawa` ni `auditTrail` (campos exclusivos del detalle completo de `QualityEvent`)

#### Scenario: AccionCorrectivaResumen identifica su dominio de origen
- **WHEN** se construye un `AccionCorrectivaResumen` a partir de una acción correctiva de un `Incidente`
- **THEN** `origenTipo === 'INCIDENTE'` y `origenId` es el `id` del incidente padre

#### Scenario: QEReaperturaResumen extiende QEResumen sin duplicar campos
- **WHEN** se construye un `QEReaperturaResumen`
- **THEN** incluye todos los campos de `QEResumen` más `ciclo` y `fechaReapertura`, sin redefinir ninguno de los campos heredados

#### Scenario: ACSolicitudAjustePlazoResumen no expone la AccionCorrectivaQE completa
- **WHEN** se construye un `ACSolicitudAjustePlazoResumen`
- **THEN** el tipo no incluye `descripcionEvidencia`, `evidenciaUrl` ni otros campos de cierre de la AC completa — solo lo necesario para listar y enlazar al QE padre

---

### Requirement: Tipos de dashboard específicos por rol
El sistema SHALL definir en `src/features/dashboard/types/dashboardData.types.ts` cinco interfaces distintas — `OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData` — cada una reflejando los widgets propios de ese rol, sin un tipo genérico de "widget" compartido entre ellas:
- `OperarioDashboardData`: `misIncidentesReportados: IncidenteResumen[]`, `misQEReportados: QEResumen[]`, `accionesCorrectivasAsignadas: AccionCorrectivaResumen[]`, `documentosPendientesLectura: DocumentoResumen[]`.
- `SupervisorDashboardData`: `kpisArea: KpiResult[]`, `qePorEstado: Record<QEStatus, number>`, `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`, `incidentesRecientes: IncidenteResumen[]`, `semaforoPlazos: { verde: number; amarillo: number; rojo: number }`.
- `JefeCalidadDashboardData`: `kpis: KpiResult[]`, `qeCriticosAbiertos: QEResumen[]`, `ncPendientesVerificacion: NCResumen[]`, `distribucionQEPorTipo: Record<QEType, number>`, `tendenciaMensualCierres: { periodo: string; cerrados: number }[]`.
- `AltaDireccionDashboardData`: `kpisEstrategicos: KpiResult[]`, `resumenPorModulo: { documentos: { total: number; publicados: number; vencidosRevision: number }; noConformidades: { total: number; abiertas: number; cerradas: number }; incidentes: { total: number; conLesionados: number }; qualityEvents: { total: number; criticosAbiertos: number; abiertos: number; vencidos: number } }`, `alertasCriticas: QEResumen[]`, `tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]`, `comparativaMensual: Record<'KPI-01' | 'KPI-04' | 'KPI-05', { actual: number; anterior: number; tendencia: 'SUBE' | 'BAJA' | 'ESTABLE' }>`, `reaperturas: QEReaperturaResumen[]`, `acsConSolicitudAjustePlazo: ACSolicitudAjustePlazoResumen[]`.
- `AuditorDashboardData`: `hallazgosAuditoriaAbiertos: QEResumen[]`, `ncPorOrigenAuditoria: NCResumen[]`, `kpisCumplimiento: KpiResult[]`, `documentosProximaRevision: DocumentoResumen[]`.

#### Scenario: Cada tipo de rol expone solo sus propios widgets
- **WHEN** se compara `OperarioDashboardData` con `AltaDireccionDashboardData`
- **THEN** no comparten ningún campo con el mismo nombre y forma (ambos son interfaces independientes, no una extensión de un tipo base de widgets)

#### Scenario: SupervisorDashboardData no expone KPIs organizacionales completos
- **WHEN** se construye un `SupervisorDashboardData`
- **THEN** `kpisArea` contiene únicamente los `KpiResult` relevantes al alcance de un Supervisor (no los 9 KPIs completos que sí ve `JefeCalidadDashboardData.kpis`)

#### Scenario: AltaDireccionDashboardData.resumenPorModulo.qualityEvents distingue abiertos de vencidos
- **WHEN** se construye `AltaDireccionDashboardData.resumenPorModulo.qualityEvents`
- **THEN** `abiertos` cuenta todo QE con `estado !== 'VERIFICADO'` (incluye `REABIERTO`) y `vencidos` es un subconjunto de `abiertos` cuyo plazo por severidad ya venció contra la fecha actual

#### Scenario: AltaDireccionDashboardData.comparativaMensual cubre exactamente KPI-01/04/05
- **WHEN** se inspecciona `Object.keys(altaDireccionData.comparativaMensual)`
- **THEN** el resultado es exactamente `['KPI-01', 'KPI-04', 'KPI-05']`
