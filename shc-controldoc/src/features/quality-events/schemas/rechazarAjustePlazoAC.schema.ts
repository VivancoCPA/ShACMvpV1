import { z } from 'zod'

export const rechazarAjustePlazoACSchema = z.object({
  comentarioRevision: z.string().min(1, 'El comentario de revisión es obligatorio.').max(2000),
})

export type RechazarAjustePlazoACInput = z.infer<typeof rechazarAjustePlazoACSchema>
