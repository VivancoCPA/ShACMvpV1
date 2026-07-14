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
    area: z.string().optional(),
    areasAsignadas: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rol === 'SUPERVISOR') {
      if (!data.area) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'users:form.validation.areaRequired',
          path: ['area'],
        })
      }
      if (!data.areasAsignadas || data.areasAsignadas.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'users:form.validation.areasAsignadasRequired',
          path: ['areasAsignadas'],
        })
      }
    }
  })

export type UpdateUserInput = z.infer<typeof updateUserSchema>
