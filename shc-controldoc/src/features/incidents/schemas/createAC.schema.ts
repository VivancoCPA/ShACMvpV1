import { z } from 'zod'

export const createACIncidenteSchema = z.object({
  descripcion: z.string().min(10).max(1000),
  responsableId: z.string().min(1),
  fechaLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type CreateACIncidenteInput = z.infer<typeof createACIncidenteSchema>
