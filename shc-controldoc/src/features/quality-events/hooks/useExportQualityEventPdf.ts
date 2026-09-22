import { useMutation, useQueryClient } from '@tanstack/react-query'
import { exportQualityEventPdf } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'

export function useExportQualityEventPdf(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    // El endpoint solo registra auditoría (204 No Content, sin QE en la respuesta) — el llamador
    // ya tiene el QE en mano (prop) y arma el PDF con esos datos, no con el resultado de esta
    // mutación (ver design.md Hallazgo 6). Se invalida tanto el detalle del QE (cuyo
    // `auditTrail` embebido alimenta la sección de auditoría del propio PDF) como la vista de
    // audit trail separada, para que una exportación subsiguiente ya refleje esta entrada.
    mutationFn: () => exportQualityEventPdf(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
    },
  })
}
