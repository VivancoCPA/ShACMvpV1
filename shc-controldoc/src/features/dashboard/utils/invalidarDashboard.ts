import type { QueryClient } from '@tanstack/react-query'
import { DASHBOARD_QUERY_KEYS } from '../hooks/dashboardQueryKeys'
import { AC_LISTADO_QUERY_KEYS } from '../../acciones-correctivas/hooks/useAccionesCorrectivasListado'

// Refresca el summary y los KPI de cualquier período (key raíz ['dashboard']) para que las tarjetas
// de "Requiere atención" no queden desactualizadas tras una acción propia o una notificación
// (dashboard-alertas-coherentes D5). Sin polling.
//
// También refresca el listado de acciones correctivas (modulo-acciones-correctivas D11): esta
// función ya se llama en todas las mutaciones de AC (QE, NC, incidente) y en cada notificación
// nueva, así que el listado queda cubierto sin tocar cada hook. Solo el prefijo 'listado': la
// configuración y los candidatos de responsables no se invalidan por esta vía.
export function invalidarDashboard(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.all })
  void queryClient.invalidateQueries({ queryKey: AC_LISTADO_QUERY_KEYS.all })
}
