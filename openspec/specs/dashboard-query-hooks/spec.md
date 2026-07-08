# Spec: dashboard-query-hooks

## Purpose

Define the TanStack Query v5 hooks, query keys and Axios client that expose Dashboard data (`useDashboardKpis`, `useDashboardSummary`) to components, following the three-layer MSW-backed pattern used by other modules. This slice (S01) exposes read-only hooks only; no mutations.

---

## Requirements

### Requirement: Query keys centralizadas para Dashboard
El sistema SHALL exportar `DASHBOARD_QUERY_KEYS` desde `src/features/dashboard/hooks/dashboardQueryKeys.ts`, con la estructura:
```typescript
export const DASHBOARD_QUERY_KEYS = {
  all:     ['dashboard'] as const,
  kpis:    (periodo?: string) => ['dashboard', 'kpis', periodo ?? 'current'] as const,
  summary: () => ['dashboard', 'summary'] as const,
} as const
```

#### Scenario: Uso en invalidación de caché
- **WHEN** se llama `queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.all })`
- **THEN** se invalidan tanto la query de KPIs como la de summary, para cualquier `periodo`

---

### Requirement: Cliente API puro para dashboard
El sistema SHALL implementar `src/features/dashboard/api/dashboard.api.ts` con `getDashboardKpis(periodo?: string): Promise<KpiResult[]>` y `getDashboardSummary(): Promise<DashboardSummaryData>`, ambos usando la instancia Axios compartida (`lib/axios.ts`), sin lógica de UI ni de React dentro del cliente.

#### Scenario: getDashboardKpis llama al endpoint correcto
- **WHEN** se llama `getDashboardKpis('2026-03')`
- **THEN** se realiza `GET /api/dashboard/kpis?periodo=2026-03` vía la instancia Axios compartida

#### Scenario: getDashboardSummary no requiere argumentos
- **WHEN** se llama `getDashboardSummary()`
- **THEN** se realiza `GET /api/dashboard/summary` sin query params

---

### Requirement: Hook useDashboardKpis
El sistema SHALL implementar `useDashboardKpis(periodo?: string)` en `src/features/dashboard/hooks/useDashboardKpis.ts` usando `useQuery` de TanStack Query v5, con `queryKey: DASHBOARD_QUERY_KEYS.kpis(periodo)` y `queryFn: () => getDashboardKpis(periodo)`.

#### Scenario: Consulta retorna los 9 KpiResult
- **WHEN** un componente llama `useDashboardKpis()`
- **THEN** el hook retorna `{ data, isLoading, isError }` con `data` poblado desde MSW conteniendo 9 elementos

#### Scenario: Reactividad ante cambio de periodo
- **WHEN** el argumento `periodo` cambia de `'2026-02'` a `'2026-03'`
- **THEN** TanStack Query dispara una nueva petición por el cambio de `queryKey`

---

### Requirement: Hook useDashboardSummary
El sistema SHALL implementar `useDashboardSummary()` en `src/features/dashboard/hooks/useDashboardSummary.ts` usando `useQuery` con `queryKey: DASHBOARD_QUERY_KEYS.summary()`, `queryFn: getDashboardSummary`, y `enabled: Boolean(authStore.user)` (no se ejecuta sin usuario autenticado).

#### Scenario: Consulta deshabilitada sin usuario autenticado
- **WHEN** `authStore.user` es `null` y se monta un componente que llama `useDashboardSummary()`
- **THEN** la query no se ejecuta (`enabled: false`, sin request a MSW)

#### Scenario: Consulta habilitada retorna la forma correcta para el rol autenticado
- **WHEN** `authStore.user.rol === 'SUPERVISOR'` y se llama `useDashboardSummary()`
- **THEN** el hook retorna `data.rol === 'SUPERVISOR'` y `data.data` con la forma de `SupervisorDashboardData`

---

### Requirement: Ningún hook de dashboard expone mutaciones en S01
Este change SHALL exponer únicamente hooks de lectura (`useDashboardKpis`, `useDashboardSummary`). Ningún `useMutation` SHALL agregarse en `src/features/dashboard/hooks/` en este change.

#### Scenario: Directorio de hooks de dashboard no contiene mutaciones
- **WHEN** se inspecciona `src/features/dashboard/hooks/`
- **THEN** ningún archivo exporta un hook que use `useMutation`
