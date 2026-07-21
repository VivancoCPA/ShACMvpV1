import type { UserRole } from '../../../types/auth.types'

export interface CreateUserRequest {
  nombre: string
  apellido: string
  email: string
  rol: UserRole
  areaId?: string
  areaIds?: string[]
  avatarBase64?: string
}

export interface UpdateUserRequest {
  nombre?: string
  apellido?: string
  email?: string
  rol?: UserRole
  areaId?: string
  areaIds?: string[]
  avatarBase64?: string
}

export interface ResetPasswordResponse {
  temporaryPassword: string
}

export interface ToggleActiveRequest {
  id: string
}

export interface UserFilters {
  rol?: UserRole
  activo?: boolean
}

/** entidadTipo propio del dominio de usuarios — CLAUDE.md restringe AuditTrailEntry a
 * 'QualityEvent' | 'Documento' | 'AccionCorrectiva'; este dominio nuevo usa 'Usuario'. */
export interface UserAuditTrailEntry {
  id: string
  entidadTipo: 'Usuario'
  entidadId: string
  accion: string
  estadoAnterior?: string
  estadoNuevo?: string
  campoModificado?: string
  valorAnterior?: string
  valorNuevo?: string
  realizadoPorId: string
  realizadoPorNombre: string
  timestamp: string
  ipOrigen?: string
  generadoPorIA: boolean
}
