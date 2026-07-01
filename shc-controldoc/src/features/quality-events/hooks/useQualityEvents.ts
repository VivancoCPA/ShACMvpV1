import { useQuery } from '@tanstack/react-query'
import { getQualityEvents } from '../api/quality-events.api'
import type { QEListParams } from '../types/qualityEvent.types'

export const QE_QUERY_KEYS = {
  all: ['quality-events'] as const,
  list: (filters: QEListParams) => ['quality-events', 'list', filters] as const,
  detail: (id: string) => ['quality-events', 'detail', id] as const,
} as const

export function useQualityEvents(filters: QEListParams) {
  return useQuery({
    queryKey: QE_QUERY_KEYS.list(filters),
    queryFn: () => getQualityEvents(filters),
  })
}
