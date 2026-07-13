export type UserRole =
  | 'OPERARIO'
  | 'SUPERVISOR'
  | 'JEFE_CALIDAD_SYST'
  | 'JEFE_CONTROL_DOCUMENTARIO'
  | 'AUDITOR_INTERNO'
  | 'ALTA_DIRECCION'
  | 'ADMINISTRADOR_SISTEMA'

export interface User {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: UserRole
  area?: string
  /** Áreas que este Supervisor gestiona para efectos de permisos de QE (RN-QE-014). Solo relevante para `rol === 'SUPERVISOR'`; subconjunto de AREAS_SHAC. */
  areasAsignadas?: string[]
  avatarUrl?: string
  /** Fecha de creación de cuenta (ISO 8601), semilla fija por usuario mock. */
  createdAt: string
  /** Fecha/hora del último login exitoso (ISO 8601). Ausente si el usuario nunca inició sesión en el mock desde que se agregó el campo. */
  lastLogin?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
}
