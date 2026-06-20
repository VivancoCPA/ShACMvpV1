import { z } from 'zod'

const userRoleEnum = z.enum([
  'OPERARIO',
  'SUPERVISOR',
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
])

export const documentFormSchema = z
  .object({
    titulo: z.string().min(5).max(200),
    tipo: z.enum(['POL', 'PRC', 'INS', 'REG', 'INF', 'MAT', 'PLAN']),
    area: z.string().min(2).max(100),
    version: z.string().regex(/^v\d+\.\d+$/, { message: 'Formato requerido: v1.0, v2.3, etc.' }),
    confidencialidad: z.enum(['PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'RESTRINGIDO']),
    rolesAutorizados: z.array(userRoleEnum).optional(),
    revisorId: z.string().optional().or(z.literal('')),
    aprobadorId: z.string().optional().or(z.literal('')),
    fechaVigencia: z.string().optional(),
    fechaRevisionProxima: z.string().optional(),
    descripcion: z.string().max(1000).optional(),
    archivo: z.instanceof(File).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.confidencialidad === 'RESTRINGIDO' &&
      (!data.rolesAutorizados || data.rolesAutorizados.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 1,
        origin: 'array',
        inclusive: true,
        path: ['rolesAutorizados'],
        message: 'Debes seleccionar al menos un rol autorizado para documentos RESTRINGIDO.',
      })
    }
  })

export type DocumentFormInput = z.infer<typeof documentFormSchema>
