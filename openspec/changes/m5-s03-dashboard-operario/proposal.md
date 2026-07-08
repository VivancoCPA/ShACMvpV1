## Why

M5-S01 dejó listos los tipos, el RBAC de `/dashboard` y los hooks/handlers de datos (`useDashboardSummary` ya filtra `OperarioDashboardData` por usuario autenticado), y M5-S02 dejó listos los componentes visuales de semáforo (`SemaforoRow`, `SemaforoCriticoBanner`). Pero `/dashboard` sigue siendo el placeholder `<ComingSoon>` para todos los roles — ningún Operario tiene todavía una pantalla real donde ver sus QEs reportados, sus ACs asignadas, ni un atajo para reportar un nuevo incidente. Esta spec es la primera que conecta ambas fundaciones en una UI consumible.

## What Changes

- Nueva vista real en `/dashboard` para el rol `OPERARIO`: reemplaza `<ComingSoon label="Dashboard" />` por `DashboardPage`, que hace un switch por rol y renderiza `OperarioDashboard` cuando `user.rol === 'OPERARIO'`; los demás 5 roles (`SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`) siguen viendo `<ComingSoon>` hasta sus specs correspondientes (S04-S07) — **BREAKING** solo en el sentido de que `/dashboard` deja de ser un placeholder puro; no rompe ningún contrato existente.
- Widget **"Mis QEs reportados"**: lista los QE donde `reportadoPorId === user.id` (dato ya provisto por `misQEReportados` de `useDashboardSummary`), mostrando `QEStatusBadge` (ya existente) para el estado. Se usa `SemaforoRow` (M5-S02) únicamente cuando el QE tiene un plazo real asociado por regla de negocio — `estado === 'EN_VERIFICACION'` con `fechaVerificacionProgramada` (RN-QE-008) — porque ningún otro estado del ciclo de vida de QE tiene un SLA codificado; para el resto de estados se muestra una fila simple sin semáforo, evitando inventar un plazo ficticio. Click en una fila navega a `/quality-events/:id` (ruta ya existente).
- Widget **"Mis ACs asignadas"**: lista las acciones correctivas donde `responsableId === user.id` (dato ya provisto por `accionesCorrectivasAsignadas`), usando `SemaforoRow` con `plazoFecha` (campo siempre presente en `AccionCorrectivaResumen`). Click navega al detalle del dominio de origen (`origenTipo`): `/quality-events/:origenId`, `/nonconformities/:origenId` o `/incidents/:origenId` — cada uno ya tiene su propia sección de cierre de AC con evidencia (`QEACSection`, `ACSection`, `IncidentACSection` respectivamente); el cierre real ocurre en esa pantalla, no se duplica lógica de cierre en el dashboard.
- Botón **"Crear nuevo reporte"**: navega a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO`, reutilizando `QualityEventForm` (ya lee `origen` de `searchParams` para preseleccionar el origen) — no se crea un formulario ni una ruta nueva.
- Widget de **notificaciones pendientes queda fuera de alcance de esta spec** (decisión confirmada): no existe ningún sistema de notificaciones en el código (sin tipos, store, handler MSW ni componente) y construirlo es un dominio nuevo no trivial. Se documenta como gap para una spec futura dedicada.
- `misIncidentesReportados` y `documentosPendientesLectura` (ya presentes en `OperarioDashboardData` desde S01) no se consumen en esta spec — el PRD de referencia solo pide los dos widgets de QE/AC para Operario; quedan disponibles para una iteración futura sin requerir cambios de datos.

## Capabilities

### New Capabilities
- `dashboard-operario-view`: Página `DashboardPage` (switch por rol) y vista `OperarioDashboard` con los widgets "Mis QEs reportados" y "Mis ACs asignadas", más las acciones de navegación (crear reporte O1, ver detalle de QE, ir a cerrar AC en su dominio de origen).

### Modified Capabilities
- `dashboard-types`: `QEResumen` agrega el campo opcional `fechaVerificacionProgramada?: string`, necesario para que el widget de Operario determine si un QE tiene un plazo de verificación real antes de decidir si aplica `SemaforoRow`.
- `dashboard-msw-handlers`: `toQEResumen` en `dashboard.handlers.ts` popula el nuevo campo `fechaVerificacionProgramada` desde el `QualityEvent` completo (dato que ya existe en la entidad, solo falta proyectarlo al resumen).
- `routing`: la ruta `/dashboard` dentro del `RoleGuard` de los 6 roles deja de renderizar `<ComingSoon>` de forma incondicional; ahora renderiza `DashboardPage`, que internamente sigue mostrando `<ComingSoon>` para los 5 roles no cubiertos por esta spec.

## Impact

- **Nuevos archivos**: `src/features/dashboard/pages/DashboardPage.tsx`, `src/features/dashboard/pages/OperarioDashboard.tsx`, `src/features/dashboard/components/MisQEsWidget.tsx`, `src/features/dashboard/components/MisACsWidget.tsx` (+ sus `.test.tsx`).
- **Archivos modificados**: `src/router/index.tsx` (reemplaza el elemento de `/dashboard`), `src/features/dashboard/types/dashboardData.types.ts` (o `dashboardSummary.types.ts`, donde vive `QEResumen`) agrega `fechaVerificacionProgramada?`, `src/mocks/handlers/dashboard.handlers.ts` (`toQEResumen` popula el campo nuevo), `src/i18n/es-PE.json` y `src/i18n/en-US.json` (namespace `dashboard` → claves de los widgets de Operario, si faltan).
- **Sin nuevos endpoints MSW**: se reutiliza `GET /api/dashboard/summary` ya existente; solo se amplía la proyección `QEResumen` que ese handler ya construye.
- **Sin nuevo dominio de notificaciones**: excluido explícitamente de esta spec, ver "What Changes".
- **Reutilización explícita, sin lógica duplicada**: formulario de creación de QE, rutas de detalle de QE/NC/Incidente, y las 3 secciones de cierre de AC por dominio — todos ya existentes, todos reutilizados sin cambios de comportamiento.
