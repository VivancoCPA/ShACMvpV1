import { useQuery } from '@tanstack/react-query'
import { getCandidatosUsuarios } from '../../../api/endpoints/users.api'
import type { UserRole } from '../../../types/auth.types'

/**
 * Usuarios activos de la empresa con alguno de los roles pedidos, vía GET /api/users/candidatos.
 * Para selectores de módulos operativos — GET /api/users (useUsers) es solo de administración.
 */
export function useCandidatosUsuarios(roles: readonly UserRole[]) {
  const sortedRoles = [...roles].sort()
  return useQuery({
    queryKey: ['users', 'candidatos', sortedRoles],
    queryFn: () => getCandidatosUsuarios(sortedRoles),
    enabled: sortedRoles.length > 0,
    staleTime: 5 * 60_000,
  })
}
