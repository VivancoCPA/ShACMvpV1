import { z } from 'zod'

export const createACSchema = z.object({
  titulo: z.string().min(3, 'El título debe tener al menos 3 caracteres.').max(200),
  descripcion: z.string().min(5, 'La descripción debe tener al menos 5 caracteres.').max(2000),
  responsableId: z.string().min(1, 'El responsable es obligatorio.'),
  plazoFecha: z.string().min(1, 'La fecha límite es obligatoria.'),
  prioridad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']),
})

export type CreateACInput = z.infer<typeof createACSchema>
