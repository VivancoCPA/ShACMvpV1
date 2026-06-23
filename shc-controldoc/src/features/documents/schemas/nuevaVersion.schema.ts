import { z } from 'zod'

export const nuevaVersionSchema = z.object({
  tipoCambio: z.enum(['MENOR', 'MAYOR'], {
    required_error: 'Selecciona el tipo de cambio.',
  }),
  motivo: z.string().min(20, { message: 'El motivo debe tener al menos 20 caracteres.' }),
})

export type NuevaVersionInput = z.infer<typeof nuevaVersionSchema>
