import { z } from 'zod'

export const updateDocumentSchema = z.object({
  titulo: z.string().min(5).max(200).optional(),
  descripcion: z.string().max(2000).optional(),
  revisorId: z.string().uuid().optional(),
  aprobadorId: z.string().uuid().optional(),
  fechaVigencia: z.string().optional(),
})

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
