import { useQuery } from '@tanstack/react-query'
import api from '../../../lib/axios'
import type { Zona } from '../types/incident.types'

async function fetchZonasByLocal(localId: string): Promise<Zona[]> {
  const response = await api.get<Zona[]>(`/api/locales/${localId}/zonas`)
  return response.data
}

export function useZonasByLocal(localId: string) {
  return useQuery({
    queryKey: ['locales', localId, 'zonas'] as const,
    queryFn: () => fetchZonasByLocal(localId),
    enabled: localId !== '',
  })
}
