import { z } from 'zod'

export const createDocumentSchema = z.object({
  titulo: z.string().min(5).max(200),
  tipo: z.enum(['POL', 'PRC', 'INS', 'REG', 'INF', 'MAT', 'PLAN']),
  area: z.string().min(1),
  revisorId: z.string().uuid(),
  aprobadorId: z.string().uuid(),
  descripcion: z.string().max(2000).optional(),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
