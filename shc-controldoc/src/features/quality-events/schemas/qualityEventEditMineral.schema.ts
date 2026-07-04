import { z } from 'zod'

export const qualityEventEditMineralSchema = z
  .object({
    mineralInvolucrado: z.string().min(1),
  })
  .strict()

export type QualityEventEditMineralInput = z.infer<typeof qualityEventEditMineralSchema>
