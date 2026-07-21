import { z } from 'zod'

export const qualityEventEditReporteInicialSchema = z
  .object({
    descripcion: z.string().min(10).max(2000).optional(),
    areaId: z.string().min(1).optional(),
    turno: z.enum(['DIA', 'TARDE', 'NOCHE']).optional(),
    fechaHoraEvento: z
      .string()
      .refine((value) => new Date(value) <= new Date(), 'La fecha y hora del evento no puede ser futura')
      .optional(),
    mineralInvolucrado: z.string().optional(),
    incidenteId: z.string().min(1).optional(),
    ncId: z.string().min(1).optional(),
    hallazgoCodigo: z.string().min(1).optional(),
    normativaVinculada: z
      .object({
        norma: z.enum(['ISO_9001_2015', 'ISO_45001_2018', 'OTRA']),
        clausula: z.string().min(1, 'Se requiere la cláusula incumplida'),
        normaOtraDetalle: z.string().min(1).optional(),
      })
      .refine((v) => v.norma !== 'OTRA' || !!v.normaOtraDetalle, {
        message: 'Se requiere el detalle de la normativa cuando norma es OTRA',
        path: ['normaOtraDetalle'],
      })
      .optional(),
    reporteExternoRef: z
      .object({
        nombreCliente: z.string().min(1),
        fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .optional(),
  })
  .strict()

export type QualityEventEditReporteInicialInput = z.infer<typeof qualityEventEditReporteInicialSchema>
