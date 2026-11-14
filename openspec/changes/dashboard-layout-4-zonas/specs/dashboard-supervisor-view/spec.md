## MODIFIED Requirements

### Requirement: SupervisorDashboard renderiza los 4 widgets del área asignada
El sistema SHALL exportar `SupervisorDashboard` en `src/features/dashboard/pages/SupervisorDashboard.tsx`, consumida por `DashboardPage` cuando `getDashboardDataTypeForRole(user.rol) === 'SUPERVISOR'`. La página SHALL leer `useDashboardSummary()` y componer `DashboardLayout` así (sin zona de indicadores ni de mapa):
- **alertas:** "AC vencidas de mi área" (error; `accionesCorrectivasVencidas.length`; `#acs-vencidas`), "Esperan mi firma de cierre" (warning; ítems `QE_FIRMAR_CIERRE` de `useAccionesRequeridas`; `#acciones-requeridas`) e "Incidentes recientes de mi área (7 días)" (info; `incidentesRecientes` con `fechaEvento` en los últimos 7 días; `/incidents?fechaDesde=<hoy − 7 días, yyyy-MM-dd>`);
- **trabajoPrincipal:** `AccionesRequeridasWidget` (`id="acciones-requeridas"`) y el panel de pendientes del área (semáforo);
- **trabajoLateral:** ACs vencidas del área (`id="acs-vencidas"`), alertas de incidentes recientes y QEs abiertos por tipo.

Todos los datos de los widgets del área SHALL provenir exclusivamente de `data.data` (ningún widget SHALL hacer su propio fetch o filtrar por un campo distinto de área).

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
