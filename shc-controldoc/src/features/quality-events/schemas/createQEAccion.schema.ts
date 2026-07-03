import { z } from 'zod'

export const createQEAccionSchema = z.object({
  titulo: z.string().max(200).optional(),
  descripcion: z.string().min(5, 'La descripción debe tener al menos 5 caracteres.').max(2000),
  responsableId: z.string().min(1, 'El responsable es obligatorio.'),
  prioridad: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
  ),
  plazoFecha: z.string().min(1, 'La fecha límite es obligatoria.'),
})

export type CreateQEACInput = z.infer<typeof createQEAccionSchema>
