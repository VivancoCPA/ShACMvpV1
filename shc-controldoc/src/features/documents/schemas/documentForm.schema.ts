import { z } from 'zod'
import { differenceInCalendarDays } from 'date-fns'
import { DOC_REVISION_MIN_GAP_DAYS } from '../../../config/businessRules.config'
import { DOCUMENT_AUTHORIZED_ROLES, TIPOS_CON_ORIGINAL_PDF } from '../constants'

const RN_DOC_020_MESSAGE = `La próxima revisión debe ser al menos ${DOC_REVISION_MIN_GAP_DAYS} días después de la fecha de vigencia.`
const RN_DOC_021_MESSAGE = 'Para este tipo de documento, el archivo original debe ser Word (.docx) o Excel (.xlsx).'

const userRoleEnum = z.enum(DOCUMENT_AUTHORIZED_ROLES)

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

    // RN-DOC-021: archivoOriginalFile solo puede ser un PDF cuando tipo está en
    // TIPOS_CON_ORIGINAL_PDF (INF/MAT/PLAN). Se revalida con cualquier combinación de valores
    // del formulario — cambiar tipo después de elegir el archivo (o al revés) se detecta igual.
    if (
      data.archivoOriginalFile &&
      data.archivoOriginalFile.type === 'application/pdf' &&
      !TIPOS_CON_ORIGINAL_PDF.includes(data.tipo)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['archivoOriginalFile'],
        message: RN_DOC_021_MESSAGE,
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
