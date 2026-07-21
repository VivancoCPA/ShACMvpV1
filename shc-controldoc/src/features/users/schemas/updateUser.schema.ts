import { z } from 'zod'

const userRoleEnum = z.enum([
  'OPERARIO',
  'SUPERVISOR',
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
  'ADMINISTRADOR_SISTEMA',
])

export const updateUserSchema = z
  .object({
    nombre: z.string().min(1, 'users:form.validation.nombreRequired'),
    apellido: z.string().min(1, 'users:form.validation.apellidoRequired'),
    email: z.string().email('users:form.validation.emailInvalid'),
    rol: userRoleEnum,
    areaId: z.string().optional(),
    areaIds: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rol === 'SUPERVISOR') {
      if (!data.areaId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'users:form.validation.areaRequired',
          path: ['areaId'],
        })
      }
      if (!data.areaIds || data.areaIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'users:form.validation.areasAsignadasRequired',
          path: ['areaIds'],
        })
      }
    }
  })

export type UpdateUserInput = z.infer<typeof updateUserSchema>
