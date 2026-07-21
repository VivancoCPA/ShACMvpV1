# Spec: dashboard-operario-view

## Purpose

Define the real Dashboard view for the `OPERARIO` role: the `DashboardPage` role switch that decides which dashboard variant to render, the `OperarioDashboard` component that consumes `useDashboardSummary()` without duplicating data fetching, its two widgets (`MisQEsWidget` and `MisACsWidget`), and the "Crear nuevo reporte" action that reuses `QualityEventForm` with a preselected origin.

---

## Requirements

### Requirement: DashboardPage hace switch por rol y renderiza OperarioDashboard para OPERARIO
El sistema SHALL definir `DashboardPage` en `src/features/dashboard/pages/DashboardPage.tsx`, registrada como el elemento de la ruta `/dashboard`. `DashboardPage` SHALL leer `user.rol` desde `authStore`, resolver el tipo de dashboard con `getDashboardDataTypeForRole(rol)` (ya existente), y renderizar `OperarioDashboard` cuando el resultado sea `'OPERARIO'`. Para cualquier otro valor de retorno (`'SUPERVISOR'`, `'JEFE_CALIDAD'`, `'ALTA_DIRECCION'`, `'AUDITOR'`) SHALL renderizar `<ComingSoon label="Dashboard" />`, sin lanzar error ni pantalla en blanco.

#### Scenario: Usuario OPERARIO ve OperarioDashboard en /dashboard
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/dashboard`
- **THEN** se renderiza `OperarioDashboard`, no `<ComingSoon>`

#### Scenario: Usuario SUPERVISOR sigue viendo el placeholder
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/dashboard`
- **THEN** se renderiza `<ComingSoon label="Dashboard" />`, no `OperarioDashboard`

---

### Requirement: OperarioDashboard consume useDashboardSummary sin duplicar el fetch de datos
`OperarioDashboard` SHALL obtener sus datos exclusivamente de `useDashboardSummary()` (ya existente de M5-S01). No SHALL definir un endpoint MSW nuevo ni un hook de datos paralelo. Mientras `isLoading` sea verdadero, SHALL renderizar un estado de carga (skeleton); si `data.rol !== 'OPERARIO'`, SHALL no renderizar los widgets (defensivo, ya que `DashboardPage` solo debería alcanzar este componente para rol `OPERARIO`).

#### Scenario: OperarioDashboard reutiliza useDashboardSummary
- **WHEN** se inspecciona `OperarioDashboard.tsx`
- **THEN** el único hook de obtención de datos de dashboard que importa es `useDashboardSummary`, sin llamadas `axios`/`fetch` directas

#### Scenario: Estado de carga antes de que resuelva la query
- **WHEN** `useDashboardSummary()` está en `isLoading: true`
- **THEN** `OperarioDashboard` renderiza un skeleton en vez de los widgets vacíos

---

### Requirement: Widget "Mis QEs reportados" con semáforo condicionado a plazo real
`MisQEsWidget` SHALL renderizar una fila por cada elemento de `data.misQEReportados` (`QEResumen[]`). Para un QE con `estado === 'EN_VERIFICACION'` y `fechaVerificacionProgramada` presente, SHALL renderizar una `SemaforoRow` calculando `diasHabilesRestantes` con `calcularEstadoSemaforoDesdeFecha` (de `semaforoPendientes.ts`, M5-S02) sobre `fechaVerificacionProgramada`. Para cualquier otro QE (estado distinto o sin `fechaVerificacionProgramada`), SHALL renderizar una fila simple con `QEStatusBadge` (ya existente) mostrando `estado`, sin `SemaforoRow`. Cada fila SHALL navegar a `/quality-events/:id` al hacer click.

#### Scenario: QE en EN_VERIFICACION con plazo muestra SemaforoRow
- **WHEN** un elemento de `misQEReportados` tiene `estado: 'EN_VERIFICACION'` y `fechaVerificacionProgramada: '2026-07-10'`
- **THEN** la fila se renderiza como `SemaforoRow` con el color correspondiente a los días hábiles restantes hasta esa fecha

#### Scenario: QE en ABIERTO muestra fila simple sin semáforo
- **WHEN** un elemento de `misQEReportados` tiene `estado: 'ABIERTO'`
- **THEN** la fila se renderiza con `QEStatusBadge`, sin borde de color de `SemaforoRow`

