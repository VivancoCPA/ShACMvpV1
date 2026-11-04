import { useMutation, useQueryClient } from '@tanstack/react-query'
import { asistirCausaRaizIA } from '../api/quality-events.api'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'
import type { AnalisisCausaRaizMetodo } from '../types/qualityEvent.types'

// Sin toast propio: QEInvestigationSection distingue IA_LIMITE_DIARIO del resto. La consulta
// solo agrega ASISTENTE_IA_CONSULTADO al audit trail; el QE no cambia.
export function useAsistenteIA() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, metodo }: { id: string; metodo: AnalisisCausaRaizMetodo }) => asistirCausaRaizIA(id, metodo),
    onSuccess: (_sugerencia, { id }) => {
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
    },
  })
}
