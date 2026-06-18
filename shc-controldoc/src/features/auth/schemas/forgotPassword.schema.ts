import { z } from 'zod'

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'auth:validation.emailRequired')
    .email('auth:validation.emailInvalid'),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
