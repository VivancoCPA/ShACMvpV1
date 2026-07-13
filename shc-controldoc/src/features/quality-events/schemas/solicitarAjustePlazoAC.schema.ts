import { z } from 'zod'

export const solicitarAjustePlazoACSchema = z.object({
  fechaSolicitada: z.string().min(1, 'La fecha solicitada es obligatoria.'),
  justificacion: z.string().min(50, 'La justificación debe tener al menos 50 caracteres.').max(2000),
})

export type SolicitarAjustePlazoACInput = z.infer<typeof solicitarAjustePlazoACSchema>
