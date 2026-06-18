import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { forgotPasswordSchema } from '../schemas/forgotPassword.schema'
import type { ForgotPasswordInput } from '../schemas/forgotPassword.schema'
import { useForgotPassword } from '../hooks/useForgotPassword'

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const { mutate: sendReset, isPending, isSuccess } = useForgotPassword()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = (data: ForgotPasswordInput) => {
    sendReset(data)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 dark:bg-surface-dark">
      <div className="w-full max-w-sm rounded-xl bg-surface-card p-8 dark:bg-surface-dark-elevated">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-normal text-coral">SHAC</h1>
          <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">{t('forgotPassword.title')}</p>
        </div>

        {isSuccess ? (
          <div className="text-center">
            <p className="text-sm text-body dark:text-on-dark-soft">
              {t('forgotPassword.successMessage')}
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block text-sm text-coral hover:underline"
            >
              {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted dark:text-on-dark-soft">
              {t('forgotPassword.description')}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
                >
                  {t('forgotPassword.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-error">{t(errors.email.message ?? '')}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-coral px-5 text-sm font-medium text-white transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending && <Loader2 size={15} className="animate-spin" />}
                {t('forgotPassword.submit')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-coral hover:underline">
                {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
