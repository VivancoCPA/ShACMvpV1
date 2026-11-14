import {
  ROLES_OPERATIVOS,
  ROLES_RESPONSABLE_POR_TIPO_AC,
  type AccionCorrectivaTipo,
} from '../../constants/accionCorrectivaTipo.constants'
import type { UserRole } from '../../types/auth.types'

// Espejo en memoria de config_responsables_ac_empresa (ac-responsables-configurable-empresa D8):
// una entrada por (empresa, tipo); sin entrada = defaults de ROLES_RESPONSABLE_POR_TIPO_AC.
export interface MockConfiguracionResponsablesAc {
  roles: UserRole[]
  actualizadoPorId: string
  actualizadoPorNombre: string
  actualizadoEn: string
}

const configuraciones = new Map<string, Partial<Record<AccionCorrectivaTipo, MockConfiguracionResponsablesAc>>>()

export function getConfiguracionesResponsablesAcStore(): Map<
  string,
  Partial<Record<AccionCorrectivaTipo, MockConfiguracionResponsablesAc>>
> {
  return configuraciones
}

export function resetResponsablesAcStore(): void {
  configuraciones.clear()
}

/** Espejo de ResponsableAcPolicy.RolesPermitidosAsync: la configuración de la empresa o el
 *  default, y siempre solo roles operativos (en orden canónico). */
export function getRolesResponsableAC(empresaId: string, tipo: AccionCorrectivaTipo): readonly UserRole[] {
  const guardados = configuraciones.get(empresaId)?.[tipo]?.roles
  if (!guardados) return ROLES_RESPONSABLE_POR_TIPO_AC[tipo]
  return ROLES_OPERATIVOS.filter((r) => guardados.includes(r))
}
