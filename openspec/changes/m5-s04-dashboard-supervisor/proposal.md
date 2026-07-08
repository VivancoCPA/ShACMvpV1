## Why

`/dashboard` ya renderiza una vista real para `OPERARIO` (M5-S03); los otros 5 roles siguen viendo el placeholder `<ComingSoon>`. El Supervisor de Área es el siguiente rol priorizado por el PRD (sección 5.1): necesita, sin salir de `/dashboard`, ver de un vistazo los QEs/ACs pendientes de las áreas que gestiona (`areasAsignadas`, que puede incluir más de un área), y tener accesos directos a las acciones de QE que ya existen en `QualityEventDetail`, en vez de navegar a ciegas al listado general de Quality Events y buscar manualmente.

## What Changes

- Nueva vista real en `/dashboard` para el rol `SUPERVISOR`: `DashboardPage` agrega la rama `dashboardType === 'SUPERVISOR' → <SupervisorDashboard />`; los 4 roles restantes (`JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`) siguen viendo `<ComingSoon>` hasta sus specs (S05-S07).
- **Filtrado por `areasAsignadas`, nunca por `area`/`reportadoPorId`/`responsableId`**: todo widget de esta spec reutiliza el mismo criterio ya implementado en `buildSupervisorData` (`src/mocks/handlers/dashboard.handlers.ts`) — un Supervisor con `areasAsignadas: ['Almacén Norte', 'Almacén Sur']` ve datos combinados de ambas áreas, nunca de un área fuera de su asignación.
- Widget **"Panel de pendientes del área"**: dos secciones con tratamiento `SemaforoRow` (M5-S02), siguiendo el mismo criterio de elegibilidad de semáforo ya establecido en `MisQEsWidget` (M5-S03) — nunca se inventa un plazo donde la entidad no tiene uno:
  - QEs del área en `EN_VERIFICACION` con `fechaVerificacionProgramada` (único estado con plazo real, RN-QE-008).
  - ACs del área no cerradas (`PENDIENTE` o `EN_EJECUCION`), usando `plazoFecha`.
  - Click navega al detalle del origen (`/quality-events/:id` o `/quality-events/:origenId` / `/nonconformities/:origenId` / `/incidents/:origenId` según `origenTipo`, igual que M5-S03).
- Widget **"QEs abiertos por tipo"**: conteo por `QEType` (`CALIDAD`/`SST`/`ADUANERO`/`OPERACIONAL`) de los QEs del área con estado distinto de `CERRADO`/`VERIFICADO` — mismo criterio de "abierto" que ya usa `qeCriticosAbiertos` en `buildJefeCalidadData`.
- Widget **"ACs vencidas del área"**: ACs del área con `estado === 'EN_EJECUCION'` y `plazoFecha` en el pasado. **Ajusta la semántica actual** de `accionesCorrectivasVencidas` (hoy incluye también `PENDIENTE`) para que coincida con el criterio explícito del PRD — esta spec es el primer consumidor real del campo, no rompe ningún consumidor existente.
- Widget **"Alertas de incidentes recientes"**: reutiliza `incidentesRecientes` (ya calculado y filtrado por área en `buildSupervisorData`, últimos 10 por `fechaEvento`) — sin cambios de datos.
- **Gap-check de las 4 acciones solicitadas para el dashboard, verificado antes de codificar (ver design.md para detalle completo)**:
  - "Ver timeline de QE" → **reutilizable tal cual**: `QEAuditTrail` (`src/features/quality-events/components/QEAuditTrail.tsx`) solo requiere `qeId`, sin acoplamiento a `QualityEventDetail`.
  - "Validar QE" y "Firmar cierre de QE" → la mutación (`useTransitionQEStatus`, `useFirmarCierre`) es reutilizable, pero la UI de aprobación/firma (PIN modal) está duplicada y privada dentro de `QEInvestigationSection`/`QECierreSection`, entrelazada con estado local de esas secciones — extraerla es un trabajo no trivial fuera del alcance de esta spec. **Decisión de alcance**: el dashboard ofrece navegación directa a `/quality-events/:id`, donde el Supervisor ejecuta la acción con el flujo ya existente; no se duplica lógica de PIN en el dashboard.
  - "Asignar responsables" → **no existe** como acción reutilizable ni de creación aislada: no hay mutación para reasignar el responsable de una AC después de creada, ni un picker de usuario reutilizable, ni un campo de responsable en `QualityEvent` mismo. Queda **fuera de alcance** (gap de M4, no de este dashboard) — el dashboard solo navega al detalle, igual que las otras acciones.

## Capabilities

### New Capabilities
- `dashboard-supervisor-view`: página `SupervisorDashboard` con los 4 widgets de área (semáforo de pendientes, QEs por tipo, ACs vencidas, incidentes recientes) y sus acciones de navegación hacia el detalle correspondiente (QE, NC, Incidente).

### Modified Capabilities
- `dashboard-types`: `SupervisorDashboardData` agrega `qeAbiertosPorTipo: Record<QEType, number>`, `qesEnVerificacionArea: QEResumen[]` y `accionesCorrectivasPendientesArea: AccionCorrectivaResumen[]` (necesarios para el panel de semáforo itemizado, que hoy solo existe como conteo agregado en `semaforoPlazos`).
- `dashboard-msw-handlers`: `buildSupervisorData` calcula los 3 campos nuevos y ajusta el filtro de `accionesCorrectivasVencidas` a `estado === 'EN_EJECUCION'` (antes: cualquier estado distinto de `CERRADA`).
- `routing`: la ruta `/dashboard` deja de mostrar `<ComingSoon>` para `SUPERVISOR`; `DashboardPage` ahora renderiza `SupervisorDashboard` para ese rol.

## Impact

- **Nuevos archivos**: `src/features/dashboard/pages/SupervisorDashboard.tsx`, `src/features/dashboard/components/PanelPendientesAreaWidget.tsx`, `src/features/dashboard/components/QEPorTipoWidget.tsx`, `src/features/dashboard/components/ACsVencidasWidget.tsx`, `src/features/dashboard/components/IncidentesRecientesWidget.tsx` (+ sus `.test.tsx`).
- **Archivos modificados**: `DashboardPage.tsx` (rama `SUPERVISOR`), `dashboardData.types.ts` (3 campos nuevos en `SupervisorDashboardData`), `dashboard.handlers.ts` (`buildSupervisorData` extendido + filtro de vencidas ajustado), `dashboard.handlers.test.ts`, `dashboardAccess.test.tsx` (deja de esperar `<ComingSoon>` para `SUPERVISOR`), `es-PE.json`/`en-US.json` (namespace `dashboard.supervisor.*`).
- **Sin nuevos endpoints MSW**: se reutiliza `GET /api/dashboard/summary`; solo se amplía la proyección de `buildSupervisorData`.
- **Sin lógica de PIN/firma/asignación nueva en el dashboard**: las 3 acciones que lo requerirían navegan al detalle de QE existente; "asignar responsables" queda documentado como gap de M4 fuera de alcance.
