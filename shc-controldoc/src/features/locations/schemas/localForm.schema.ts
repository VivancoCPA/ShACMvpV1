import { z } from 'zod'

const MAX_PLANO_BYTES = 2 * 1024 * 1024

export const localFormSchema = z.object({
  nombre: z.string().min(3),
  direccion: z.string().min(1),
  planoUrl: z
    .instanceof(File)
    .refine((file) => file.type === 'image/png', { message: 'Solo se acepta formato PNG' })
    .refine((file) => file.size <= MAX_PLANO_BYTES, { message: 'El archivo no debe superar 2 MB' })
    .optional(),
  planoAncho: z.number().int().positive().optional(),
  planoAlto: z.number().int().positive().optional(),
})

export type LocalFormInput = z.infer<typeof localFormSchema>
