import type { UserRole } from '../../../types/auth.types'

export type EmpresaEstado = 'ACTIVA' | 'INACTIVA'

export interface Empresa {
  id: string
  razonSocial: string
  ruc: string
  estado: EmpresaEstado
  logoUrl: string
  fechaAlta: string
}

export type UsuarioEmpresaEstado = 'ACTIVO' | 'INACTIVO'

export interface UsuarioEmpresa {
  usuarioId: string
  empresaId: string
  rol: UserRole
  estado: UsuarioEmpresaEstado
  fechaAsignacion: string
}
