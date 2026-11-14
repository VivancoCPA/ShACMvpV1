import { z } from 'zod'

// PRD §2.2: descripción de la evidencia de 50 a 300 caracteres (ac-ejecucion-verificacion-evidencias).
export const EJECUTAR_DESCRIPCION_MIN = 50
export const EJECUTAR_DESCRIPCION_MAX = 300

export const ejecutarQEAccionSchema = z.object({
  descripcionEvidencia: z
    .string()
    .trim()
    .min(EJECUTAR_DESCRIPCION_MIN, 'La descripción debe tener al menos 50 caracteres.')
    .max(EJECUTAR_DESCRIPCION_MAX, 'La descripción no debe superar 300 caracteres.'),
})

export type EjecutarQEACInput = z.infer<typeof ejecutarQEAccionSchema>
