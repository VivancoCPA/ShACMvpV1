import api from '../../lib/axios'
import type { User, UserRole } from '../../types/auth.types'
import type { AccionCorrectivaTipo, CandidatoUsuario } from '../../constants/accionCorrectivaTipo.constants'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordResponse,
  UserFilters,
  UserNombre,
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

// Accesible a cualquier usuario autenticado con empresa activa (sin restricción de rol) —
// alimenta texto de display en Documentos/QE/NC, nunca un selector de asignación.
export async function getUserNames(ids: string[]): Promise<UserNombre[]> {
  const response = await api.get<UserNombre[]>('/api/users/nombres', {
    params: { ids: ids.join(',') },
  })
  return response.data
}

// Selectores operativos (auditor de la verificación, "Detectado por" de NC). Accesible a cualquier
// rol con empresa activa; el backend nunca devuelve roles de administración (ac-tipo-responsables).
export async function getCandidatosUsuarios(roles: readonly UserRole[]): Promise<CandidatoUsuario[]> {
  const response = await api.get<CandidatoUsuario[]>('/api/users/candidatos', {
    params: { roles: roles.join(',') },
  })
  return response.data
}

// Responsables elegibles para una AC según su tipo (ResponsableAcPolicy en el backend).
export async function getCandidatosResponsableAC(tipo: AccionCorrectivaTipo): Promise<CandidatoUsuario[]> {
  const response = await api.get<CandidatoUsuario[]>('/api/acciones-correctivas/candidatos-responsable', {
    params: { tipo },
  })
  return response.data
}
