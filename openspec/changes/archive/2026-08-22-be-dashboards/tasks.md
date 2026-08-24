## 1. Dominio y persistencia — tablas de carga manual

- [x] 1.1 Crear `ShcMvpEndPoint.Domain/Entities/HorasTrabajadas.cs` (`Id`, `EmpresaId`, `AreaId` string sin FK, `Periodo` string `YYYY-MM`, `Horas` int/decimal, `ActualizadoEn`).
- [x] 1.2 Crear `ShcMvpEndPoint.Domain/Entities/Kpi04ValorAnioAnterior.cs` (`Id`, `EmpresaId`, `Periodo` string `YYYY-MM`, `Valor` decimal, `ActualizadoEn`).
- [x] 1.3 Registrar `DbSet<HorasTrabajadas>` y `DbSet<Kpi04ValorAnioAnterior>` en `ShacDbContext.cs`, con índice único `(empresa_id, area_id, periodo)` y `(empresa_id, periodo)` respectivamente (naming snake_case vía `SnakeCaseModelBuilderExtensions`, mismo patrón que el resto de entidades).
- [x] 1.4 Generar migración EF Core (`dotnet ef migrations add AddDashboardCargaManual`) y verificar el SQL generado (dos tablas nuevas, sin tocar tablas existentes).

## 2. Helpers compartidos de Dashboard

- [x] 2.1 Crear `Features/Dashboard/Shared/DashboardKpiConstants.cs`: puerto de `kpi.constants.ts` — `PLAZO_MAXIMO_QE_DIAS_HABILES` (`Dictionary<QESeveridad,int>`: BAJA=22, MEDIA=17, ALTA=14, CRITICA=10), `PLAZO_MAXIMO_QE_POR_ESTADO_DIAS_HABILES` y `PlazoMaximoQEPorEstado(QEEstado, QESeveridad)` (usado solo por `resumenPorModulo.qualityEvents.vencidos` de ALTA_DIRECCION), y las metas/direcciones de los 9 KPIs (`KpiDefinition`-equivalente: meta, metaTipo, dirección, unidad — ver design.md D5).
- [x] 2.2 Crear `Features/Dashboard/Shared/QEFechaDerivadaResolver.cs`: `FechaCierre(QualityEvent)`, `FechaAnalisisCompletado(QualityEvent)`, `FechaVerificacionRealizada(QualityEvent)`, `FechaEntradaEstadoActual(QualityEvent)` — todos operando sobre `qe.AuditTrail` ya cargado (ver design.md D3, incluida la exclusión explícita de la reapertura `VENCIMIENTO_PLAZO`).
- [x] 2.3 Crear `Features/Dashboard/Shared/DashboardSemaforo.cs`: `CalcularSemaforoAbsoluto(kpiId, valor, meta, direccion)` (genérico ±20%), `CalcularSemaforoKpi04(valor, valorAnioAnterior, metaReduccionPct)`, `CalcularSemaforoKpi08(valor)` (ver design.md, tabla de bandas de la Sección 2 del brief).
- [x] 2.4 Confirmar que `Features/QualityEvents/Shared/AjustePlazoCalculator.ContarDiasHabiles` es reutilizable tal cual (sin cambios) para todos los cálculos de días hábiles de Dashboard.

## 3. `GET /api/dashboard/kpis`

