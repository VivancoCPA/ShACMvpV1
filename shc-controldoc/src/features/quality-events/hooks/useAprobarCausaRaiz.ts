import { useMutation, useQueryClient } from '@tanstack/react-query'
import { aprobarCausaRaiz } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'

// Sin toast de error propio: QEInvestigationSection decide entre error inline en el PinModal
// (PIN_INCORRECTO / PIN_NO_CONFIGURADO) y toast para el resto.
export function useAprobarCausaRaiz() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => aprobarCausaRaiz(id, pin),
    onSuccess: (_qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
    },
  })
}
