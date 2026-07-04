import { z } from 'zod'

export const qualityEventEditSeveridadSchema = z
  .object({
    severidad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']),
  })
  .strict()

export type QualityEventEditSeveridadInput = z.infer<typeof qualityEventEditSeveridadSchema>
