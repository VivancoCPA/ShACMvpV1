import { z } from 'zod'

// Excluye 'SUPERADMIN' a propósito — es un flag global (User.esSuperadminMultiempresa),
// nunca un rol asignado vía UsuarioEmpresa (ver empresa-admin-types).
const asignableRoleEnum = z.enum([
  'OPERARIO',
  'SUPERVISOR',
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
  'ADMINISTRADOR_SISTEMA',
  'ADMINISTRADOR_EMPRESA',
])

export const asignarUsuarioEmpresaSchema = z.object({
  usuarioId: z.string().min(1, 'empresas:asignacion.validation.usuarioRequired'),
  rol: asignableRoleEnum,
})

export type AsignarUsuarioEmpresaInput = z.infer<typeof asignarUsuarioEmpresaSchema>
