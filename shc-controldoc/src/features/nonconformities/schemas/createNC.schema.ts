import { z } from 'zod'

export const createNCSchema = z.object({
  dominio: z.enum(['CALIDAD', 'SST', 'ADUANERO', 'OPERACIONAL']),
  origen: z.enum([
    'INSPECCION_INTERNA',
    'AUDITORIA_INTERNA',
    'AUDITORIA_EXTERNA',
    'CLIENTE_RECLAMO',
    'OPERACION_CAMPO',
    'CONTROL_PROCESO',
  ]),
  tipo: z.enum(['PROCESO', 'PRODUCTO', 'SERVICIO', 'SISTEMA', 'SST']),
  severidad: z.enum(['MENOR', 'MAYOR', 'CRITICA']),
  areaAfectada: z.string().min(1).max(200),
  descripcion: z.string().min(10).max(2000),
  fechaDeteccion: z.string().datetime({ offset: true }),
  turno: z.enum(['DIA', 'TARDE', 'NOCHE']).optional(),
  mineralInvolucrado: z.string().max(100).optional(),
  accionInmediata: z.string().max(1000).optional(),
  documentosVinculados: z.array(z.string()).optional().default([]),
})

export type CreateNCInput = z.infer<typeof createNCSchema>
