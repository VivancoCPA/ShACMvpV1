import type { QueryClient } from '@tanstack/react-query'
import { DASHBOARD_QUERY_KEYS } from '../hooks/dashboardQueryKeys'

// Refresca el summary y los KPI de cualquier período (key raíz ['dashboard']) para que las tarjetas
// de "Requiere atención" no queden desactualizadas tras una acción propia o una notificación
// (dashboard-alertas-coherentes D5). Sin polling.
export function invalidarDashboard(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.all })
}
