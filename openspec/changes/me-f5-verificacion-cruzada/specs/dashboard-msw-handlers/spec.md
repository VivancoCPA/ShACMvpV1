## MODIFIED Requirements

### Requirement: GET /api/dashboard/kpis calcula los 9 KPIs sobre datos en vivo
El handler SHALL registrar `GET /api/dashboard/kpis`, aceptando un query param opcional `periodo` (`'YYYY-MM'`, default el mes actual del sistema). Antes de cualquier cálculo, SHALL acotar `getQeStore()`, `getDocumentsStore()`, `getNonconformitiesStore()` y `getIncidentsStore()` a los elementos cuyo `empresaId` coincide con la empresa activa de la sesión (`getActiveEmpresaId()`) — mismo mecanismo ya usado por los handlers de dominio individuales. SHALL calcular cada uno de los 9 `KpiResult` de `KPI_DEFINITIONS` usando esos datos ya acotados por empresa más `horasTrabajadasFixtures` y `kpi04AnioAnteriorFixtures`, según las fórmulas de SHAC-PRD-003 §5.2 (ver `design.md` de este change), con `contarDiasHabiles` (no diferencia de milisegundos) para todo KPI en días. Para los 7 KPIs con `metaTipo: 'ABSOLUTO'` y `unidad` distinta de `CONTEO` con banda propia, SHALL asignar `semaforo: 'VERDE'` cuando el valor cumple la `meta`, `'AMARILLO'` cuando está dentro del 20% de desviación de la meta, y `'ROJO'` en cualquier otro caso. La respuesta SHALL ser un `ApiResponse<KpiResult[]>` con exactamente 9 elementos, uno por `KpiId`.

#### Scenario: Respuesta contiene los 9 KpiResult
- **WHEN** `GET /api/dashboard/kpis` es solicitado sin `periodo`
- **THEN** `data.data.length === 9` y cada `kpiId` de `KPI_DEFINITIONS` aparece exactamente una vez

#### Scenario: KPI-02 usa días hábiles, no calendario
- **WHEN** `GET /api/dashboard/kpis?periodo=2026-03` es solicitado y existe un QE cerrado en marzo 2026 cuyo `fechaCierre - fechaHoraReporte` cruza un fin de semana
- **THEN** el `valor` de `KPI-02` se calcula con `contarDiasHabiles`, excluyendo sábados y domingos del conteo

#### Scenario: Semáforo ROJO cuando el valor está lejos de la meta
- **WHEN** el valor calculado de un KPI con `metaTipo: 'ABSOLUTO'`, `unidad: 'PORCENTAJE'` y `meta: 90` es `50`
- **THEN** `semaforo === 'ROJO'` en el `KpiResult` correspondiente

#### Scenario: Sin datos en el periodo retorna KpiResult con valor 0, no un error
- **WHEN** `GET /api/dashboard/kpis?periodo=2020-01` es solicitado para un periodo sin fixtures de ningún dominio
- **THEN** la respuesta es 200 con los 9 `KpiResult`, cada uno con `valor: 0` (excepto `KPI-08`, que ignora `periodo` — ver requisito de KPI-08)

#### Scenario: KPIs no mezclan datos de otra empresa (RN-EMP-004)
- **WHEN** la empresa activa es `empresa-001` y existen QE/Documentos/NC/Incidentes con `empresaId: 'empresa-002'` que, de incluirse, cambiarían el resultado de algún KPI (p.ej. `KPI-01` o `KPI-09`)
- **THEN** ningún `KpiResult` de la respuesta refleja esos registros de `empresa-002`

#### Scenario: Dos empresas con el mismo periodo obtienen KPIs independientes
- **WHEN** `GET /api/dashboard/kpis?periodo=2026-03` es solicitado primero autenticado contra `empresa-001` y luego contra `empresa-002`, sin cambios de datos entre ambas llamadas salvo pertenecer a empresas distintas
- **THEN** los dos conjuntos de `KpiResult` se calculan cada uno solo sobre los registros de su propia empresa

---

