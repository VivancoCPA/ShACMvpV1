import { z } from 'zod'

export const qualityEventEditReporteInicialSchema = z
  .object({
    descripcion: z.string().min(10).max(2000).optional(),
    areaAfectada: z.string().min(1).optional(),
    turno: z.enum(['DIA', 'TARDE', 'NOCHE']).optional(),
    fechaHoraEvento: z
      .string()
      .refine((value) => new Date(value) <= new Date(), 'La fecha y hora del evento no puede ser futura')
      .optional(),
    mineralInvolucrado: z.string().optional(),
    incidenteId: z.string().min(1).optional(),
    ncId: z.string().min(1).optional(),
    hallazgoAuditoriaRef: z.string().min(1).optional(),
    reporteExternoRef: z
      .object({
        nombreCliente: z.string().min(1),
        fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .optional(),
  })
  .strict()

export type QualityEventEditReporteInicialInput = z.infer<typeof qualityEventEditReporteInicialSchema>
