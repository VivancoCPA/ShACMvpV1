import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getDashboardKpis } from '../api/dashboard.api'
import { DASHBOARD_QUERY_KEYS } from './dashboardQueryKeys'

// periodo: `yyyy-MM`, `yyyy-Qn` o `yyyy` (usePeriodoKpi). keepPreviousData evita que los anillos
// queden vacíos mientras carga el período nuevo.
export function useDashboardKpis(periodo?: string) {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.kpis(periodo),
    queryFn: () => getDashboardKpis(periodo),
    placeholderData: keepPreviousData,
  })
}
