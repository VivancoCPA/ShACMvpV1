import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../../stores/authStore'
import { getDashboardSummary } from '../api/dashboard.api'
import { DASHBOARD_QUERY_KEYS } from './dashboardQueryKeys'

export function useDashboardSummary() {
  const user = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.summary(),
    queryFn: getDashboardSummary,
    enabled: Boolean(user),
  })
}
