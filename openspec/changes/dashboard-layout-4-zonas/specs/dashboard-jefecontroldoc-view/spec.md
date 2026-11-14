## MODIFIED Requirements

### Requirement: JefeControlDocumentarioDashboard renderiza el panel de acciones requeridas como único contenido v1
El sistema SHALL implementar `JefeControlDocumentarioDashboard` en `src/features/dashboard/pages/JefeControlDocumentarioDashboard.tsx`, consumiendo `useDashboardSummary()` y componiendo `DashboardLayout` así:
- **alertas:** "Documentos con revisión vencida" (error; `data.data.documentosRevisionVencida`) y "Revisión en 30 días o menos" (warning; `data.data.documentosRevisionProxima`), las dos enlazadas a `/documentos?estado=PUBLICADO` (la lista no filtra por fecha de revisión). La alerta "Copias controladas por recoger" de la instrucción no se implementa: el sistema no modela la entrega de copias (`design.md` D9);
- **trabajoPrincipal:** `AccionesRequeridasWidget`, a todo el ancho (no hay columna lateral).

Sin KPIs, sin zona de indicadores ni de mapa. Mientras `isLoading || !data || data.rol !== 'JEFE_CONTROL_DOC'`, la zona de alertas SHALL mostrar el mismo patrón de skeleton que los otros 5 dashboards de rol, y `AccionesRequeridasWidget` se sigue renderizando.

#### Scenario: JEFE_CONTROL_DOCUMENTARIO ve su propio dashboard
- **WHEN** un usuario con `rol: 'JEFE_CONTROL_DOCUMENTARIO'` navega a `/dashboard`
- **THEN** se renderiza `JefeControlDocumentarioDashboard`, no `JefeCalidadDashboard`

#### Scenario: Contenido: alertas de revisión y acciones requeridas
- **WHEN** `JefeControlDocumentarioDashboard` renderiza con `data.rol === 'JEFE_CONTROL_DOC'` y `{ documentosRevisionVencida: 2, documentosRevisionProxima: 0 }`
- **THEN** se renderizan 2 alertas (la primera con `2`, la segunda neutra con "Todo en orden") y `AccionesRequeridasWidget` a todo el ancho; no se renderiza `KpiGridWidget` ni ningún otro widget de KPI

#### Scenario: Skeleton mientras carga
- **WHEN** `useDashboardSummary()` retorna `isLoading: true`
- **THEN** la zona de alertas muestra el skeleton de carga, y `AccionesRequeridasWidget` ya es visible
