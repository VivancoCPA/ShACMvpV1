import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { registrarVerificacionEficacia } from '../api/quality-events.api'
import type { VerificacionEficaciaInput } from '../schemas/verificacionEficacia.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import { QUERY_KEYS as NC_QUERY_KEYS } from '../../nonconformities/hooks/useNonconformities'

export function useVerificacionEficacia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VerificacionEficaciaInput }) =>
      registrarVerificacionEficacia(id, data),
    onSuccess: (qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
      // Ver diagnóstico de sincronización de estado: NO_EFECTIVO reabre el QE (y el Incidente/NC
      // vinculado vuelve a EN_INVESTIGACION); EFECTIVO no mueve al origen (ya en
      // CERRADO/CERRADA), pero invalidar siempre es seguro y evita depender de recordar el caso
      // correcto. .all cubre tanto el detalle como el listado.
      if (qe.incidenteId) {
        void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      }
      if (qe.ncId) {
        void queryClient.invalidateQueries({ queryKey: NC_QUERY_KEYS.nonconformities.all })
      }
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      const message = axiosError.response?.data?.message ?? 'Error al registrar la verificación de eficacia'
      toast.error(message)
    },
  })
}
