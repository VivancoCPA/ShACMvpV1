import { useQuery } from '@tanstack/react-query'
import { localesApi } from '../../../api/endpoints/locales.api'
import type { Local } from '../types/incident.types'

export function useLocales() {
  const query = useQuery({
    queryKey: ['locales', 'list', { activo: true }] as const,
    queryFn: () => localesApi.getLocales({ activo: true }),
  })

  const locales: Local[] = query.data ?? []

  return {
    locales,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
