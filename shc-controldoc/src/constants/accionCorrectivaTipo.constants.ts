import type { UserRole } from '../types/auth.types'

// PRD §2.2 "Tipo de acción": obligatorio al crear y no editable (ac-tipo-responsables).
// Debe calzar con `AccionCorrectivaTipo` del backend.
export const AC_TIPOS = ['CORRECTIVA', 'PREVENTIVA', 'MEJORA'] as const

export type AccionCorrectivaTipo = (typeof AC_TIPOS)[number]

// Espejo de `ResponsableAcPolicy.RolesPermitidos` del backend (ac-tipo-responsables D1). El backend
// es la fuente de verdad — esta tabla solo la usa el MSW para reproducir el mismo filtrado.
export const ROLES_RESPONSABLE_POR_TIPO_AC: Record<AccionCorrectivaTipo, readonly UserRole[]> = {
  CORRECTIVA: [
    'OPERARIO',
    'SUPERVISOR',
    'JEFE_CALIDAD_SYST',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
    'ALTA_DIRECCION',
  ],
  PREVENTIVA: ['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'ALTA_DIRECCION'],
  MEJORA: ['JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'ALTA_DIRECCION'],
}

// Roles de administración: nunca son responsables de una AC ni candidatos de un selector operativo.
export const ROLES_ADMINISTRACION: readonly UserRole[] = ['ADMINISTRADOR_EMPRESA', 'ADMINISTRADOR_SISTEMA', 'SUPERADMIN']

// Roles operativos de la empresa (OPE, SUP, JCA, JCD, AUD, DIR).
export const ROLES_OPERATIVOS: readonly UserRole[] = ROLES_RESPONSABLE_POR_TIPO_AC.CORRECTIVA

export function isAccionCorrectivaTipo(value: unknown): value is AccionCorrectivaTipo {
  return typeof value === 'string' && (AC_TIPOS as readonly string[]).includes(value)
}

// Candidato a responsable de AC / a un selector operativo — GET /api/acciones-correctivas/candidatos-responsable
// y GET /api/users/candidatos devuelven la misma forma.
export interface CandidatoUsuario {
  id: string
  nombreCompleto: string
  rol: UserRole
  avatarUrl?: string | null
}
