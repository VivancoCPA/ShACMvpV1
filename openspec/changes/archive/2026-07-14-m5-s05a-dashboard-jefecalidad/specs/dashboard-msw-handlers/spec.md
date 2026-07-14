## MODIFIED Requirements

### Requirement: GET /api/dashboard/summary retorna datos filtrados por rol
El handler SHALL registrar `GET /api/dashboard/summary`, resolviendo el usuario autenticado mediante el mismo mecanismo mock-auth usado por otros handlers (header `Authorization`), y determinando el tipo de respuesta con `getDashboardDataTypeForRole(usuario.rol)`. Cuando `usuario.rol === 'OPERARIO'`, SHALL filtrar `misIncidentesReportados`/`misQEReportados` a `reportadoPorId === usuario.id` y `documentosPendientesLectura` a `Documento.area === usuario.area`. Cuando `usuario.rol === 'SUPERVISOR'`, SHALL filtrar todos los datos agregados a QE/Incidentes/NC cuya área esté en `usuario.areasAsignadas`. Los roles `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION` y `AUDITOR_INTERNO` SHALL recibir datos sin filtrar por área (alcance organizacional completo). Sin token válido, SHALL retornar 401 con `success: false`.

Para `JEFE_CALIDAD_SYST` y `JEFE_CONTROL_DOCUMENTARIO`, `buildJefeCalidadData` SHALL calcular `qePorEstado` como el conteo de TODOS los QE del sistema agrupados por `estado` (los 9 valores de `QEStatus`, sin excluir ninguno aunque su conteo sea `0`), y `accionesCorrectivasPorVencer` recolectando acciones correctivas de origen `QE` y `NC` (excluyendo explícitamente `INCIDENTE`, pasando un array vacío de incidentes a `collectACsWithOrigin`) cuyo `estado` no sea `CERRADA` ni `COMPLETADA` y cuyo `plazoFecha` esté a 5 días hábiles o menos de la fecha actual (calculado con `calcularDiasHabilesRestantes`/`calcularEstadoSemaforoFila`, incluye vencidas). El filtro NUNCA SHALL comparar `ac.estado` contra un valor puntual como `'EN_EJECUCION'` — únicamente contra los estados terminales conocidos.

#### Scenario: OPERARIO recibe solo sus propios reportes
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como un usuario `OPERARIO` con `id: 'user-op-1'`
- **THEN** la respuesta tiene `rol: 'OPERARIO'` y todo elemento de `data.misQEReportados` corresponde a un QE cuyo `reportadoPorId === 'user-op-1'`

#### Scenario: SUPERVISOR recibe datos limitados a areasAsignadas
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areasAsignadas: ['Almacén Norte']`
- **THEN** `data.incidentesRecientes` solo contiene incidentes cuya área (resuelta vía `Local`/`Zona`) o `qePorEstado` solo cuenta QE cuya `areaAfectada === 'Almacén Norte'`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO recibe la forma de JefeCalidadDashboardData
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CONTROL_DOCUMENTARIO`
- **THEN** la respuesta tiene `rol: 'JEFE_CALIDAD'` y `data` cumple la forma de `JefeCalidadDashboardData`

#### Scenario: ALTA_DIRECCION recibe datos organizacionales sin filtro de área
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `ALTA_DIRECCION`
- **THEN** `data.resumenPorModulo` refleja el conteo total de todos los dominios, sin restricción de área

#### Scenario: Sin token retorna 401
- **WHEN** `GET /api/dashboard/summary` es solicitado sin header `Authorization`
- **THEN** la respuesta status es 401 y `success: false`

#### Scenario: JEFE_CALIDAD_SYST recibe qePorEstado sin filtro de área
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CALIDAD_SYST`, y existen QE en al menos 2 áreas distintas
- **THEN** `data.data.qePorEstado` cuenta QE de ambas áreas (no solo la del usuario), con las 9 claves de `QEStatus` presentes

#### Scenario: accionesCorrectivasPorVencer excluye ACs de Incidentes
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CALIDAD_SYST`, y existe una AC de un Incidente con `plazoFecha` mañana
- **THEN** esa AC no aparece en `data.data.accionesCorrectivasPorVencer`

#### Scenario: accionesCorrectivasPorVencer incluye vencidas y próximas, nunca por estado puntual
- **WHEN** existen 2 ACs de QE con `estado: 'EN_EJECUCION'` — una con `plazoFecha` de hace 2 días y otra con `plazoFecha` en 3 días — y una AC de NC con `estado: 'PENDIENTE'` y `plazoFecha` en 4 días
- **THEN** las 3 ACs aparecen en `data.data.accionesCorrectivasPorVencer`, confirmando que el filtro es por fecha/estado-terminal y no por un valor de estado específico
