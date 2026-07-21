import type { User } from '../../../types/auth.types'

export function puedeAdministrarAreas(usuario: User): boolean {
  return usuario.rol === 'ADMINISTRADOR_SISTEMA'
}

export function puedeConsultarAreas(_usuario: User): boolean {
  return true
}
