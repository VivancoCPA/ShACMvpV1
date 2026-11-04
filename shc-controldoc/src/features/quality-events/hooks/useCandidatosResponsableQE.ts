import { useQuery } from '@tanstack/react-query'
import { getCandidatosResponsableQE } from '../api/quality-events.api'

export const QE_CANDIDATOS_RESPONSABLE_QUERY_KEY = ['quality-events', 'candidatos-responsable'] as const

export function useCandidatosResponsableQE(enabled = true) {
  return useQuery({
    queryKey: QE_CANDIDATOS_RESPONSABLE_QUERY_KEY,
    queryFn: getCandidatosResponsableQE,
    enabled,
  })
}
