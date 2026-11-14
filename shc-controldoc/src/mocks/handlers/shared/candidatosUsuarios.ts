import { HttpResponse } from 'msw'
import { getUsersStore } from '../../fixtures/auth.fixtures'
import { getRolEfectivo } from '../../fixtures/empresas.fixtures'
import { getRolesResponsableAC } from '../../fixtures/responsablesAc.fixtures'
import {
  ROLES_ADMINISTRACION,
  isAccionCorrectivaTipo,
  type AccionCorrectivaTipo,
  type CandidatoUsuario,
} from '../../../constants/accionCorrectivaTipo.constants'
import type { UserRole } from '../../../types/auth.types'

// Espejo de CandidatosUsuariosHandler / ResponsableAcPolicy del backend (ac-tipo-responsables):
// usuario activo + asignación ACTIVO en la empresa, contando el rol de la empresa (getRolEfectivo
// ya exige estado ACTIVO), nunca roles de administración.
export function getCandidatosPorRoles(empresaId: string, roles: readonly UserRole[]): CandidatoUsuario[] {
  const permitidos = roles.filter((r) => !ROLES_ADMINISTRACION.includes(r))
  return getUsersStore()
    .filter((u) => u.activo)
    .flatMap((u): CandidatoUsuario[] => {
      const rol = getRolEfectivo(u.id, empresaId)
      if (!rol || !permitidos.includes(rol)) return []
      return [{ id: u.id, nombreCompleto: `${u.nombre} ${u.apellido}`, rol, avatarUrl: u.avatarUrl ?? null }]
    })
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
}

// Roles de la configuración de la empresa o los defaults (ac-responsables-configurable-empresa).
export function getCandidatosResponsableAC(empresaId: string, tipo: AccionCorrectivaTipo): CandidatoUsuario[] {
  return getCandidatosPorRoles(empresaId, getRolesResponsableAC(empresaId, tipo))
}

export function esResponsableACValido(empresaId: string, tipo: AccionCorrectivaTipo, usuarioId: string): boolean {
  return getCandidatosResponsableAC(empresaId, tipo).some((c) => c.id === usuarioId)
}

/**
 * Valida `tipo` + `responsableId` del body de un POST de AC (QE, NC, incidente). Devuelve la
 * respuesta de error (400, mismo formato que FieldValidationException/ValidationException del
 * backend) o el tipo validado.
 */
export function validarTipoYResponsableAC(
  empresaId: string,
  body: Record<string, unknown>,
): { tipo: AccionCorrectivaTipo } | { error: Response } {
  const tipo = body.tipo
  if (!isAccionCorrectivaTipo(tipo)) {
    return {
      error: HttpResponse.json(
        { success: false, message: 'Error de validación.', errors: ["'Tipo' no debe estar vacío."] },
        { status: 400 },
      ),
    }
  }
  const responsableId = typeof body.responsableId === 'string' ? body.responsableId : ''
  if (!esResponsableACValido(empresaId, tipo, responsableId)) {
    return {
      error: HttpResponse.json(
        {
          success: false,
          message: 'Error de validación.',
          errors: [`responsableId: El responsable no puede asignarse a una acción de tipo ${tipo}`],
        },
        { status: 400 },
      ),
    }
  }
  return { tipo }
}
