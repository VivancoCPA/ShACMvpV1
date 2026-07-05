import type { User } from '../../../types/auth.types'

export function puedeAdministrarLocales(usuario: User): boolean {
  return usuario.rol === 'ADMINISTRADOR_SISTEMA'
}

export function puedeConsultarLocales(usuario: User): boolean {
  return usuario.rol === 'ADMINISTRADOR_SISTEMA' || usuario.rol === 'JEFE_CALIDAD_SYST'
}
