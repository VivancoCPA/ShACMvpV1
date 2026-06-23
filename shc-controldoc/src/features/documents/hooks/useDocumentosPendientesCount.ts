import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../../stores/authStore'
import { getPendientesCount } from '../../../api/endpoints/documents.api'
import { QUERY_KEYS } from '../constants'

export function useDocumentosPendientesCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userId = useAuthStore((s) => s.user?.id) ?? ''
  const enabled = isAuthenticated && !!userId

  return useQuery({
    queryKey: QUERY_KEYS.documents.pendientesCount(userId),
    queryFn: () => getPendientesCount(),
    enabled,
    refetchInterval: enabled ? 60_000 : false,
    staleTime: 30_000,
  })
}
