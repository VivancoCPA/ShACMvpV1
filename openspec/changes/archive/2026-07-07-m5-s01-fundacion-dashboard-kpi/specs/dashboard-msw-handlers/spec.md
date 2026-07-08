## ADDED Requirements

### Requirement: Getters de store en vivo expuestos por cada módulo de dominio
`quality-events.handlers.ts` SHALL exportar `getQeStore(): QualityEvent[]`, `documents.handlers.ts` SHALL exportar `getDocumentsStore(): Documento[]`, y `nonconformities.handlers.ts` SHALL exportar `getNonconformitiesStore(): NoConformidad[]`, cada uno retornando el array mutable `let` privado ya usado internamente por los handlers de ese módulo — replicando el patrón ya existente de `getIncidentsStore(): Incidente[]` en `incidents.handlers.ts`. Ningún handler existente de esos tres módulos SHALL cambiar de comportamiento por este cambio.

#### Scenario: getQeStore refleja mutaciones de otros handlers de QE
- **WHEN** un `PATCH /api/quality-events/:id/cerrar` exitoso muta el QE en el store interno de `quality-events.handlers.ts`
- **THEN** una llamada posterior a `getQeStore()` retorna el array con ese QE ya actualizado

#### Scenario: getDocumentsStore y getNonconformitiesStore existen y son funciones puras de lectura
- **WHEN** se importan `getDocumentsStore` y `getNonconformitiesStore`
- **THEN** ambas son funciones sin argumentos que retornan el array mutable interno, sin clonarlo ni filtrarlo

---

### Requirement: MSW v2 syntax exclusively en dashboard.handlers.ts
`src/mocks/handlers/dashboard.handlers.ts` SHALL usar únicamente `http.*` de `msw` (no `rest.*`), con `await delay(400)` al inicio de cada handler.

#### Scenario: Import verification
- **WHEN** se importa `dashboard.handlers.ts`
- **THEN** solo se importan `http`, `HttpResponse` y `delay` desde `msw` (más los getters de store de los otros módulos y `horasTrabajadasFixtures`)

---

### Requirement: GET /api/dashboard/kpis calcula los 9 KPIs sobre datos en vivo
El handler SHALL registrar `GET /api/dashboard/kpis`, aceptando un query param opcional `periodo` (`'YYYY-MM'`, default el mes actual del sistema). SHALL calcular cada uno de los 9 `KpiResult` de `KPI_DEFINITIONS` usando `getQeStore()`, `getDocumentsStore()`, `getNonconformitiesStore()`, `getIncidentsStore()` y `horasTrabajadasFixtures` según la fórmula de cada KPI (ver `design.md` de este change), asignando `semaforo: 'VERDE'` cuando el valor cumple la `meta`, `'AMARILLO'` cuando está dentro del 20% de desviación de la meta, y `'ROJO'` en cualquier otro caso. La respuesta SHALL ser un `ApiResponse<KpiResult[]>` con exactamente 9 elementos, uno por `KpiId`.

#### Scenario: Respuesta contiene los 9 KpiResult
- **WHEN** `GET /api/dashboard/kpis` es solicitado sin `periodo`
- **THEN** `data.data.length === 9` y cada `kpiId` de `KPI_DEFINITIONS` aparece exactamente una vez

#### Scenario: KPI-04 usa horas trabajadas del periodo solicitado
- **WHEN** `GET /api/dashboard/kpis?periodo=2026-03` es solicitado
- **THEN** el `KpiResult` de `KPI-04` se calcula dividiendo incidentes con `huboLesionados=true` cuyo `fechaEvento` cae en marzo 2026 entre la suma de `horas` de `horasTrabajadasFixtures` con `periodo === '2026-03'`

#### Scenario: Semáforo ROJO cuando el valor está lejos de la meta
- **WHEN** el valor calculado de un KPI con `unidad: 'PORCENTAJE'` y `meta: 90` es `50`
- **THEN** `semaforo === 'ROJO'` en el `KpiResult` correspondiente

#### Scenario: Sin datos en el periodo retorna KpiResult con valor 0, no un error
- **WHEN** `GET /api/dashboard/kpis?periodo=2020-01` es solicitado para un periodo sin fixtures de ningún dominio
- **THEN** la respuesta es 200 con los 9 `KpiResult`, cada uno con `valor: 0`

---

### Requirement: GET /api/dashboard/summary retorna datos filtrados por rol
El handler SHALL registrar `GET /api/dashboard/summary`, resolviendo el usuario autenticado mediante el mismo mecanismo mock-auth usado por otros handlers (header `Authorization`), y determinando el tipo de respuesta con `getDashboardDataTypeForRole(usuario.rol)`. Cuando `usuario.rol === 'OPERARIO'`, SHALL filtrar `misIncidentesReportados`/`misQEReportados` a `reportadoPorId === usuario.id` y `documentosPendientesLectura` a `Documento.area === usuario.area`. Cuando `usuario.rol === 'SUPERVISOR'`, SHALL filtrar todos los datos agregados a QE/Incidentes/NC cuya área esté en `usuario.areasAsignadas`. Los roles `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION` y `AUDITOR_INTERNO` SHALL recibir datos sin filtrar por área (alcance organizacional completo). Sin token válido, SHALL retornar 401 con `success: false`.

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

---

### Requirement: Registrado en handlers/index.ts
`dashboardHandlers` SHALL importarse desde `dashboard.handlers.ts` y agregarse al array `handlers` en `src/mocks/handlers/index.ts` sin remover handlers de otros módulos.

#### Scenario: handlers/index.ts incluye dashboardHandlers
- **WHEN** se importa `handlers/index.ts`
- **THEN** el array `handlers` exportado contiene todos los handlers de `dashboardHandlers`
