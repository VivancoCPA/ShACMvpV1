import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { resetPasswordSchema, getPasswordStrength, PASSWORD_RULES } from '../schemas/resetPassword.schema'
import type { ResetPasswordInput } from '../schemas/resetPassword.schema'
import { useResetPassword } from '../hooks/useResetPassword'

const STRENGTH_COLORS = ['bg-error', 'bg-error', 'bg-warning', 'bg-teal', 'bg-success'] as const
const STRENGTH_LABELS = [
  'resetPassword.strength.weak',
  'resetPassword.strength.weak',
  'resetPassword.strength.fair',
  'resetPassword.strength.good',
  'resetPassword.strength.strong',
] as const

export function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { mutate: doReset, isPending } = useResetPassword()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) })

  const passwordValue = watch('password') ?? ''
  const strength = getPasswordStrength(passwordValue)

  if (!token) {
    toast.error(t('errors.invalidLink'))
    return <Navigate to="/login" replace />
  }

  const countRules = (pw: string) => {
    let n = 0
    if (pw.length >= PASSWORD_RULES.minLength) n++
    if (PASSWORD_RULES.requireUppercase.test(pw)) n++
    if (PASSWORD_RULES.requireLowercase.test(pw)) n++
    if (PASSWORD_RULES.requireDigit.test(pw)) n++
    if (PASSWORD_RULES.requireSpecial.test(pw)) n++
    return n
  }

  const rulesCount = countRules(passwordValue)

  const onSubmit = (data: ResetPasswordInput) => {
    doReset({ token, password: data.password })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 dark:bg-surface-dark">
      <div className="w-full max-w-sm rounded-xl bg-surface-card p-8 dark:bg-surface-dark-elevated">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-normal text-coral">SHAC</h1>
          <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
            {t('resetPassword.title')}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
            >
              {t('resetPassword.newPassword')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                className="h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-ink dark:hover:text-on-dark"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength bar */}
            {passwordValue.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((seg) => (
                    <div
                      key={seg}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        rulesCount >= seg
                          ? STRENGTH_COLORS[Math.min(rulesCount, 4)]
                          : 'bg-hairline dark:bg-hairline/30'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
                  {t(STRENGTH_LABELS[Math.min(strength, 4)])}
                </p>
              </div>
            )}

            {errors.password && (
              <p className="mt-1 text-xs text-error">{t(errors.password.message ?? '')}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
            >
              {t('resetPassword.confirmPassword')}
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('confirmPassword')}
                className="h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? t('login.hidePassword') : t('login.showPassword')}
                className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-ink dark:hover:text-on-dark"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-error">
                {t(errors.confirmPassword.message ?? '')}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-coral px-5 text-sm font-medium text-white transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {t('resetPassword.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