- [x] 3.1 Crear `Features/Dashboard/ObtenerKpis/ObtenerKpisEndpoint.cs`: `MapGet("/api/dashboard/kpis")`, query opcional `periodo`, `RequireAuthorization` con los 6 roles con acceso al dashboard (ver design.md D9), lee `empresaActivaId` de la sesión.
- [x] 3.2 Crear `Features/Dashboard/ObtenerKpis/ObtenerKpisHandler.cs` con `DapperConnectionFactory`: consultas por dominio (QE con su audit trail, NC, Incidentes, las tres tablas de AC, `HorasTrabajadas`, `Kpi04ValorAnioAnterior`) scoped a `empresa_id`, agregación en memoria en C# replicando `calcularKpis` del mock (KPI-01 a KPI-09, cada uno con su propia función privada, mismo criterio de separación que el mock para facilitar tests unitarios de cada fórmula).
- [x] 3.3 Implementar KPI-01/02/03 (`qeCerradosEnPeriodo` + `ContarDiasHabiles` + `FechaCierre` derivada).
- [x] 3.4 Implementar KPI-04 (suma de `HorasTrabajadas` de toda la empresa para el periodo, sin filtrar por área — ver design.md D11; semáforo interanual contra `Kpi04ValorAnioAnterior`).
- [x] 3.5 Implementar KPI-05 (AC de QE+NC excluyendo Incidente, `resultadoVerificacion` no nulo, fecha de verificación — derivada para QE, columna literal para NC — dentro del periodo).
- [x] 3.6 Implementar KPI-06 diferido (`valor: 0` + comentario `// TODO(be-documentos): ...`).
- [x] 3.7 Implementar KPI-07 (`FechaAnalisisCompletado` derivada + `ContarDiasHabiles`).
- [x] 3.8 Implementar KPI-08 (tiempo real, sin filtro de periodo, conteo de AC de los 3 dominios con estado no terminal y `plazoFecha` vencida, semáforo de banda).
- [x] 3.9 Implementar KPI-09 (distribución de QE por área en el periodo, orden descendente, `semaforo: 'INFORMATIVO'`).
- [x] 3.10 Mapear el resultado a `KpiResult` (mismo shape que `kpi.types.ts`: `kpiId, valor, meta, metaTipo, semaforo, periodo, calculadoEn, valorPeriodoAnterior?, distribucion?`).

## 4. `GET /api/dashboard/summary` — infraestructura común

- [x] 4.1 Crear `Features/Dashboard/ObtenerSummary/ObtenerSummaryEndpoint.cs`: `MapGet("/api/dashboard/summary")`, `RequireAuthorization()`, resuelve `empresaActivaId` y rol efectivo de la sesión.
- [x] 4.2 Crear el mapeo de rol interno → shape de resumen (`RolDashboard`), puerto de `dashboardRoleMapping.ts`: `OPERARIO→OPERARIO, SUPERVISOR→SUPERVISOR, JEFE_CALIDAD_SYST→JEFE_CALIDAD, JEFE_CONTROL_DOCUMENTARIO→JEFE_CONTROL_DOC, AUDITOR_INTERNO→AUDITOR, ALTA_DIRECCION→ALTA_DIRECCION`; sin entrada para `SUPERADMIN`/`ADMINISTRADOR_EMPRESA`/`ADMINISTRADOR_SISTEMA` → 403.
- [x] 4.3 Crear `Features/Dashboard/ObtenerSummary/ObtenerSummaryHandler.cs` con `DapperConnectionFactory`, despachando al builder correspondiente según el rol resuelto (ver 4.2), reutilizando los helpers de la sección 2 y las funciones de KPI de la sección 3 donde aplique (`kpisArea` de SUPERVISOR, `kpis`/`kpisEstrategicos` de JEFE_CALIDAD/ALTA_DIRECCION).
- [x] 4.4 Definir los DTOs de resumen por rol en `Features/Dashboard/ObtenerSummary/DashboardSummaryDtos.cs` (`OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData`, objeto vacío para `JefeControlDoc`), puerto exacto de `dashboardData.types.ts`/`dashboardSummary.types.ts` (incluidos `QEResumen`, `IncidenteResumen`, `NCResumen`, `DocumentoResumen`, `AccionCorrectivaResumen`, `QEReaperturaResumen`, `ACSolicitudAjustePlazoResumen`).

## 5. `GET /api/dashboard/summary` — resumen por rol