### Requirement: GET /api/dashboard/summary retorna datos filtrados por rol
El handler SHALL registrar `GET /api/dashboard/summary`, resolviendo el usuario autenticado mediante el mismo mecanismo mock-auth usado por otros handlers (header `Authorization`), y determinando el tipo de respuesta con `getDashboardDataTypeForRole(usuario.rol)`. Antes de aplicar cualquier filtro por rol, SHALL acotar `getQeStore()`, `getDocumentsStore()`, `getNonconformitiesStore()` y `getIncidentsStore()` a los elementos cuyo `empresaId` coincide con la empresa activa de la sesión (`getActiveEmpresaId()`). Cuando `usuario.rol === 'OPERARIO'`, SHALL filtrar `misIncidentesReportados`/`misQEReportados` a `reportadoPorId === usuario.id` y `documentosPendientesLectura` a `Documento.areaId === usuario.areaId`. Cuando `usuario.rol === 'SUPERVISOR'`, SHALL filtrar todos los datos agregados a QE/Incidentes/NC cuyo `areaId` esté en `usuario.areaIds`, calculando además: `qeAbiertosPorTipo` (conteo por `QEType` de los QE del área con `estado` distinto de `CERRADO`/`VERIFICADO`), `qesEnVerificacionArea` (QE del área con `estado === 'EN_VERIFICACION'` y `fechaVerificacionProgramada` definido, proyectados a `QEResumen`), `accionesCorrectivasPendientesArea` (ACs del área con `estado` distinto de `CERRADA`, proyectadas a `AccionCorrectivaResumen`, sin exigir vencimiento), y `accionesCorrectivasVencidas` (ACs del área con `estado === 'EN_EJECUCION'` y `plazoFecha` anterior a la fecha actual del sistema — antes de este cambio el filtro aceptaba cualquier estado distinto de `CERRADA`). Los roles `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION` y `AUDITOR_INTERNO` SHALL recibir datos sin filtrar por área — "alcance organizacional completo" significa toda la empresa activa, nunca datos de otra empresa. Cuando `usuario.rol === 'JEFE_CONTROL_DOCUMENTARIO'`, la respuesta SHALL tener `rol: 'JEFE_CONTROL_DOC'` y `data: {}` (vía `buildJefeControlDocumentarioData()`) — ya no comparte la forma de `JefeCalidadDashboardData` ni pasa por `buildJefeCalidadData`. Sin token válido, SHALL retornar 401 con `success: false`. La proyección `toQEResumen` usada para construir cada elemento de `misQEReportados` SHALL incluir `fechaVerificacionProgramada` cuando el `QualityEvent` de origen lo tenga definido.

#### Scenario: OPERARIO recibe solo sus propios reportes
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como un usuario `OPERARIO` con `id: 'user-op-1'`
- **THEN** la respuesta tiene `rol: 'OPERARIO'` y todo elemento de `data.misQEReportados` corresponde a un QE cuyo `reportadoPorId === 'user-op-1'`

#### Scenario: SUPERVISOR recibe datos limitados a areaIds
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areaIds: ['area-001']`
- **THEN** `data.incidentesRecientes` solo contiene incidentes cuya área (resuelta vía `Local`/`Zona`) o `qePorEstado` solo cuenta QE cuya `areaId === 'area-001'`

#### Scenario: SUPERVISOR con múltiples áreas ve datos combinados de todas
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areaIds: ['area-001', 'area-002']`
- **THEN** `data.qeAbiertosPorTipo`, `data.qesEnVerificacionArea` y `data.accionesCorrectivasPendientesArea` incluyen elementos de ambas áreas, y ningún elemento de un área fuera de `areaIds` aparece en la respuesta

#### Scenario: documentosPendientesLectura de OPERARIO filtra por areaId
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `OPERARIO` con `areaId: 'area-003'`
- **THEN** `data.documentosPendientesLectura` solo contiene documentos cuyo `areaId === 'area-003'`

#### Scenario: accionesCorrectivasVencidas excluye ACs en estado PENDIENTE
- **WHEN** un `SUPERVISOR` tiene en su área una AC con `estado: 'PENDIENTE'` y `plazoFecha` vencida, y otra con `estado: 'EN_EJECUCION'` también vencida
- **THEN** `data.accionesCorrectivasVencidas` solo contiene la AC en `EN_EJECUCION`; la AC `PENDIENTE` vencida solo aparece en `data.accionesCorrectivasPendientesArea`

#### Scenario: qeAbiertosPorTipo excluye QE cerrados o verificados
- **WHEN** un `SUPERVISOR` tiene en su área un QE de tipo `CALIDAD` con `estado: 'VERIFICADO'`
- **THEN** ese QE no incrementa el conteo de `data.qeAbiertosPorTipo.CALIDAD`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO recibe su propia forma de datos
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CONTROL_DOCUMENTARIO`
- **THEN** la respuesta tiene `rol: 'JEFE_CONTROL_DOC'` y `data` es un objeto vacío (`{}`) — no la forma de `JefeCalidadDashboardData`

#### Scenario: JEFE_CALIDAD_SYST sigue recibiendo JefeCalidadDashboardData sin la rama especial de Control Documentario
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CALIDAD_SYST`
- **THEN** la respuesta tiene `rol: 'JEFE_CALIDAD'` y `data.qeCriticosAbiertos` refleja todos los QE críticos abiertos organizacionales (sin el vaciado condicional que antes aplicaba cuando el usuario era `JEFE_CONTROL_DOCUMENTARIO`)

