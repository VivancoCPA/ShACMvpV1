import type { User } from '../../../types/auth.types'

/** CRUD de `Empresa` (`/admin/empresas`) — exclusivo de SUPERADMIN. */
export function puedeAdministrarEmpresas(usuario: User): boolean {
  return usuario.rol === 'SUPERADMIN'
}

/** Asignar/desactivar `UsuarioEmpresa` entre empresas (RN-EMP-006) — exclusivo de SUPERADMIN. */
export function puedeAdministrarUsuariosEntreEmpresas(usuario: User): boolean {
  return usuario.rol === 'SUPERADMIN'
}
