import { z } from 'zod'

export const updateNCSchema = z.object({
  responsableInvestigacionId: z.string().uuid().optional(),
  accionInmediata: z.string().max(1000).optional(),
  accionInmediataFecha: z.string().optional(),
  correccion: z.string().max(2000).optional(),
  correccionEvidenciaUrl: z.string().url().optional(),
  causaRaiz: z.string().max(2000).optional(),
  documentosVinculados: z.array(z.string()).optional(),
})

export type UpdateNCInput = z.infer<typeof updateNCSchema>
