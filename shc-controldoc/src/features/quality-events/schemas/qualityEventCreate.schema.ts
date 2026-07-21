import { z } from 'zod'

export const cincoPorquesSchema = z.array(
  z.object({
    pregunta: z.string().min(1),
    respuesta: z.string().min(1),
  }),
).length(5)

export type CincoPorquesInput = z.infer<typeof cincoPorquesSchema>

export const ishikawaSchema = z.array(
  z.object({
    categoria: z.enum(['METODO', 'MAQUINA', 'MATERIAL', 'MANO_DE_OBRA', 'MEDICION', 'MEDIO_AMBIENTE']),
    causa: z.string().min(5),
  }),
).min(1)

export type IshikawaInput = z.infer<typeof ishikawaSchema>

const baseFields = {
  tipo: z.enum(['CALIDAD', 'SST', 'ADUANERO', 'OPERACIONAL']),
  severidad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']),
  descripcion: z.string().min(10).max(2000),
  areaId: z.string().min(1),
  turno: z.enum(['DIA', 'TARDE', 'NOCHE']),
  fechaHoraEvento: z
    .string()
    .min(1, 'La fecha y hora del evento es requerida')
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Fecha/hora inválida (dd/mm/yyyy hh:mm)'),
  mineralInvolucrado: z.string().optional(),
}

export const qualityEventCreateSchema = z
  .discriminatedUnion('origen', [
    z.object({
      origen: z.literal('O1_INCIDENTE_CAMPO'),
      ...baseFields,
      incidenteId: z.string().min(1, 'Se requiere el incidente vinculado'),
    }),
    z.object({
      origen: z.literal('O2_NC_DETECTADA'),
      ...baseFields,
      ncId: z.string().min(1, 'Se requiere la no conformidad vinculada'),
    }),
    z.object({
      origen: z.literal('O3_HALLAZGO_AUDITORIA'),
      ...baseFields,
      hallazgoCodigo: z.string().min(1, 'Se requiere el código del hallazgo'),
      // Requerido para O3 (RN-QE-010); presencia validada en el superRefine de abajo
      // para poder emitir un mensaje descriptivo en vez del genérico de Zod cuando está ausente.
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
    }),
    z.object({
      origen: z.literal('O4_REPORTE_EXTERNO'),
      ...baseFields,
      reporteExternoRef: z.object({
        nombreCliente: z.string().min(1),
        fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    }),
  ])
  .superRefine((data, ctx) => {
    if (data.origen === 'O3_HALLAZGO_AUDITORIA' && !data.normativaVinculada) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Se requiere la normativa vinculada (norma y cláusula incumplida) para hallazgos de auditoría',
        path: ['normativaVinculada'],
      })
    }
  })

export type QualityEventCreateInput = z.infer<typeof qualityEventCreateSchema>
