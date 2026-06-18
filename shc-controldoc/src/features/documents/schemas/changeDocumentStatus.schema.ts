import { z } from 'zod'

export const changeDocumentStatusSchema = z.object({
  nuevoEstado: z.enum([
    'BORRADOR',
    'EN_REVISION',
    'EN_APROBACION',
    'PUBLICADO',
    'OBSOLETO',
    'EN_REVISION_PERIODICA',
  ]),
  comentario: z.string().max(1000).optional(),
})

export type ChangeDocumentStatusInput = z.infer<typeof changeDocumentStatusSchema>
