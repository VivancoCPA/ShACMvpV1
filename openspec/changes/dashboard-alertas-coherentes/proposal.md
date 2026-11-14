## Why

Las tarjetas de "Requiere atención" de los dashboards no coinciden con las listas a las que llevan ni se actualizan después de una acción. Por ejemplo, la tarjeta "Esperan mi firma o aprobación" del Jefe de Calidad muestra 4, pero el ancla `#acciones-requeridas` solo hace scroll a una lista con todos los pendientes, cortada en 10. "AC vencidas" muestra el KPI-08 y lleva a la lista de AC *por vencer*, que es otro conjunto. Además, la query del summary (`['dashboard', 'summary']`) no la invalida ninguna mutación ni el hub, así que las tarjetas quedan desactualizadas hasta que el usuario vuelve a entrar. Toño lo reportó el 2026-11-07 (instrucción `INSTRUCCIONES-CLAUDE-CODE-dashboard-alertas-coherentes-2026-11-07.md`).

## What Changes

- **Una tarjeta filtra su lista (D1).** Si una tarjeta lleva a una lista de la misma página, al hacer clic deja de ser un ancla: guarda `?alerta=<id>` en la URL, hace scroll a la lista y la filtra a exactamente los ítems que cuenta, con un chip "Mostrando: … (n) ✕" que quita el filtro. El número de la tarjeta se calcula con el mismo arreglo y el mismo predicado que la lista filtrada. Las tarjetas que llevan a otra pantalla (p.ej. `/quality-events?severidad=CRITICA`) siguen siendo enlaces.
- `AlertaCard` acepta `onSelect`/`activa` como alternativa a `to`: se renderiza como `<button aria-pressed>` y, cuando está activa, muestra un anillo del color del nivel.
- `AccionesRequeridasWidget` acepta `filtroTipos` y `etiquetaFiltro`. Con filtro, muestra **todos** los ítems que coinciden, sin el corte de 10.
- **BREAKING (tipos):** se elimina `QE_CERRAR` y se reemplaza por `QE_REGISTRAR_CIERRE` (PENDIENTE_CIERRE sin `resultadoCierre`) y `QE_FIRMAR_CIERRE_JCA` (con `resultadoCierre` y sin `cerradoPorId`) (D2).
- La tarjeta del JCA "Esperan mi firma o aprobación" pasa a llamarse **"Aprobaciones y cierres pendientes"** y cuenta `QE_APROBAR_CAUSA_RAIZ`, `QE_FIRMAR_CIERRE_JCA` y `QE_REGISTRAR_CIERRE`.
- **AC vencidas del JCA (D3).**
  - Backend: el summary del JCA trae `accionesCorrectivasVencidas` completa, calculada con el mismo predicado que KPI-08 (helper compartido `DashboardKpiCalculator.EsAcVencida`), que también usa el Supervisor.
  - Frontend: el bloque lateral pasa a `ACsVencidasPorVencerWidget`, con las pestañas "Vencidas (n)" y "Por vencer (n)". La tarjeta "AC vencidas" abre la pestaña Vencidas y toma su valor de esa lista, no del KPI-08.
- **Las demás tarjetas siguen el mismo patrón:**
  - Supervisor: firma de cierre y AC vencidas del área.
  - Operario: AC vencidas y AC por vencer filtran `MisACsWidget`.
  - Auditor: verificaciones.
  - Alta Dirección: extensiones de plazo. Hoy la tarjeta cuenta todas las AC con solicitud, pero la lista solo muestra las que esperan a Gerencia; ahora cuentan lo mismo.
- **Refresco (D4).** Una key raíz `['dashboard']`, invalidada con el helper `invalidarDashboard(queryClient)`:
  - al llegar cualquier notificación, por el hub o por el diffing del polling;
  - en el `onSuccess` de las mutaciones de QE, AC, NC, incidentes y documentos que cambian pendientes.
  
  No se agrega polling.
- i18n `dashboard`: claves nuevas `alertas.jefeCalidad.aprobaciones`, `accionesRequeridas.tipo.QE_FIRMAR_CIERRE_JCA`, `accionesRequeridas.tipo.QE_REGISTRAR_CIERRE`, `accionesRequeridas.mostrando`, `accionesRequeridas.quitarFiltro`, `acs.tabs.vencidas` y `acs.tabs.porVencer`. Se quitan `accionesRequeridas.tipo.QE_CERRAR` y `alertas.jefeCalidad.esperanFirma`.
- MSW: `accionesCorrectivasVencidas` en el summary del JCA, con el mismo predicado que KPI-08, y fixtures de QE en PENDIENTE_CIERRE con y sin `resultadoCierre`.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `dashboard-layout`: `AlertaCard` puede funcionar como selector (`onSelect`/`activa`), además de enlace.
- `dashboard-acciones-requeridas`: `QE_CERRAR` se divide en `QE_REGISTRAR_CIERRE` y `QE_FIRMAR_CIERRE_JCA`; el widget acepta un filtro por tipos, sin límite de 10 cuando está filtrado.
- `dashboard-jefecalidad-view`: las alertas filtran sus listas (aprobaciones y cierres, AC vencidas); el bloque lateral de AC pasa a tener pestañas Vencidas / Por vencer.
- `dashboard-supervisor-view`: las alertas filtran o seleccionan su lista, con el mismo arreglo.
- `dashboard-operario-view`: las alertas filtran `MisACsWidget`.
- `dashboard-auditor-view`: la alerta de verificaciones filtra la lista de acciones requeridas.
- `dashboard-altadireccion-view`: la alerta de extensiones cuenta la misma lista que muestra el widget.
- `be-dashboard-api`: el predicado de AC vencida es compartido entre KPI-08, el resumen del JCA (nuevo campo `accionesCorrectivasVencidas`) y el del Supervisor.
- `dashboard-types`: `JefeCalidadDashboardData.accionesCorrectivasVencidas`; tipos de acción requerida nuevos.
- `dashboard-msw-handlers`: el summary del JCA trae `accionesCorrectivasVencidas` con el predicado de KPI-08.
- `dashboard-query-hooks`: la invalidación de `['dashboard']` por notificación y por mutación.

## Impact

- **Frontend:**
  - dashboard: `features/dashboard/` (las 5 páginas de rol con alertas, `AlertaCard`, `AccionesRequeridasWidget`, `MisACsWidget`, `ACsExtensionPlazoWidget`, el nuevo `ACsVencidasPorVencerWidget`, `accionesRequeridas.utils.ts`/`types`, `alertasDashboard.utils.ts`, el nuevo hook `useAlertaSeleccionada` y el helper `invalidarDashboard`);
  - otros módulos: `features/notifications/utils/invalidarQueriesDeEntidad.ts` y los hooks de mutación de `quality-events`, `nonconformities`, `incidents` y `documents`;
  - i18n: `i18n/es-PE.json` y `en-US.json`.
- **MSW:** `mocks/handlers/dashboard.handlers.ts` y `mocks/fixtures/quality-events.fixtures.ts`.
- **Backend:** `DashboardKpiCalculator` (helper `EsAcVencida`), `DashboardSummaryBuilder` (JCA y Supervisor), `DashboardSummaryDtos` y `ObtenerSummaryHandler` (nombres de los responsables de AC de incidentes para el JCA), además de sus tests.
- **Sin migración.** Depende de `dashboard-layout-4-zonas` (implementado y sincronizado).
