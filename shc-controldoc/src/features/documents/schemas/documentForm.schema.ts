import { z } from 'zod'
import { differenceInCalendarDays } from 'date-fns'
import { DOC_REVISION_MIN_GAP_DAYS } from '../../../config/businessRules.config'

const RN_DOC_020_MESSAGE = `La próxima revisión debe ser al menos ${DOC_REVISION_MIN_GAP_DAYS} días después de la fecha de vigencia.`

const userRoleEnum = z.enum([
  'OPERARIO',
  'SUPERVISOR',
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
])

export const documentFormSchema = z
  .object({
    titulo: z.string().min(5).max(200),
    tipo: z.enum(['POL', 'PRC', 'INS', 'REG', 'INF', 'MAT', 'PLAN']),
    areaId: z.string().min(2).max(100),
    version: z.string().regex(/^v\d+\.\d+$/, { message: 'Formato requerido: v1.0, v2.3, etc.' }),
    confidencialidad: z.enum(['PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'RESTRINGIDO']),
    rolesAutorizados: z.array(userRoleEnum).optional(),
    revisorId: z.string().optional().or(z.literal('')),
    aprobadorId: z.string().optional().or(z.literal('')),
    fechaVigencia: z.string().optional(),
    fechaRevisionProxima: z.string().optional(),
    descripcion: z.string().max(1000).optional(),
    archivo: z.instanceof(File).nullable().optional(),
    archivoOriginalFile: z.instanceof(File).nullable().optional(),
    archivoOriginalUrl: z.string().nullable().optional(),
    archivoDistribucionUrl: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.confidencialidad === 'RESTRINGIDO' &&
      (!data.rolesAutorizados || data.rolesAutorizados.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 1,
        origin: 'array',
        inclusive: true,
        path: ['rolesAutorizados'],
        message: 'Debes seleccionar al menos un rol autorizado para documentos RESTRINGIDO.',
      })
    }

    if (data.revisorId && data.aprobadorId && data.revisorId === data.aprobadorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aprobadorId'],
        message: 'El Revisor y el Aprobador no pueden ser la misma persona.',
      })
    }

    // RN-DOC-020: fechaRevisionProxima debe ser >= fechaVigencia + 30 días.
    // Solo se activa una vez que fechaVigencia está definida; para tipo === 'INF'
    // fechaRevisionProxima sigue siendo opcional si se deja vacía.
    if (data.fechaVigencia) {
      if (!data.fechaRevisionProxima) {
        if (data.tipo !== 'INF') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fechaRevisionProxima'],
            message: RN_DOC_020_MESSAGE,
          })
        }
      } else if (
        differenceInCalendarDays(
          new Date(data.fechaRevisionProxima),
          new Date(data.fechaVigencia),
        ) < DOC_REVISION_MIN_GAP_DAYS
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fechaRevisionProxima'],
          message: RN_DOC_020_MESSAGE,
        })
      }
    }
  })

export type DocumentFormInput = z.infer<typeof documentFormSchema>
