import { z } from 'zod'
import { DOCUMENT_AUTHORIZED_ROLES } from '../constants'

const userRoleEnum = z.enum(DOCUMENT_AUTHORIZED_ROLES)

export const createDocumentSchema = z
  .object({
    titulo: z.string().min(5).max(200),
    tipo: z.enum(['POL', 'PRC', 'INS', 'REG', 'INF', 'MAT', 'PLAN']),
    areaId: z.string().min(1),
    confidencialidad: z.enum(['PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'RESTRINGIDO']).default('INTERNO'),
    rolesAutorizados: z.array(userRoleEnum).optional(),
    revisorId: z.string().uuid().optional(),
    aprobadorId: z.string().uuid().optional(),
    descripcion: z.string().max(2000).optional(),
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
        message: 'Se requiere al menos un rol para documentos RESTRINGIDO.',
      })
    }
  })

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
