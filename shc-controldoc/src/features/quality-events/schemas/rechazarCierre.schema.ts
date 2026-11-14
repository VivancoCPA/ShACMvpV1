import { z } from 'zod'

// Mensajes como claves i18n (qualityEvents:) — QECierreSection las traduce con t().
export const rechazarCierreSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(20, 'detail.cierre.motivoRechazoMin')
    .max(500, 'detail.cierre.motivoRechazoMax'),
})

export type RechazarCierreInput = z.infer<typeof rechazarCierreSchema>