- [x] 5.1 Implementar `BuildOperarioData`: `misIncidentesReportados`/`misQEReportados` (filtro `reportadoPorId`), `accionesCorrectivasAsignadas` (filtro `responsableId` sobre AC de los 3 dominios), `documentosPendientesLectura: []` (diferido).
- [x] 5.2 Implementar `BuildSupervisorData`: filtro por `usuario.AreaIds`, `qePorEstado`, `qeAbiertosPorTipo` (excluye CERRADO/VERIFICADO), `qesEnVerificacionArea`, `accionesCorrectivasPendientesArea`/`accionesCorrectivasVencidas` (**corregido en implementación**: cualquier AC no terminal —`PENDIENTE` o `EN_EJECUCION`— vencida, no solo `EN_EJECUCION`; el brief afirmaba lo contrario pero el mock real no distingue, ver spec.md), `incidentesRecientes` (top 10 por `fechaEvento`), `semaforoPlazos` (verde/amarillo/rojo sobre AC pendientes), `kpisArea` (subconjunto KPI-02/03/04/05/07 de la sección 3, sobre datos de TODA la empresa, no filtrados por área — mismo comportamiento que el mock).
- [x] 5.3 Implementar `BuildJefeCalidadData`: alcance organizacional completo, `qeCriticosAbiertos`, `ncPendientesVerificacion` (NC `CERRADA` sin `resultadoVerificacion`), `distribucionQEPorTipo`, `qePorEstado` (8 estados inicializados en 0), `accionesCorrectivasPorVencer` (AC de QE+NC con ≤5 días hábiles restantes, excluye Incidente), `tendenciaMensualVolumen` (12 meses), `tendenciaMensualKpis` (KPI-01/04/05 × 12 meses).
- [x] 5.4 Implementar `BuildAltaDireccionData`: `resumenPorModulo` (documentos siempre en cero — ver design.md D7; noConformidades/incidentes/qualityEvents reales, incluido `qualityEvents.vencidos` vía `FechaEntradaEstadoActual` + `PlazoMaximoQEPorEstado`), `alertasCriticas`, `tendenciaTrimestral` (4 trimestres, QE+NC cerrados por `FechaCierre`/`NC.FechaCierre`), `comparativaMensual` (KPI-01/04/05, mes actual vs anterior, clasificación SUBE/BAJA/ESTABLE), `reaperturas` (QE `ciclo>1`, fecha de última entrada `REABIERTO`), `acsConSolicitudAjustePlazo` (QE ALTA/CRITICA con solicitud `PENDIENTE`).
- [x] 5.5 Implementar `BuildAuditorData`: QE con `origen: O3_HALLAZGO_AUDITORIA`, `hallazgosPorNorma` (agrupado por `NormativaVinculadaRef.Norma`, default `OTRA`), `hallazgosPorEstado` (8 estados en 0), `evidenciasHallazgos: { conEvidencia: 0, sinEvidencia: total }` (diferido — ver design.md D8), `tasaCierreEnPlazoPorArea` (hallazgos cerrados el mes actual, agrupados por área, orden ascendente por tasa).
- [x] 5.6 Implementar `BuildJefeControlDocumentarioData`: retorna objeto vacío `{}`.

## 6. Carga manual — endpoints de escritura

- [x] 6.1 Crear `Features/Dashboard/CargarHorasTrabajadas/` (`Command`, `Endpoint` con `MapPost`/`MapPut` gateado a `RequireRole(nameof(UserRole.SUPERADMIN))`, `Handler` con EF Core haciendo upsert por `(empresaId, areaId, periodo)`, `Validator` con `Matches(@"^\d{4}-\d{2}$")` para `periodo` y `horas >= 0`).
- [x] 6.2 Crear `Features/Dashboard/CargarKpi04AnioAnterior/` (mismo patrón: `Command`, `Endpoint` gateado a `SUPERADMIN`, `Handler` con upsert EF Core por `(empresaId, periodo)`, `Validator`).
- [x] 6.3 Registrar ambos endpoints en el `Map`/composición de rutas del proyecto (mismo lugar donde se registran `Features/Empresas/*Endpoint.Map`).

## 7. Registro y composición

- [x] 7.1 Registrar los 4 endpoints nuevos (`ObtenerKpisEndpoint`, `ObtenerSummaryEndpoint`, `CargarHorasTrabajadasEndpoint`, `CargarKpi04AnioAnteriorEndpoint`) en el punto de composición de rutas (`Program.cs` o el extension method equivalente ya usado por el resto de módulos).
- [x] 7.2 Registrar los handlers nuevos en el contenedor de DI si el proyecto los registra explícitamente (verificar patrón real usado por `ObtenerQualityEventHandler`/`ResetPinHandler`).

## 8. Tests

