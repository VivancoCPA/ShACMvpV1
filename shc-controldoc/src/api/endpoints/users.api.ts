import api from '../../lib/axios'
import type { User } from '../../types/auth.types'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordResponse,
  UserFilters,
} from '../../features/users/types/userManagement.types'

export async function listUsers(filters: UserFilters = {}): Promise<User[]> {
  const params: Record<string, unknown> = {}
  if (filters.rol) params.rol = filters.rol
  if (filters.activo !== undefined) params.activo = filters.activo

  const response = await api.get<User[]>('/api/users', { params })
  return response.data
}

export async function createUser(
  data: CreateUserRequest,
): Promise<User & { temporaryPassword: string }> {
  const response = await api.post<User & { temporaryPassword: string }>('/api/users', data)
  return response.data
}

export async function updateUser(id: string, data: UpdateUserRequest): Promise<User> {
  const response = await api.patch<User>(`/api/users/${id}`, data)
  return response.data
}

export async function toggleUserActive(id: string): Promise<User> {
  const response = await api.patch<User>(`/api/users/${id}/toggle-active`)
  return response.data
}

export async function resetUserPassword(id: string): Promise<ResetPasswordResponse> {
  const response = await api.post<ResetPasswordResponse>(`/api/users/${id}/reset-password`)
  return response.data
}
