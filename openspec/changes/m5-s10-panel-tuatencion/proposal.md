## Why

Los dashboards de M5 muestran pendientes agregados por área o por tipo, pero ningún rol ve, al iniciar sesión, la lista concreta de QE, AC y Documentos donde *él específicamente* puede actuar ahora mismo (firmar, verificar, aprobar, revisar, ejecutar). El usuario tiene que entrar a cada módulo y filtrar mentalmente qué le corresponde. Además, `JEFE_CONTROL_DOCUMENTARIO` hoy no tiene dashboard propio — ve el de Jefe de Calidad/SyST (KPIs y widgets irrelevantes a su función), y `AUDITOR_INTERNO.puedeVerificar` nunca puede ser verdadero en la práctica porque no existe ningún campo que registre a qué auditor se le asignó la verificación de un QE.

## What Changes

- Nuevo hook compartido `useAccionesRequeridas()` que agrega, para el usuario autenticado, los QE/AC/Documentos donde tiene una acción pendiente concreta (no por área, no por rol genérico — por asignación/responsabilidad individual).
- Nuevo componente `AccionesRequeridasWidget` montado como **primer widget** en los 6 dashboards de rol (los 5 existentes + el nuevo de Jefe de Control Documentario). Lista agrupada por dominio (QE, AC, Documento), ordenada por prioridad y luego por fecha límite dentro de cada grupo; máximo 10 ítems visibles + "ver todos"; estado vacío explícito.
- Nuevo `JefeControlDocumentarioDashboard.tsx`, montado en `DashboardPage.tsx`. Alcance mínimo: solo `AccionesRequeridasWidget` (sin KPIs nuevos de control documentario).
- Fix de bug: `dashboardRoleMapping.ts` deja de mapear `JEFE_CONTROL_DOCUMENTARIO` a `'JEFE_CALIDAD'` — obtiene su propio tipo de dashboard.
- Nuevo campo opcional `auditorAsignadoId?: string` en `QualityEvent`, asignado por `JEFE_CALIDAD_SYST` vía un select al forzar la transición CERRADO → `EN_VERIFICACION` (hoy el único disparador de esa transición en el mock es el control dev-only "Forzar vencimiento" — no existe una transición automática real todavía).
- Fix de gap real: `QEVerificacionSection.tsx` calcula `esResponsable = user.id === qe.auditorAsignadoId` en vez de pasar `false` hardcodeado a `getQualityEventPermissions`, habilitando por primera vez que `AUDITOR_INTERNO.puedeVerificar` sea verdadero cuando corresponde.
  - **Corrección respecto a la propuesta original**: `QEStatusTransitionPanel.tsx` también pasa `false` hardcodeado, pero su `EXCLUDED_TARGETS` ya filtra `EN_VERIFICACION`/`VERIFICADO`/`REABIERTO` de las transiciones que renderiza — nunca usa `puedeVerificar`. Ese call site no requiere cambios para este fix; se deja fuera de alcance para no tocar comportamiento no relacionado (`puedeAvanzarEstado` para otros roles/estados).
- Fixtures MSW de QE actualizados para poblar `auditorAsignadoId` en QEs en `EN_VERIFICACION`.

## Capabilities

### New Capabilities
- `dashboard-acciones-requeridas`: hook `useAccionesRequeridas()` y componente `AccionesRequeridasWidget` que agregan ítems accionables de QE, AC y Documentos para el usuario autenticado, y su montaje como primer widget en `OperarioDashboard`, `SupervisorDashboard`, `AltaDireccionDashboard`, `AuditorDashboard` y `JefeControlDocumentarioDashboard`.
- `dashboard-jefecontroldoc-view`: nuevo dashboard para el rol `JEFE_CONTROL_DOCUMENTARIO`, montado en `DashboardPage.tsx`, con `AccionesRequeridasWidget` como único contenido v1.

### Modified Capabilities
- `dashboard-jefecalidad-view`: `AccionesRequeridasWidget` se monta como primer widget del dashboard existente.
- `dashboard-types`: `getDashboardDataTypeForRole` deja de mapear `JEFE_CONTROL_DOCUMENTARIO` a `'JEFE_CALIDAD'` — nueva variante `'JEFE_CONTROL_DOC'` en `DashboardSummaryData`.
- `dashboard-msw-handlers`: `buildDashboardSummary` gana el caso `'JEFE_CONTROL_DOC'`; se elimina la rama especial `esControlDocumentario` de `buildJefeCalidadData` (ese rol ya no llega ahí).
- `quality-event-types`: nuevo campo opcional `auditorAsignadoId?: string` en `QualityEvent`.
- `quality-event-verificacion`: el control dev-only "Forzar vencimiento" (al forzar desde `CERRADO`) exige seleccionar un auditor antes de habilitarse y envía `auditorAsignadoId` en el PATCH; `QEVerificacionSection` calcula `esResponsable` real en vez de `false` hardcodeado.
- `quality-event-msw-fixtures`: fixtures de QE en `EN_VERIFICACION` incluyen `auditorAsignadoId` poblado.

## Impact

- `src/features/dashboard/hooks/`, `src/features/dashboard/components/`, `src/features/dashboard/pages/` (los 6 dashboards + `DashboardPage.tsx`), `src/features/dashboard/utils/dashboardRoleMapping.ts`, `src/features/dashboard/types/dashboardData.types.ts`.
- `src/features/quality-events/types/qualityEvent.types.ts`, `src/features/quality-events/components/QEVerificacionSection.tsx`.
- `src/mocks/handlers/quality-events.handlers.ts` (acepta `auditorAsignadoId` en `/forzar-vencimiento-verificacion`), `src/mocks/fixtures/quality-events.fixtures.ts`.
- `src/mocks/handlers/dashboard.handlers.ts` (nuevo caso `JEFE_CONTROL_DOC` en `buildDashboardSummary`, elimina rama especial en `buildJefeCalidadData`).
- `src/i18n/es-PE.json`, `src/i18n/en-US.json` (nuevas claves del widget y del dashboard nuevo).
- Fuera de alcance: flujo de "aprobar extensión de plazo" (gap de M4 no construido), rediseño de páginas de detalle, KPIs nuevos de control documentario.
