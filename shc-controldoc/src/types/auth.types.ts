export type UserRole =
  | 'OPERARIO'
  | 'SUPERVISOR'
  | 'JEFE_CALIDAD_SYST'
  | 'JEFE_CONTROL_DOCUMENTARIO'
  | 'AUDITOR_INTERNO'
  | 'ALTA_DIRECCION'

export interface User {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: UserRole
  area?: string
  avatarUrl?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
}
