import { z } from 'zod'

// Devolver una AC exige motivo de 20 a 500 caracteres (ac-ejecucion-verificacion-evidencias).
export const devolverQEAccionSchema = z.object({
  comentario: z
    .string()
    .trim()
    .min(20, 'El motivo debe tener al menos 20 caracteres.')
    .max(500, 'El motivo no debe superar 500 caracteres.'),
})

export type DevolverQEACInput = z.infer<typeof devolverQEAccionSchema>

export type VerificarQEACInput = { aprobada: true } | { aprobada: false; comentario: string }
