import { z } from 'zod'
import { passwordField } from './resetPassword.schema'

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'auth:validation.passwordRequired'),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, 'auth:validation.passwordRequired'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'auth:validation.passwordMismatch',
    path: ['confirmPassword'],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
