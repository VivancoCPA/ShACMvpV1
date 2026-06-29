import { z } from 'zod'

export const cerrarACIncidenteSchema = z.object({
  descripcionEvidencia: z.string().min(1, 'La descripción de la evidencia es obligatoria.').max(2000),
  evidenciaUrl: z.string().optional(),
})

export type CerrarACIncidenteInput = z.infer<typeof cerrarACIncidenteSchema>
