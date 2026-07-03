import { z } from 'zod'

export const qualityEventCierreFormSchema = z.object({
  resultadoCierre: z.string().min(100, 'Mínimo 100 caracteres').max(500),
  plazoVerificacionDias: z.number().int().min(1).default(60),
})

export type QualityEventCierreFormInput = z.infer<typeof qualityEventCierreFormSchema>
