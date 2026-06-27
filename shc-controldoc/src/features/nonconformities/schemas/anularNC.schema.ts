import { z } from 'zod'

export const anularNCSchema = z.object({
  justificacion: z
    .string()
    .min(20, 'La justificación debe tener al menos 20 caracteres.')
    .max(2000),
})

export type AnularNCInput = z.infer<typeof anularNCSchema>
