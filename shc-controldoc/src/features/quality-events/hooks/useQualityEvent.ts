import { useQuery } from '@tanstack/react-query'
import { getQualityEvent } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useQualityEvent(id: string) {
  return useQuery({
    queryKey: QE_QUERY_KEYS.detail(id),
    queryFn: () => getQualityEvent(id),
    enabled: Boolean(id),
  })
}
