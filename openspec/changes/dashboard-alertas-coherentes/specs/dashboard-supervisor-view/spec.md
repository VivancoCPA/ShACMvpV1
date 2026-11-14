## MODIFIED Requirements

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
