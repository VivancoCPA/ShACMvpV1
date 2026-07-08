import { useQuery } from '@tanstack/react-query'
import { getDashboardKpis } from '../api/dashboard.api'
import { DASHBOARD_QUERY_KEYS } from './dashboardQueryKeys'

export function useDashboardKpis(periodo?: string) {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.kpis(periodo),
    queryFn: () => getDashboardKpis(periodo),
  })
}
