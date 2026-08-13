import { z } from 'zod'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 5
const MAX_CAPTION_LENGTH = 140

/**
 * Subset de `createIncidentFormSchema` (incidentForm.schema.ts) para el
 * reporte rápido mobile (M7-F1): sin `localId`/`zonaId`/`fechaEvento` (se
 * asume "ahora" al enviar) ni campos de investigación de escritorio. Reusa
 * el mismo mensaje/regla de validación donde aplica para no divergir del
 * contrato de `POST /api/incidents`.
 */
export const mobileIncidentReportSchema = z
  .object({
    tipo: z.enum(['ACCIDENTE', 'INCIDENTE', 'CUASI_ACCIDENTE', 'CONDICION_INSEGURA'], {
      error: 'El tipo es obligatorio',
    }),
    descripcion: z
      .string()
      .min(20, 'Mínimo 20 caracteres')
      .max(2000, 'Máximo 2000 caracteres'),
    areaId: z.string().min(1, 'El área es obligatoria'),
    turno: z.enum(['DIA', 'TARDE', 'NOCHE'], { error: 'El turno es obligatorio' }),
    huboLesionados: z.boolean(),
    numPersonasAfectadas: z.number().int().min(1).optional(),
    severidad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
    evidencias: z
      .custom<File[]>()
      .optional()
      .superRefine((files, ctx) => {
        if (!files || files.length === 0) return
        if (files.length > MAX_FILES) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Máximo 5 fotos permitidas' })
          return
        }
        for (const file of files) {
          if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `El archivo '${file.name}' no es una imagen válida (JPEG, PNG, WEBP)`,
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
    // Caption opcional por foto, alineado por índice con `evidencias` — un
    // string vacío se normaliza a `undefined` al construir la evidencia
    // final, nunca se persiste como string vacío (design.md D2).
    evidenciaCaptions: z
      .array(z.string().max(MAX_CAPTION_LENGTH, `Máximo ${MAX_CAPTION_LENGTH} caracteres`).optional())
      .optional(),
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

export type MobileIncidentReportInput = z.infer<typeof mobileIncidentReportSchema>
