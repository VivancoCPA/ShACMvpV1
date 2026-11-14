import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createQEAccion } from '../api/quality-events.api'
import type { CreateQEACInput } from '../schemas/createQEAccion.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { invalidarDashboard } from '../../dashboard/utils/invalidarDashboard'

export function useCreateQEAccion(qeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateQEACInput) => createQEAccion(qeId, data),
    onSuccess: () => {
      invalidarDashboard(queryClient)
      // Crear una AC atiende una solicitud pendiente (solicitudes-ac-y-ac-del-qe-en-origen): se
      // refrescan detalle, lista (badge) y la sublista de AC que leen el incidente y la NC.
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
      toast.success('Acción correctiva creada.')
    },
    onError: () => {
      toast.error('Error al crear la acción correctiva.')
    },
  })
}
