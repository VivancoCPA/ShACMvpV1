## MODIFIED Requirements

### Requirement: GET /api/dashboard/summary retorna datos filtrados por rol

El handler SHALL registrar `GET /api/dashboard/summary`, resolviendo el usuario autenticado mediante el mismo mecanismo mock-auth usado por otros handlers (header `Authorization`), y determinando el tipo de respuesta con `getDashboardDataTypeForRole(usuario.rol)`. Cuando `usuario.rol === 'OPERARIO'`, SHALL filtrar `misIncidentesReportados`/`misQEReportados` a `reportadoPorId === usuario.id` y `documentosPendientesLectura` a `Documento.areaId === usuario.areaId`. Cuando `usuario.rol === 'SUPERVISOR'`, SHALL filtrar todos los datos agregados a QE/Incidentes/NC cuyo `areaId` esté en `usuario.areaIds`, calculando además: `qeAbiertosPorTipo` (conteo por `QEType` de los QE del área con `estado` distinto de `CERRADO`/`VERIFICADO`), `qesEnVerificacionArea` (QE del área con `estado === 'EN_VERIFICACION'` y `fechaVerificacionProgramada` definido, proyectados a `QEResumen`), `accionesCorrectivasPendientesArea` (ACs del área con `estado` distinto de `CERRADA`, proyectadas a `AccionCorrectivaResumen`, sin exigir vencimiento), y `accionesCorrectivasVencidas` (ACs del área con `estado === 'EN_EJECUCION'` y `plazoFecha` anterior a la fecha actual del sistema — antes de este cambio el filtro aceptaba cualquier estado distinto de `CERRADA`). Los roles `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION` y `AUDITOR_INTERNO` SHALL recibir datos sin filtrar por área (alcance organizacional completo). Cuando `usuario.rol === 'JEFE_CONTROL_DOCUMENTARIO'`, la respuesta SHALL tener `rol: 'JEFE_CONTROL_DOC'` y `data: {}` (vía `buildJefeControlDocumentarioData()`) — ya no comparte la forma de `JefeCalidadDashboardData` ni pasa por `buildJefeCalidadData`. Sin token válido, SHALL retornar 401 con `success: false`. La proyección `toQEResumen` usada para construir cada elemento de `misQEReportados` SHALL incluir `fechaVerificacionProgramada` cuando el `QualityEvent` de origen lo tenga definido.

#### Scenario: OPERARIO recibe solo sus propios reportes

- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como un usuario `OPERARIO` con `id: 'user-op-1'`
- **THEN** la respuesta tiene `rol: 'OPERARIO'` y todo elemento de `data.misQEReportados` corresponde a un QE cuyo `reportadoPorId === 'user-op-1'`

#### Scenario: SUPERVISOR recibe datos limitados a areaIds

- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areaIds: ['area-001']`
- **THEN** `data.incidentesRecientes` solo contiene incidentes cuya área (resuelta vía `Local`/`Zona`) o `qePorEstado` solo cuenta QE cuya `areaId === 'area-001'`

#### Scenario: SUPERVISOR con múltiples áreas ve datos combinados de todas

- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areaIds: ['area-001', 'area-002']`
- **THEN** `data.qeAbiertosPorTipo`, `data.qesEnVerificacionArea` y `data.accionesCorrectivasPendientesArea` incluyen elementos de ambas áreas, y ningún elemento de un área fuera de `areaIds` aparece en la respuesta

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
- **THEN** `data.resumenPorModulo` refleja el conteo total de todos los dominios, sin restricción de área

#### Scenario: Sin token retorna 401

- **WHEN** `GET /api/dashboard/summary` es solicitado sin header `Authorization`
- **THEN** la respuesta status es 401 y `success: false`

#### Scenario: misQEReportados incluye fechaVerificacionProgramada cuando el QE la tiene

- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `OPERARIO` y uno de sus QEs reportados tiene `estado: 'EN_VERIFICACION'` con `fechaVerificacionProgramada: '2026-07-10'`
- **THEN** el elemento correspondiente en `data.misQEReportados` incluye `fechaVerificacionProgramada: '2026-07-10'`

#### Scenario: documentosPendientesLectura de OPERARIO filtra por areaId

- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `OPERARIO` con `areaId: 'area-003'`
- **THEN** `data.documentosPendientesLectura` solo contiene documentos cuyo `areaId === 'area-003'`
