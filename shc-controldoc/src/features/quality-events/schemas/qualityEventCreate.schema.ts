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
  areaAfectada: z.string().min(1),
  turno: z.enum(['DIA', 'TARDE', 'NOCHE']),
  fechaHoraEvento: z.string().datetime({ message: 'Fecha/hora inválida' }),
  mineralInvolucrado: z.string().optional(),
}

export const qualityEventCreateSchema = z.discriminatedUnion('origen', [
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
    hallazgoAuditoriaRef: z.string().min(1, 'Se requiere referencia al hallazgo de auditoría'),
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

export type QualityEventCreateInput = z.infer<typeof qualityEventCreateSchema>
