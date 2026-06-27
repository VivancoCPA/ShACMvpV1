import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../api/nonconformities.api'

export const USERS_QUERY_KEY = ['users'] as const

export function useUsers() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: getUsers,
    staleTime: 10 * 60 * 1000,
  })
}
