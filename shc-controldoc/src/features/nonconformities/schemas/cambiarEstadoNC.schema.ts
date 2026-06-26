import { z } from 'zod'

export const cambiarEstadoNCSchema = z
  .object({
    nuevoEstado: z.enum([
      'ABIERTA',
      'EN_INVESTIGACION',
      'ANALISIS_COMPLETADO',
      'EN_EJECUCION',
      'PENDIENTE_CIERRE',
      'CERRADA',
      'ANULADA',
    ]),
    comentario: z.string().min(1).max(500),
    correccionEvidenciaUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.nuevoEstado === 'PENDIENTE_CIERRE' && !data.correccionEvidenciaUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correccionEvidenciaUrl'],
        message: 'La URL de evidencia de corrección es requerida para solicitar el cierre.',
      })
    }
  })

export type CambiarEstadoNCInput = z.infer<typeof cambiarEstadoNCSchema>
