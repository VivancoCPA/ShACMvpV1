import { useQuery } from '@tanstack/react-query'
import api from '../../../lib/axios'
import type { Local } from '../types/incident.types'

async function fetchLocales(): Promise<Local[]> {
  const response = await api.get<Local[]>('/api/locales')
  return response.data
}

export function useLocales() {
  return useQuery({
    queryKey: ['locales'] as const,
    queryFn: fetchLocales,
  })
}
