import { useQuery } from '@tanstack/react-query'
import { getQEAcciones } from '../api/quality-events.api'

export const QE_ACCIONES_QUERY_KEY = (qeId: string) => ['quality-events', 'acciones', qeId] as const

export function useQEAcciones(qeId: string) {
  return useQuery({
    queryKey: QE_ACCIONES_QUERY_KEY(qeId),
    queryFn: () => getQEAcciones(qeId),
    enabled: Boolean(qeId),
  })
}
