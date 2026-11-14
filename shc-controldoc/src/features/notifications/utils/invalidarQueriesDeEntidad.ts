import { queryClient } from '../../../lib/queryClient'
import { QUERY_KEYS as DOCUMENTS_QUERY_KEYS } from '../../documents/constants'
import { QE_QUERY_KEYS } from '../../quality-events/hooks/useQualityEvents'
import { invalidarDashboard } from '../../dashboard/utils/invalidarDashboard'
import type { Notificacion } from '../../../types/notification.types'

// Refresca las queries de la entidad a la que apunta una notificación nueva, para que una acción
// de OTRO usuario se vea sin recargar (refetchOnWindowFocus está apagado a nivel global). Lo usan
// las dos vías de entrega: el hub SignalR (useNotificationsHub, solo SEVERIDAD_CRITICA/CIERRE) y
// el diffing del polling (useNotificationToast, el resto — p.ej. la ASIGNACION de responsable de
// investigación, que alimenta los pendientes del dashboard; pendientes-qe-asignacion-y-menus D3).
export function invalidarQueriesDeEntidad(notificacion: Pick<Notificacion, 'entidadTipo' | 'entidadId'>): void {
  // Cualquier notificación puede cambiar una tarjeta del dashboard (dashboard-alertas-coherentes D5).
  invalidarDashboard(queryClient)

  if (notificacion.entidadTipo === 'DOCUMENTO') {
    void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEYS.documents.detail(notificacion.entidadId) })
    void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEYS.documents.all })
  }

  if (notificacion.entidadTipo === 'QE') {
    void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
    void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(notificacion.entidadId) })
  }
}