- [x] 8.1 Tests unitarios de cada fórmula de KPI, los semáforos y `QEFechaDerivadaResolver` sobre datos en memoria, sin base de datos (`DashboardKpiCalculatorTests.cs`, 24 tests) — cubre KPI-01/02/03/04/05/08/09, semáforo genérico, KPI-04, KPI-08, y la derivación de fechas de QE (incluida la exclusión de `VENCIMIENTO_PLAZO`).
- [x] 8.2 Test de integración de KPI-01 sobre un QE cerrado (`DashboardKpisEndpointTests.Kpis_QeCerradoEnPeriodo_...`) — **simplificado respecto al plan**: en vez de recorrer la máquina de estados completa vía `TransicionarEstadoQE` (ya cubierta por `QualityEventsStateMachineEndpointTests`/`QualityEventsCierreEndpointTests`), se sembró directamente la fila `QualityEventAuditTrail` de `ESTADO_CAMBIADO→CERRADO` — el objetivo de este test es la integración Dapper+derivación, no re-probar la máquina de estados.
- [x] 8.3 Cubierto a nivel unitario (`FechaVerificacionRealizada_ExcluyeReaperturaPorVencimientoDePlazo`/`_CuentaReaperturaPorResultadoNoEfectivo` en `DashboardKpiCalculatorTests.cs`) en vez de vía HTTP end-to-end — la lógica de exclusión es pura (`QEFechaDerivadaResolver`), un test HTTP adicional sería redundante.
- [x] 8.4 Test de integración por cada shape de rol de `GET /api/dashboard/summary` (`DashboardSummaryEndpointTests.cs`) — OPERARIO, SUPERVISOR, JEFE_CALIDAD, JEFE_CONTROL_DOC, ALTA_DIRECCION, AUDITOR, más 403 para SUPERADMIN/ADMINISTRADOR_EMPRESA/ADMINISTRADOR_SISTEMA.
- [x] 8.5 Test de aislamiento multi-tenant para KPIs (`Kpis_AislamientoMultiTenant_NoIncluyeQeDeOtraEmpresa`) — cobertura de NC/Incidentes/HorasTrabajadas/Kpi04AnioAnterior queda implícita en el mismo mecanismo de scoping (`empresa_id = @EmpresaId` en cada query de `DashboardDataFetcher`), no se replicó un test por dominio.
- [x] 8.6 Tests de los dos endpoints de carga manual (`DashboardCargaManualEndpointTests.cs`): upsert exitoso, corrección de valor existente, 403 para rol no `SUPERADMIN`, 400 por `periodo` inválido.
- [x] 8.7 `dotnet test` completo: 253/253 en verde (44 nuevos de Dashboard + 209 preexistentes, sin regresiones).

## 9. Cierre

- [x] 9.1 Ver `docs/SESSION-SUMMARY-dashboard.md`.
- [ ] 9.2 Pendiente de confirmación humana — ver "Open Questions" de design.md (gate de rol de `/api/dashboard/kpis`, único punto que sigue abierto) y la corrección de `accionesCorrectivasVencidas` del Supervisor en `specs/be-dashboard-api/spec.md`.

## 10. Fix post-implementación — `NoConformidad.FechaCierre` en `tendenciaTrimestral.ncCerradas`

Addendum de Cowork tras revisar `be-dashboards` sin archivar todavía — confirmó como bug real (no solo discrepancia teórica) el uso de `NoConformidad.FechaCierre` (fecha límite esperada) en vez de la fecha real de cierre. Ver design.md D13, proposal.md Impact #2 (resuelta), specs/be-dashboard-api/spec.md (requirement "Resumen ALTA_DIRECCION").

- [x] 10.1 Crear `Features/Dashboard/Shared/NCFechaDerivadaResolver.cs` — `FechaCierreReal(NoConformidad)`, misma lógica que `QEFechaDerivadaResolver` (última entrada de `NoConformidadAuditTrail` con `CampoModificado == "estado" && ValorNuevo == "CERRADA"`).
- [x] 10.2 Actualizar `DashboardDataFetcher.FetchNoConformidadesAsync` para cargar también `NoConformidad.AuditTrail` (antes no se cargaba).
- [x] 10.3 Actualizar `DashboardSummaryBuilder.BuildAltaDireccion` (`tendenciaTrimestral`) para usar `NCFechaDerivadaResolver.FechaCierreReal(nc)` en vez de `nc.FechaCierre` literal.
- [x] 10.4 Tests: 3 unitarios nuevos (`FechaCierreReal_*` en `DashboardKpiCalculatorTests.cs`) + 1 de integración (`Summary_AltaDireccion_TendenciaTrimestral_NcCerradas_UsaFechaRealDeCierreNoLaFechaLimite`, que prueba explícitamente que una NC con `fechaCierre` a un año de distancia pero cerrada realmente hoy cuenta en el trimestre actual).
- [x] 10.5 `dotnet test` completo: 257/257 en verde (253 previos + 4 nuevos).
- [x] 10.6 `docs/SESSION-SUMMARY-dashboard.md` actualizado con este fix.
