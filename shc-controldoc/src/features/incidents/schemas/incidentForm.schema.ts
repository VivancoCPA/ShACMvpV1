import { z } from 'zod'
import { CondicionEntornoValues } from '../types/incident.types'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 5

const now = () => new Date()
const MS_72H = 72 * 60 * 60 * 1000

export const createIncidentFormSchema = z
  .object({
    tipo: z.enum(['ACCIDENTE', 'INCIDENTE', 'CUASI_ACCIDENTE', 'CONDICION_INSEGURA'], {
      required_error: 'El tipo es obligatorio',
    }),
    descripcion: z
      .string()
      .min(20, 'Mínimo 20 caracteres')
      .max(2000, 'Máximo 2000 caracteres'),
    areaId: z.string().min(1, 'El área es obligatoria'),
    turno: z.enum(['DIA', 'TARDE', 'NOCHE'], { required_error: 'El turno es obligatorio' }),
    fechaEvento: z.string().min(1, 'La fecha del evento es obligatoria').superRefine((val, ctx) => {

      const fecha = new Date(val)
      if (isNaN(fecha.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha inválida' })
        return
      }
      const ahora = now()
      if (fecha > ahora) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fecha del evento no puede ser futura' })
        return
      }
      if (ahora.getTime() - fecha.getTime() > MS_72H) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fecha del evento no puede ser más de 72 horas en el pasado' })
      }
    }),
    huboLesionados: z.boolean(),
    numPersonasAfectadas: z.number().int().min(1).optional(),
    severidad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
    evidencias: z
      .custom<File[]>()
      .optional()
      .superRefine((files, ctx) => {
        if (!files || files.length === 0) return
        if (files.length > MAX_FILES) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Máximo 5 archivos permitidos' })
          return
        }
        for (const file of files) {
          if (!ACCEPTED_TYPES.includes(file.type)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `El archivo '${file.name}' no es un tipo permitido (JPEG, PNG, PDF)`,
            })
          }
          if (file.size > MAX_FILE_SIZE_BYTES) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `El archivo '${file.name}' supera el límite de 10 MB`,
            })
          }
        }
      }),
    localId: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    zonaId: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    ubicacion: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
  })
  .refine(
    (data) => {
      if (data.huboLesionados && (data.numPersonasAfectadas === undefined || data.numPersonasAfectadas < 1)) {
        return false
      }
      return true
    },
    { message: 'Indicar número de personas afectadas', path: ['numPersonasAfectadas'] },
  )

export type CreateIncidentFormInput = z.infer<typeof createIncidentFormSchema>

export const updateIncidentFormSchema = createIncidentFormSchema.extend({
  personalInvolucrado: z.string().max(1000).optional(),
  testigos: z.string().max(1000).optional(),
  equiposInvolucrados: z.string().max(1000).optional(),
  condicionesEntorno: z.array(z.enum([...CondicionEntornoValues])).optional(),
  atencionMedicaRequerida: z.boolean().optional(),
  atencionMedicaDescripcion: z.string().max(500).optional(),
  informeMedicoAdjunto: z.custom<File | null>().optional(),
})

export type UpdateIncidentFormInput = z.infer<typeof updateIncidentFormSchema>
