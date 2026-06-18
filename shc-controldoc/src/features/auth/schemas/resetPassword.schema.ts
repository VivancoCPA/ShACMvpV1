import { z } from 'zod'

export const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: /[A-Z]/,
  requireLowercase: /[a-z]/,
  requireDigit: /[0-9]/,
  requireSpecial: /[^A-Za-z0-9]/,
}

export function getPasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  let score = 0
  if (password.length >= PASSWORD_RULES.minLength) score++
  if (PASSWORD_RULES.requireUppercase.test(password)) score++
  if (PASSWORD_RULES.requireLowercase.test(password)) score++
  if (PASSWORD_RULES.requireDigit.test(password)) score++
  if (PASSWORD_RULES.requireSpecial.test(password)) score++
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
}

const passwordField = z
  .string()
  .min(PASSWORD_RULES.minLength, 'auth:validation.passwordMinLength')
  .regex(PASSWORD_RULES.requireUppercase, 'auth:validation.passwordUppercase')
  .regex(PASSWORD_RULES.requireLowercase, 'auth:validation.passwordLowercase')
  .regex(PASSWORD_RULES.requireDigit, 'auth:validation.passwordDigit')
  .regex(PASSWORD_RULES.requireSpecial, 'auth:validation.passwordSpecial')

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, 'auth:validation.passwordRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth:validation.passwordMismatch',
    path: ['confirmPassword'],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
