## MODIFIED Requirements

### Requirement: GET /api/dashboard/summary retorna datos filtrados por rol
El handler SHALL registrar `GET /api/dashboard/summary`, resolviendo el usuario autenticado mediante el mismo mecanismo mock-auth usado por otros handlers (header `Authorization`), y determinando el tipo de respuesta con `getDashboardDataTypeForRole(usuario.rol)`. Cuando `usuario.rol === 'OPERARIO'`, SHALL filtrar `misIncidentesReportados`/`misQEReportados` a `reportadoPorId === usuario.id` y `documentosPendientesLectura` a `Documento.area === usuario.area`. Cuando `usuario.rol === 'SUPERVISOR'`, SHALL filtrar todos los datos agregados a QE/Incidentes/NC cuya área esté en `usuario.areasAsignadas`. Los roles `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION` y `AUDITOR_INTERNO` SHALL recibir datos sin filtrar por área (alcance organizacional completo). Cuando `usuario.rol === 'JEFE_CONTROL_DOCUMENTARIO'`, la respuesta SHALL tener `rol: 'JEFE_CONTROL_DOC'` y `data: {}` (vía `buildJefeControlDocumentarioData()`) — ya no comparte la forma de `JefeCalidadDashboardData` ni pasa por `buildJefeCalidadData`. Sin token válido, SHALL retornar 401 con `success: false`.

#### Scenario: OPERARIO recibe solo sus propios reportes
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como un usuario `OPERARIO` con `id: 'user-op-1'`
- **THEN** la respuesta tiene `rol: 'OPERARIO'` y todo elemento de `data.misQEReportados` corresponde a un QE cuyo `reportadoPorId === 'user-op-1'`

#### Scenario: SUPERVISOR recibe datos limitados a areasAsignadas
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areasAsignadas: ['Almacén Norte']`
- **THEN** `data.incidentesRecientes` solo contiene incidentes cuya área (resuelta vía `Local`/`Zona`) o `qePorEstado` solo cuenta QE cuya `areaAfectada === 'Almacén Norte'`

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
