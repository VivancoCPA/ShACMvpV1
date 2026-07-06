import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { loginSchema } from '../schemas/login.schema'
import type { LoginInput } from '../schemas/login.schema'
import { useLogin } from '../hooks/useLogin'
import { authFixtures } from '../../../mocks/fixtures/auth.fixtures'
import { useAuthStore } from '../../../stores/authStore'
import { getDefaultRouteForRole } from '../../../router/getDefaultRoute'

export function LoginPage() {
  const { t } = useTranslation('auth')
  const [showPassword, setShowPassword] = useState(false)
  const { mutate: login, isPending } = useLogin()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  // A session already in memory (e.g. an untouched admin session still open
  // in this tab) must never survive a subsequent login submission on this
  // page — redirect away instead of letting the form attach a stale token
  // to the next login request.
  if (isAuthenticated) {
    return <Navigate to={getDefaultRouteForRole(user?.rol ?? 'OPERARIO')} replace />
  }

  const onSubmit = (data: LoginInput) => {
    login(data)
  }

  const handleRoleSelect = (userId: string) => {
    if (!userId) return
    const fixture = authFixtures.find((u) => u.id === userId)
    if (fixture) {
      setValue('email', fixture.email)
      setValue('password', fixture.password)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 dark:bg-surface-dark">
      <div className="w-full max-w-sm rounded-xl bg-surface-card p-8 dark:bg-surface-dark-elevated">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-normal text-coral">SHAC</h1>
          <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">{t('login.subtitle')}</p>
        </div>

        {import.meta.env.VITE_ENABLE_MSW === 'true' && (
          <div className="mb-6">
            <label className="mb-1 block text-xs font-medium text-muted dark:text-on-dark-soft">
              {t('devMode.roleSelector')}
            </label>
            <select
              className="h-9 w-full rounded-md border border-hairline bg-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
              defaultValue=""
              onChange={(e) => handleRoleSelect(e.target.value)}
            >
              <option value="">—</option>
              {authFixtures.map((u) => (
                <option key={u.id} value={u.id}>
                  {t(`roles.${u.rol}`)} — {u.email}
                </option>
              ))}
            </select>
            <div className="mt-3 border-t border-hairline pt-3 dark:border-hairline/20">
              <p className="text-xs text-muted dark:text-on-dark-soft">
                {t('devPanel.pinHint')}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
            >
              {t('login.email')}
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

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
            >
              {t('login.password')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
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
            {errors.password && (
              <p className="mt-1 text-xs text-error">{t(errors.password.message ?? '')}</p>
            )}
          </div>

          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-xs text-coral hover:underline"
            >
              {t('login.forgotPassword')}
            </Link>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-coral px-5 text-sm font-medium text-white transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
