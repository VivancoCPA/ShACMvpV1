import { z } from 'zod'

export const verificacionEficaciaSchema = z.object({
  resultado: z.enum(['EFECTIVO', 'NO_EFECTIVO']),
  evidencia: z.string().trim().min(1, 'La evidencia es obligatoria'),
})

export type VerificacionEficaciaInput = z.infer<typeof verificacionEficaciaSchema>
