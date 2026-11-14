import type { AccionCorrectivaTipo } from '../../../constants/accionCorrectivaTipo.constants'
import type { UserRole } from '../../../types/auth.types'

// GET/PUT /api/empresas/{id}/responsables-ac — espejo de ConfiguracionResponsablesAcDto del backend
// (ac-responsables-configurable-empresa).
export interface TipoResponsablesAc {
  tipo: AccionCorrectivaTipo
  roles: UserRole[]
  /** true si la empresa no tiene configuración propia para este tipo (usa los valores por defecto). */
  esDefault: boolean
}

export interface ConfiguracionResponsablesAc {
  empresaId: string
  tipos: TipoResponsablesAc[]
  rolesDisponibles: UserRole[]
  actualizadoPorNombre: string | null
  actualizadoEn: string | null
}

export interface ActualizarResponsablesAcInput {
  tipos: { tipo: AccionCorrectivaTipo; roles: UserRole[] }[]
}
