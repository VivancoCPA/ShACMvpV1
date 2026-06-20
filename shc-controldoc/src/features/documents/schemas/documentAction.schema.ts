import { z } from 'zod'

export const signatureSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export type SignatureInput = z.infer<typeof signatureSchema>

export const rejectSchema = z.object({
  motivo: z
    .string()
    .min(20, 'El motivo debe tener al menos 20 caracteres')
    .max(500, 'El motivo no puede superar los 500 caracteres'),
  notificarAutor: z.boolean(),
})

export type RejectInput = z.infer<typeof rejectSchema>
