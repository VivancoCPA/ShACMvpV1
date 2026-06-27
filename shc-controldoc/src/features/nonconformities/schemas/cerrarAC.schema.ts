import { z } from 'zod'

export const cerrarACSchema = z.object({
  descripcionEvidencia: z.string().min(1, 'La descripción de la evidencia es obligatoria.').max(2000),
  evidenciaUrl: z.string().optional(),
})

export type CerrarACInput = z.infer<typeof cerrarACSchema>
