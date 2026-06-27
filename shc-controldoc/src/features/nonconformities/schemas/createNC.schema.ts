import { z } from 'zod'

export const createNCSchema = z
  .object({
    dominio: z.enum(['CALIDAD', 'SST', 'ADUANERO', 'OPERACIONAL', 'PROVEEDOR']),
    origen: z.enum([
      'INSPECCION_INTERNA',
      'AUDITORIA_INTERNA',
      'AUDITORIA_EXTERNA',
      'CLIENTE_RECLAMO',
      'OPERACION_CAMPO',
      'CONTROL_PROCESO',
    ]),
    tipo: z.enum(['PROCESO', 'PRODUCTO', 'SERVICIO', 'SISTEMA', 'SST']),
    severidad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']),
    titulo: z.string().min(1, 'El título es obligatorio.').max(300),
    areaAfectada: z.string().min(1).max(200),
    procesoInvolucrado: z.string().min(1).max(300).optional(),
    descripcion: z.string().min(10).max(2000),
    fechaDeteccion: z.string().min(1),
    fechaCierre: z.string().min(1),
    detectadoPorId: z.string().optional(),
    requiereIPER: z.boolean().default(false),
    turno: z.enum(['TODOS', 'DIA', 'TARDE', 'NOCHE']).optional(),
    mineralInvolucrado: z.string().max(100).optional(),
    accionInmediata: z.string().max(1000).optional(),
    documentosVinculados: z.array(z.string()).optional().default([]),
    forzar: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fechaCierre && data.fechaDeteccion) {
      const cierre = new Date(data.fechaCierre)
      const deteccion = new Date(data.fechaDeteccion)
      if (!isNaN(cierre.getTime()) && !isNaN(deteccion.getTime()) && cierre <= deteccion) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La fecha de cierre debe ser posterior a la fecha de detección.',
          path: ['fechaCierre'],
        })
      }
    }
  })

export type CreateNCInput = z.infer<typeof createNCSchema>
