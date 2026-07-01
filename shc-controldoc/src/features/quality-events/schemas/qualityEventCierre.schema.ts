import { z } from 'zod'

export const qualityEventCierreSchema = z.object({
  resultadoCierre: z.string().min(100, 'Mínimo 100 caracteres').max(500),
  cerradoPorId: z.string().min(1),
  cierreFirmaSupervisorId: z.string().min(1),
  plazoVerificacionDias: z.number().int().min(1).default(60),
})

export type QualityEventCierreInput = z.infer<typeof qualityEventCierreSchema>
