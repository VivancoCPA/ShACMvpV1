import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listUsers,
  createUser,
  updateUser,
  toggleUserActive,
  resetUserPassword,
} from '../../../api/endpoints/users.api'
import { useAuthStore } from '../../../stores/authStore'
import { recordUserAuditTrail } from '../utils/userAuditTrail'
import type { CreateUserRequest, UpdateUserRequest, UserFilters } from '../types/userManagement.types'

export const USERS_QUERY_KEYS = {
  all: ['users'] as const,
  list: (filters: UserFilters = {}) => ['users', 'list', filters] as const,
} as const

function getCurrentUser(): { id: string; nombre: string } {
  const user = useAuthStore.getState().user
  if (!user) return { id: 'user-current', nombre: 'Usuario actual' }
  return { id: user.id, nombre: `${user.nombre} ${user.apellido}` }
}

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: USERS_QUERY_KEYS.list(filters),
    queryFn: () => listUsers(filters),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateUserRequest) => createUser(data),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.all })
      const currentUser = getCurrentUser()
      recordUserAuditTrail({
        entidadId: created.id,
        accion: 'CREADO',
        estadoNuevo: 'ACTIVO',
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
      })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) => updateUser(id, data),
    onSuccess: (_updated, { id }) => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.all })
      const currentUser = getCurrentUser()
      recordUserAuditTrail({
        entidadId: id,
        accion: 'CAMPO_EDITADO',
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
      })
    },
  })
}

export function useToggleUserActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => toggleUserActive(id),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.all })
      const currentUser = getCurrentUser()
      recordUserAuditTrail({
        entidadId: updated.id,
        accion: 'ESTADO_CAMBIADO',
        estadoAnterior: String(!updated.activo),
        estadoNuevo: String(updated.activo),
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
      })
    },
  })
}

export function useResetUserPassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => resetUserPassword(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.all })
      const currentUser = getCurrentUser()
      recordUserAuditTrail({
        entidadId: id,
        accion: 'CONTRASENA_RESETEADA',
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
      })
    },
  })
}
