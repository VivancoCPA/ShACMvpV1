## MODIFIED Requirements

### Requirement: Hook useDashboardKpis
El sistema SHALL implementar `useDashboardKpis(periodo?: string)` en `src/features/dashboard/hooks/useDashboardKpis.ts` usando `useQuery` de TanStack Query v5, con `queryKey: DASHBOARD_QUERY_KEYS.kpis(periodo)` y `queryFn: () => getDashboardKpis(periodo)`. `periodo` acepta los 3 formatos de la API (`yyyy-MM`, `yyyy-Qn` o `yyyy`). Los dashboards con zona de indicadores (JEFE_CALIDAD y ALTA_DIRECCION) SHALL llamarlo con el `periodo` de `usePeriodoKpi()` (`dashboard-layout`), y el hook SHALL conservar los datos anteriores mientras carga el período nuevo (`placeholderData: keepPreviousData`), para que los anillos no parpadeen a vacío.

#### Scenario: Consulta retorna los 9 KpiResult
- **WHEN** un componente llama `useDashboardKpis()`
- **THEN** el hook retorna `{ data, isLoading, isError }` con `data` poblado desde MSW conteniendo 9 elementos

#### Scenario: Reactividad ante cambio de periodo
- **WHEN** el argumento `periodo` cambia de `'2026-11'` a `'2026-Q4'`
- **THEN** TanStack Query dispara una nueva petición por el cambio de `queryKey`, a `['dashboard', 'kpis', '2026-Q4']`
