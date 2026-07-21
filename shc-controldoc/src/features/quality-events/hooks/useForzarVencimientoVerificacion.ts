import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { forzarVencimientoVerificacion } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import { QUERY_KEYS as NC_QUERY_KEYS } from '../../nonconformities/hooks/useNonconformities'

export function useForzarVencimientoVerificacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, auditorAsignadoId }: { id: string; auditorAsignadoId?: string }) =>
      forzarVencimientoVerificacion(id, auditorAsignadoId),
    onSuccess: (qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
      // Ver diagnóstico de sincronización de estado: forzar EN_VERIFICACION no mueve al
      // Incidente/NC (mapea a CERRADO/CERRADA, donde ya está); forzar el vencimiento reabre el
      // QE a EN_INVESTIGACION y el origen debe reflejarlo sin refetch manual. .all cubre tanto
      // el detalle como el listado.
      if (qe.incidenteId) {
        void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      }
      if (qe.ncId) {
        void queryClient.invalidateQueries({ queryKey: NC_QUERY_KEYS.nonconformities.all })
      }
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      const message = axiosError.response?.data?.message ?? 'Error al forzar el vencimiento'
      toast.error(message)
    },
  })
}