#### Scenario: Click en una fila navega al detalle del QE
- **WHEN** el usuario hace click en la fila del QE `qe-2026-005`
- **THEN** la aplicación navega a `/quality-events/qe-2026-005`

#### Scenario: Lista vacía muestra mensaje de estado vacío
- **WHEN** `data.misQEReportados` es un array vacío
- **THEN** `MisQEsWidget` renderiza un mensaje indicando que no hay QEs reportados, no una lista vacía sin contexto

---

### Requirement: Widget "Mis ACs asignadas" con SemaforoRow por plazoFecha
`MisACsWidget` SHALL renderizar una `SemaforoRow` por cada elemento de `data.accionesCorrectivasAsignadas` (`AccionCorrectivaResumen[]`), calculando `diasHabilesRestantes` con `calcularEstadoSemaforoDesdeFecha` sobre `plazoFecha`. Al hacer click en una fila, SHALL navegar según `origenTipo`: `'QE'` → `/quality-events/:origenId`, `'NC'` → `/nonconformities/:origenId`, `'INCIDENTE'` → `/incidents/:origenId`. No SHALL renderizar ningún modal de cierre de AC dentro del dashboard.

#### Scenario: AC con origen QE navega al detalle de QE
- **WHEN** el usuario hace click en una AC con `origenTipo: 'QE'` y `origenId: 'qe-2026-002'`
- **THEN** la aplicación navega a `/quality-events/qe-2026-002`

#### Scenario: AC con origen NC navega al detalle de No Conformidad
- **WHEN** el usuario hace click en una AC con `origenTipo: 'NC'` y `origenId: 'nc-2026-010'`
- **THEN** la aplicación navega a `/nonconformities/nc-2026-010`

#### Scenario: AC con origen INCIDENTE navega al detalle de Incidente
- **WHEN** el usuario hace click en una AC con `origenTipo: 'INCIDENTE'` y `origenId: 'inc-2026-003'`
- **THEN** la aplicación navega a `/incidents/inc-2026-003`

#### Scenario: El dashboard no reimplementa el modal de cierre de AC
- **WHEN** se inspeccionan los componentes importados por `MisACsWidget`
- **THEN** no se importa ningún modal de cierre de AC (`CerrarQEACModal` ni equivalentes de NC/Incidente) — el cierre ocurre en la página de detalle de destino

#### Scenario: Lista vacía muestra mensaje de estado vacío
- **WHEN** `data.accionesCorrectivasAsignadas` es un array vacío
- **THEN** `MisACsWidget` renderiza un mensaje indicando que no hay ACs asignadas

---

### Requirement: Acción "Crear nuevo reporte" reutiliza QualityEventForm con origen preseleccionado
`OperarioDashboard` SHALL renderizar un botón "Crear nuevo reporte" que navega a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO`, reutilizando `QualityEventForm` sin crear un formulario ni una ruta nueva.

#### Scenario: Click en "Crear nuevo reporte" navega con el origen preseleccionado
- **WHEN** el usuario hace click en el botón "Crear nuevo reporte"
- **THEN** la aplicación navega a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO` y `QualityEventForm` preselecciona `origen: 'O1_INCIDENTE_CAMPO'` en el formulario

---

### Requirement: OperarioDashboard renders a "Notificaciones pendientes" section
`OperarioDashboard` SHALL render a "Notificaciones pendientes" section using `useNotifications()`, reusing the same notification-list rendering component used by `NotificationBell`'s dropdown (from `notification-bell`), filtered to the current user (already guaranteed by the `GET /api/notifications` handler's per-user filter) and to unread entries first. It SHALL NOT duplicate the notification-rendering markup or read/mark-as-read logic already implemented for the bell dropdown.

#### Scenario: Section renders the current user's unread notifications
- **WHEN** `OperarioDashboard` renders for a user with 2 unread notifications
- **THEN** the "Notificaciones pendientes" section lists both, using the shared notification-list component

#### Scenario: Clicking a notification in the dashboard section marks it read and navigates
- **WHEN** the user clicks a notification row inside the "Notificaciones pendientes" section
- **THEN** the same mark-as-read mutation and navigation behavior defined for the bell dropdown fires (no separate implementation)

#### Scenario: Empty state when there are no notifications
- **WHEN** `useNotifications()` returns an empty array for the current user
- **THEN** the section renders an empty-state message instead of an empty list
