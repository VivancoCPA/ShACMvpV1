## MODIFIED Requirements

### Requirement: GET /api/dashboard/summary retorna datos filtrados por rol
El handler SHALL registrar `GET /api/dashboard/summary`, resolviendo el usuario autenticado mediante el mismo mecanismo mock-auth usado por otros handlers (header `Authorization`), y determinando el tipo de respuesta con `getDashboardDataTypeForRole(usuario.rol)`. Cuando `usuario.rol === 'OPERARIO'`, SHALL filtrar `misIncidentesReportados`/`misQEReportados` a `reportadoPorId === usuario.id` y `documentosPendientesLectura` a `Documento.area === usuario.area`. Cuando `usuario.rol === 'SUPERVISOR'`, SHALL filtrar todos los datos agregados a QE/Incidentes/NC cuya área esté en `usuario.areasAsignadas`, calculando además: `qeAbiertosPorTipo` (conteo por `QEType` de los QE del área con `estado` distinto de `CERRADO`/`VERIFICADO`), `qesEnVerificacionArea` (QE del área con `estado === 'EN_VERIFICACION'` y `fechaVerificacionProgramada` definido, proyectados a `QEResumen`), `accionesCorrectivasPendientesArea` (ACs del área con `estado` distinto de `CERRADA`, proyectadas a `AccionCorrectivaResumen`, sin exigir vencimiento), y `accionesCorrectivasVencidas` (ACs del área con `estado === 'EN_EJECUCION'` y `plazoFecha` anterior a la fecha actual del sistema — antes de este cambio el filtro aceptaba cualquier estado distinto de `CERRADA`). Los roles `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION` y `AUDITOR_INTERNO` SHALL recibir datos sin filtrar por área (alcance organizacional completo). Sin token válido, SHALL retornar 401 con `success: false`.

#### Scenario: OPERARIO recibe solo sus propios reportes
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como un usuario `OPERARIO` con `id: 'user-op-1'`
- **THEN** la respuesta tiene `rol: 'OPERARIO'` y todo elemento de `data.misQEReportados` corresponde a un QE cuyo `reportadoPorId === 'user-op-1'`

#### Scenario: SUPERVISOR recibe datos limitados a areasAsignadas
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areasAsignadas: ['Almacén Norte']`
- **THEN** `data.incidentesRecientes` solo contiene incidentes cuya área (resuelta vía `Local`/`Zona`) o `qePorEstado` solo cuenta QE cuya `areaAfectada === 'Almacén Norte'`

#### Scenario: SUPERVISOR con múltiples áreas ve datos combinados de todas
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areasAsignadas: ['Almacén Norte', 'Almacén Sur']`
- **THEN** `data.qeAbiertosPorTipo`, `data.qesEnVerificacionArea` y `data.accionesCorrectivasPendientesArea` incluyen elementos de ambas áreas, y ningún elemento de un área fuera de `areasAsignadas` aparece en la respuesta

#### Scenario: accionesCorrectivasVencidas excluye ACs en estado PENDIENTE
- **WHEN** un `SUPERVISOR` tiene en su área una AC con `estado: 'PENDIENTE'` y `plazoFecha` vencida, y otra con `estado: 'EN_EJECUCION'` también vencida
- **THEN** `data.accionesCorrectivasVencidas` solo contiene la AC en `EN_EJECUCION`; la AC `PENDIENTE` vencida solo aparece en `data.accionesCorrectivasPendientesArea`

#### Scenario: qeAbiertosPorTipo excluye QE cerrados o verificados
- **WHEN** un `SUPERVISOR` tiene en su área un QE de tipo `CALIDAD` con `estado: 'VERIFICADO'`
- **THEN** ese QE no incrementa el conteo de `data.qeAbiertosPorTipo.CALIDAD`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO recibe la forma de JefeCalidadDashboardData
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CONTROL_DOCUMENTARIO`
- **THEN** la respuesta tiene `rol: 'JEFE_CALIDAD'` y `data` cumple la forma de `JefeCalidadDashboardData`

#### Scenario: ALTA_DIRECCION recibe datos organizacionales sin filtro de área
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `ALTA_DIRECCION`
- **THEN** `data.resumenPorModulo` refleja el conteo total de todos los dominios, sin restricción de área

#### Scenario: Sin token retorna 401
- **WHEN** `GET /api/dashboard/summary` es solicitado sin header `Authorization`
- **THEN** la respuesta status es 401 y `success: false`
