import { useMutation, useQueryClient } from '@tanstack/react-query'
import { editarReporteInicial } from '../api/quality-events.api'
import type { QualityEventEditReporteInicialInput } from '../schemas/qualityEventEditReporteInicial.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useEditarReporteInicial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: QualityEventEditReporteInicialInput }) =>
      editarReporteInicial(id, data),
    onSuccess: (_qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
    },
  })
}