#### Scenario: ALTA_DIRECCION recibe datos organizacionales sin filtro de área
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `ALTA_DIRECCION`
- **THEN** `data.resumenPorModulo` refleja el conteo total de todos los dominios de la empresa activa, sin restricción de área

#### Scenario: Sin token retorna 401
- **WHEN** `GET /api/dashboard/summary` es solicitado sin header `Authorization`
- **THEN** la respuesta status es 401 y `success: false`

#### Scenario: misQEReportados incluye fechaVerificacionProgramada cuando el QE la tiene
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `OPERARIO` y uno de sus QEs reportados tiene `estado: 'EN_VERIFICACION'` con `fechaVerificacionProgramada: '2026-07-10'`
- **THEN** el elemento correspondiente en `data.misQEReportados` incluye `fechaVerificacionProgramada: '2026-07-10'`

#### Scenario: ALTA_DIRECCION nunca ve datos de otra empresa (RN-EMP-004)
- **WHEN** un usuario `ALTA_DIRECCION` con empresa activa `empresa-001` solicita `GET /api/dashboard/summary`, y existen QE/Documentos/NC/Incidentes con `empresaId: 'empresa-002'`
- **THEN** ningún elemento de `data.resumenPorModulo` ni de ningún otro campo de la respuesta corresponde a un registro de `empresa-002`

#### Scenario: Cambiar de empresa activa cambia por completo el resumen
- **WHEN** un usuario con acceso a `empresa-001` y `empresa-002` solicita `GET /api/dashboard/summary` estando en `empresa-001`, cambia su empresa activa a `empresa-002`, y vuelve a solicitar `GET /api/dashboard/summary`
- **THEN** la segunda respuesta refleja únicamente datos de `empresa-002`, sin ningún elemento remanente de `empresa-001`

## ADDED Requirements

### Requirement: Todas las agregaciones de dashboard.handlers.ts están acotadas a la empresa activa (RN-EMP-004)
`dashboard.handlers.ts` SHALL definir su propia copia local de `getActiveEmpresaId()` (mismo patrón usado por `quality-events.handlers.ts`, `documents.handlers.ts`, `incidents.handlers.ts`, `nonconformities.handlers.ts` y `locales.handlers.ts`) y SHALL leer los stores de dominio exclusivamente a través de wrappers locales (`scopedQes()`, `scopedDocs()`, `scopedNcs()`, `scopedIncidentes()`) que aplican `.filter(x => x.empresaId === getActiveEmpresaId())` sobre `getQeStore()`/`getDocumentsStore()`/`getNonconformitiesStore()`/`getIncidentsStore()` respectivamente. Ninguna función interna del archivo (incluyendo `calcularKpis`, `buildAuditorData`, `buildAltaDireccionData`, y el cálculo de tendencia mensual) SHALL leer un getter de store de dominio sin pasar por su wrapper `scoped*()` correspondiente.

#### Scenario: buildAuditorData no agrega hallazgos de otra empresa
- **WHEN** un `AUDITOR_INTERNO` con empresa activa `empresa-001` solicita `GET /api/dashboard/summary`
- **THEN** `data` (vía `buildAuditorData`) no incluye hallazgos, hallazgos por área, ni tasas de cierre calculadas sobre QE/NC de `empresa-002`

#### Scenario: buildAltaDireccionData no agrega QEs de otra empresa
- **WHEN** `ALTA_DIRECCION` con empresa activa `empresa-001` solicita `GET /api/dashboard/summary`
- **THEN** los conteos de QEs abiertos/vencidos, la comparativa mensual, las reaperturas y las ACs con solicitud de ajuste de plazo pendiente (vía `buildAltaDireccionData`) excluyen cualquier registro de `empresa-002`

#### Scenario: Verificación de código — ningún call site de los 4 getters de store queda sin pasar por scoped*()
- **WHEN** se audita `dashboard.handlers.ts` buscando llamadas directas a `getQeStore()`, `getDocumentsStore()`, `getNonconformitiesStore()` o `getIncidentsStore()`
- **THEN** la única llamada directa a cada getter ocurre dentro de su respectivo wrapper `scoped*()`; el resto del archivo solo invoca los wrappers
