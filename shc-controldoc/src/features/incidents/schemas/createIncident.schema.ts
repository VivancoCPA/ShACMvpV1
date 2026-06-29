import { z } from 'zod'
import { CondicionEntornoValues } from '../types/incident.types'

export const createIncidentSchema = z
  .object({
    tipo: z.enum(['ACCIDENTE', 'INCIDENTE', 'CUASI_ACCIDENTE', 'CONDICION_INSEGURA']),
    descripcion: z.string().min(20, 'Mínimo 20 caracteres').max(2000),
    areaId: z.string().min(1, 'Área requerida'),
    turno: z.enum(['DIA', 'TARDE', 'NOCHE', 'TODOS']),
    fechaEvento: z.string().datetime({ message: 'Fecha inválida' }),
    huboLesionados: z.boolean(),
    numPersonasAfectadas: z.number().int().min(1).optional(),
    severidad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
  })
  .refine(
    (data) => {
      if (data.huboLesionados && (data.numPersonasAfectadas === undefined || data.numPersonasAfectadas < 1)) {
        return false
      }
      return true
    },
    {
      message: 'Indicar número de personas afectadas',
      path: ['numPersonasAfectadas'],
    },
  )

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>

export const updateIncidentInvestigacionSchema = z.object({
  personalInvolucrado: z.array(z.string()).optional(),
  testigos: z.array(z.string()).optional(),
  equiposInvolucrados: z.array(z.string()).optional(),
  condicionesEntorno: z.array(z.enum([...CondicionEntornoValues])).optional(),
  atencionMedicaRequerida: z.boolean().optional(),
  atencionMedicaDescripcion: z.string().max(500).optional(),
  notificacionAmbientalRequerida: z.boolean().optional(),
})

export type UpdateIncidentInvestigacionInput = z.infer<typeof updateIncidentInvestigacionSchema>
