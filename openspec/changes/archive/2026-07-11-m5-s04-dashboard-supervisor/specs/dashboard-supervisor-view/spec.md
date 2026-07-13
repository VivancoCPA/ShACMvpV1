## ADDED Requirements

### Requirement: SupervisorDashboard renderiza los 4 widgets del área asignada
El sistema SHALL exportar `SupervisorDashboard` en `src/features/dashboard/pages/SupervisorDashboard.tsx`, consumida por `DashboardPage` cuando `getDashboardDataTypeForRole(user.rol) === 'SUPERVISOR'`. La página SHALL leer `useDashboardSummary()` y, cuando `data.rol === 'SUPERVISOR'`, renderizar en este orden: panel de pendientes del área (semáforo), QEs abiertos por tipo, ACs vencidas del área, y alertas de incidentes recientes. Todos los datos mostrados SHALL provenir exclusivamente de `data.data` (ningún widget SHALL hacer su propio fetch o filtrar por un campo distinto de área).

#### Scenario: SupervisorDashboard se renderiza para el rol SUPERVISOR
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/dashboard`
- **THEN** se renderiza `SupervisorDashboard`, no el placeholder `<ComingSoon>` ni `OperarioDashboard`

#### Scenario: Estado de carga muestra skeleton, no los widgets vacíos
- **WHEN** `useDashboardSummary()` está en `isLoading`
- **THEN** `SupervisorDashboard` renderiza un estado de carga en vez de invocar los widgets con datos `undefined`

---

### Requirement: Panel de pendientes del área usa SemaforoRow para QEs en verificación y ACs no cerradas
El sistema SHALL exportar `PanelPendientesAreaWidget` en `src/features/dashboard/components/PanelPendientesAreaWidget.tsx`, recibiendo `qesEnVerificacionArea: QEResumen[]` y `accionesCorrectivasPendientesArea: AccionCorrectivaResumen[]`. Para cada QE de `qesEnVerificacionArea` (ya filtrado por el handler a `estado === 'EN_VERIFICACION'` con `fechaVerificacionProgramada` definido) SHALL renderizar una fila `SemaforoRow` con `estado`/`diasHabilesRestantes` calculados vía `calcularEstadoSemaforoDesdeFecha(fechaVerificacionProgramada)`; el click SHALL navegar a `/quality-events/:id`. Para cada AC de `accionesCorrectivasPendientesArea` SHALL renderizar una fila `SemaforoRow` calculada sobre `plazoFecha`; el click SHALL navegar a la ruta de detalle de `origenTipo` (`/quality-events/:origenId`, `/nonconformities/:origenId` o `/incidents/:origenId`). El widget SHALL usar el mismo contenedor bordeado (`overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20`) que `MisACsWidget`/`MisQEsWidget` (M5-S03), con un estado vacío `<p>` centrado cuando ambas listas están vacías.

#### Scenario: QE en verificación se muestra con SemaforoRow
- **WHEN** `qesEnVerificacionArea` contiene un QE con `fechaVerificacionProgramada` en 3 días
- **THEN** se renderiza una `SemaforoRow` con `estado: 'AMARILLO'` (o el que corresponda según días hábiles) para ese QE

#### Scenario: AC pendiente navega al detalle de su dominio de origen
- **WHEN** el usuario hace click en una fila de `accionesCorrectivasPendientesArea` con `origenTipo: 'INCIDENTE'` y `origenId: 'inc-045'`
- **THEN** la navegación resultante es a `/incidents/inc-045`

#### Scenario: Ambas listas vacías muestran un único estado vacío
- **WHEN** `qesEnVerificacionArea` y `accionesCorrectivasPendientesArea` están vacíos
- **THEN** el widget renderiza un solo mensaje de estado vacío, sin secciones internas "peladas"

---

### Requirement: Widget de QEs abiertos por tipo muestra conteo, no lista
El sistema SHALL exportar `QEPorTipoWidget` en `src/features/dashboard/components/QEPorTipoWidget.tsx`, recibiendo `qeAbiertosPorTipo: Record<QEType, number>`. SHALL renderizar una fila por cada uno de los 4 valores de `QEType` (`CALIDAD`, `SST`, `ADUANERO`, `OPERACIONAL`) con su conteo correspondiente, incluyendo los tipos con conteo `0`. El widget NO SHALL ofrecer navegación de filtro cruzado hacia el listado de QEs (fuera de alcance de esta spec).

#### Scenario: Los 4 tipos se muestran siempre, incluso con conteo cero
- **WHEN** `qeAbiertosPorTipo` es `{ CALIDAD: 3, SST: 0, ADUANERO: 1, OPERACIONAL: 0 }`
- **THEN** el widget renderiza 4 filas, incluyendo `SST` y `OPERACIONAL` con conteo `0`

---

### Requirement: Widget de ACs vencidas del área reutiliza accionesCorrectivasVencidas
El sistema SHALL exportar `ACsVencidasWidget` en `src/features/dashboard/components/ACsVencidasWidget.tsx`, recibiendo `accionesCorrectivasVencidas: AccionCorrectivaResumen[]` (ya filtrado por el handler a `estado === 'EN_EJECUCION'` y `plazoFecha` en el pasado). SHALL renderizar cada elemento como una fila con navegación al detalle de su `origenTipo`, usando el mismo contenedor bordeado y estado vacío que los demás widgets de esta spec.

#### Scenario: Solo se muestran ACs en ejecución vencidas
- **WHEN** `accionesCorrectivasVencidas` recibido del handler solo contiene ACs con `estado: 'EN_EJECUCION'`
- **THEN** el widget no necesita filtrar nada adicional: renderiza una fila por cada elemento recibido

#### Scenario: Sin ACs vencidas muestra estado vacío
- **WHEN** `accionesCorrectivasVencidas` es un arreglo vacío
- **THEN** el widget renderiza el mensaje de estado vacío, no una tabla en blanco

---

### Requirement: Widget de incidentes recientes reutiliza incidentesRecientes sin cambios de datos
El sistema SHALL exportar `IncidentesRecientesWidget` en `src/features/dashboard/components/IncidentesRecientesWidget.tsx`, recibiendo `incidentesRecientes: IncidenteResumen[]` (ya limitado a los últimos 10 por `fechaEvento` y filtrado por área en el handler). SHALL renderizar cada incidente con su `numero`, `tipo` y `severidad`, navegando a `/incidents/:id` al hacer click.

#### Scenario: Click en un incidente navega a su detalle
- **WHEN** el usuario hace click en la fila del incidente `inc-102`
- **THEN** la navegación resultante es a `/incidents/inc-102`

---

### Requirement: Las 4 acciones de QE del PRD navegan al detalle existente, sin duplicar lógica
Ninguna fila ni botón de `SupervisorDashboard` SHALL embeber un modal de firma PIN, un formulario de asignación de responsable, ni un panel de transición de estado propio. Toda interacción sobre un QE (validar, asignar responsable, ver timeline, firmar cierre) SHALL resolverse navegando a `/quality-events/:id`, donde `QualityEventDetail` ya expone `QEInvestigationSection`, `QEACSection`, `QEAuditTrail` y `QECierreSection` con esa lógica.

#### Scenario: Click en una fila de QE del panel de pendientes navega al detalle, no abre un modal
- **WHEN** el usuario hace click en una fila de QE dentro de `PanelPendientesAreaWidget`
- **THEN** el navegador cambia de ruta a `/quality-events/:id`; ningún modal de firma o asignación se abre dentro del dashboard
