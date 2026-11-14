import { z } from 'zod'
import { AC_TIPOS, ROLES_OPERATIVOS } from '../../../constants/accionCorrectivaTipo.constants'
import type { UserRole } from '../../../types/auth.types'
import type { ActualizarResponsablesAcInput, ConfiguracionResponsablesAc } from '../types/responsablesAc.types'

// Cada tipo necesita al menos un rol, y solo roles operativos (mismas reglas que el PUT, D4).
const rolesSchema = z
  .array(z.enum(ROLES_OPERATIVOS as [UserRole, ...UserRole[]]))
  .min(1, 'users:responsablesAc.alMenosUno')

export const responsablesAcSchema = z.object({
  CORRECTIVA: rolesSchema,
  PREVENTIVA: rolesSchema,
  MEJORA: rolesSchema,
})

export type ResponsablesAcFormValues = z.infer<typeof responsablesAcSchema>

export function toResponsablesAcFormValues(data: ConfiguracionResponsablesAc): ResponsablesAcFormValues {
  const porTipo = new Map(data.tipos.map((t) => [t.tipo, t.roles]))
  return {
    CORRECTIVA: porTipo.get('CORRECTIVA') ?? [],
    PREVENTIVA: porTipo.get('PREVENTIVA') ?? [],
    MEJORA: porTipo.get('MEJORA') ?? [],
  }
}

export function toResponsablesAcInput(values: ResponsablesAcFormValues): ActualizarResponsablesAcInput {
  return { tipos: AC_TIPOS.map((tipo) => ({ tipo, roles: values[tipo] })) }
}
