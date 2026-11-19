# Spec: dashboard-supervisor-view

## Purpose

Define the real Dashboard view for the `SUPERVISOR` role: the `SupervisorDashboard` component that consumes `useDashboardSummary()` without duplicating data fetching, and its 4 widgets scoped to the supervisor's `areasAsignadas` — a panel of area pendings (QEs in verification + ACs not closed, both rendered as `SemaforoRow`), a count of open QEs by type, a list of overdue ACs, and a list of recent incidents. All QE actions (validate, assign responsible, view timeline, sign closure) navigate to the existing `QualityEventDetail` page rather than duplicating that logic inside the dashboard.

---

## Requirements

### Requirement: SupervisorDashboard renderiza los 4 widgets del área asignada
El sistema SHALL exportar `SupervisorDashboard` en `src/features/dashboard/pages/SupervisorDashboard.tsx`, que `DashboardPage` consume cuando `getDashboardDataTypeForRole(user.rol) === 'SUPERVISOR'`. La página SHALL leer `useDashboardSummary()` y componer `DashboardLayout` así, sin zona de indicadores ni de mapa:
- **alertas**, con la tabla `ALERTAS` de la página (`dashboard-layout`):
  - "AC vencidas de mi área" (`acVencidas`; error; selectora): `valor` = `accionesCorrectivasVencidas.length`. Al hacer clic, hace scroll a `ACsVencidasWidget`, que renderiza ese mismo arreglo, así que no lleva chip.
  - "Esperan mi firma de cierre" (`firmaCierre`; warning; selectora): `valor` = `filtrarAccionesPorTipo(items, ['QE_FIRMAR_CIERRE']).length`. Al hacer clic, filtra `AccionesRequeridasWidget` con ese tipo y muestra el chip.
  - "Incidentes recientes de mi área (7 días)" (info; enlace): `valor` = los `incidentesRecientes` con `fechaEvento` en los últimos 7 días; lleva a `/incidents?fechaDesde=<hoy − 7 días, yyyy-MM-dd>`.
- **trabajoPrincipal:** `AccionesRequeridasWidget` (`id="acciones-requeridas"`) y el panel de pendientes del área (semáforo).
- **trabajoLateral:** ACs vencidas del área (`id="acs-vencidas"`), alertas de incidentes recientes y QEs abiertos por tipo.

Todos los datos de los widgets del área SHALL provenir exclusivamente de `data.data`: ningún widget SHALL hacer su propio fetch ni filtrar por un campo distinto del área.

#### Scenario: SupervisorDashboard se renderiza para el rol SUPERVISOR
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/dashboard`
- **THEN** se renderiza `SupervisorDashboard`, no el placeholder `<ComingSoon>` ni `OperarioDashboard`

#### Scenario: Estado de carga muestra skeleton, no los widgets vacíos
- **WHEN** `useDashboardSummary()` está en `isLoading`
- **THEN** `SupervisorDashboard` renderiza un estado de carga en vez de invocar los widgets con datos `undefined`

#### Scenario: Zonas del Supervisor
- **WHEN** el summary ya cargó
- **THEN** se renderizan "Requiere atención" (3 alertas) y "Mi trabajo y contexto", y no existen las zonas "Indicadores" ni "Dónde ocurre"

#### Scenario: Incidentes recientes solo cuenta los últimos 7 días
- **WHEN** `incidentesRecientes` trae un incidente de hace 2 días y otro de hace 20 días
- **THEN** la alerta "Incidentes recientes de mi área (7 días)" muestra `1`

#### Scenario: Firma de cierre filtra la lista con el mismo número
- **WHEN** `useAccionesRequeridas` devuelve 2 ítems `QE_FIRMAR_CIERRE` y 4 `AC_EJECUTAR`, y el usuario hace clic en "Esperan mi firma de cierre"
- **THEN** la tarjeta muestra `2`, la URL tiene `alerta=firmaCierre` y `AccionesRequeridasWidget` muestra exactamente 2 filas con el chip

#### Scenario: AC vencidas selecciona su lista
- **WHEN** `accionesCorrectivasVencidas` tiene 3 elementos y el usuario hace clic en "AC vencidas de mi área"
- **THEN** la tarjeta muestra `3`, tiene `aria-pressed="true"` y `ACsVencidasWidget` muestra 3 filas

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
