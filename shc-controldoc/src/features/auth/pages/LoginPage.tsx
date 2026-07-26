import { useState } from 'react'
import { Link, Navigate, useLocation, type Location } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { loginSchema } from '../schemas/login.schema'
import type { LoginInput } from '../schemas/login.schema'
import { useLogin } from '../hooks/useLogin'
import { isLoginResolved } from '../api/auth.api'
import { authFixtures } from '../../../mocks/fixtures/auth.fixtures'
import { useAuthStore } from '../../../stores/authStore'
import { getDefaultRouteForRole } from '../../../router/getDefaultRoute'
import { isRouteAllowedForRole } from '../../../router/routeAccess'
import { readActiveEmpresaId } from '../../../lib/mockSession'

export function LoginPage() {
  const { t } = useTranslation('auth')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | undefined>(undefined)
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from
  const loginMutation = useLogin(from)
  const { mutate: login, isPending, data: loginData, reset: resetLogin } = loginMutation
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  // A session already in memory (e.g. an untouched admin session still open
  // in this tab) must never survive a subsequent login submission on this
  // page — redirect away instead of letting the form attach a stale token
  // to the next login request. This also fires (in addition to useLogin's
  // own navigate) right after a successful login flips isAuthenticated, so
  // it must agree with useLogin's target or it wins the race and clobbers
  // the deep-link redirect with the role default. Same RBAC check as
  // useLogin: a `from` the current role has no access to is ignored in
  // favor of the role default, never /no-autorizado.
  if (isAuthenticated) {
    const rol = user?.rol ?? 'OPERARIO'
    const target =
      from && isRouteAllowedForRole(from.pathname, rol)
        ? `${from.pathname}${from.search}`
        : getDefaultRouteForRole(rol)
    return <Navigate to={target} replace />
  }

  // `requiresEmpresaSelection`: el usuario tiene más de una empresa asignada
  // (empresa-session capability) — nunca se autoselecciona en silencio entre
  // varias, aunque haya una empresa usada la última sesión (solo se sugiere).
  const empresaSelection = loginData && !isLoginResolved(loginData) ? loginData : null
  const lastUsedEmpresaId = empresaSelection ? readActiveEmpresaId() : null
  const suggestedEmpresaId = empresaSelection
    ? (empresaSelection.empresasDisponibles.find((e) => e.id === lastUsedEmpresaId)?.id ??
        empresaSelection.empresasDisponibles[0]?.id)
    : undefined
  const activeEmpresaId = selectedEmpresaId ?? suggestedEmpresaId

  const onSubmit = (data: LoginInput) => {
    login(data)
  }

  const onConfirmEmpresa = () => {
    if (!activeEmpresaId) return
    const { email, password } = getValues()
    login({ email, password, empresaId: activeEmpresaId })
  }

  const onBackToCredentials = () => {
    setSelectedEmpresaId(undefined)
    resetLogin()
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
    <div className="flex min-h-screen bg-canvas dark:bg-surface-dark">
      {/* Panel izquierdo: arte institucional genérico de SHAC — nunca
          específico de una empresa, porque esta aún no se conoce antes de
          resolver la sesión (ver empresa-session capability). */}
      <div className="hidden flex-1 flex-col items-center justify-center bg-surface-dark px-8 text-on-dark lg:flex dark:bg-surface-dark-elevated">
        <h1 className="font-display text-5xl font-normal text-coral">{t('login.artTitle')}</h1>
        <p className="mt-4 max-w-sm text-center text-on-dark-soft">{t('login.artTagline')}</p>
      </div>

      {/* Panel derecho: formulario de autenticación (y, cuando aplica, el
          paso de selección de empresa). */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-xl bg-surface-card p-8 dark:bg-surface-dark-elevated">
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl font-normal text-coral lg:hidden">
              {t('login.artTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">{t('login.subtitle')}</p>
          </div>

          {empresaSelection ? (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-medium text-body-strong dark:text-on-dark">
                  {t('empresaSelection.title')}
                </h2>
                <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
                  {t('empresaSelection.subtitle')}
                </p>
              </div>

              <div className="space-y-2" role="radiogroup" aria-label={t('empresaSelection.title')}>
                {empresaSelection.empresasDisponibles.map((empresa) => (
                  <button
                    key={empresa.id}
                    type="button"
                    role="radio"
                    aria-checked={activeEmpresaId === empresa.id}
                    onClick={() => setSelectedEmpresaId(empresa.id)}
                    className={`w-full rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors ${
                      activeEmpresaId === empresa.id
                        ? 'border-coral bg-coral/10 text-coral'
                        : 'border-hairline text-ink hover:bg-hairline dark:border-hairline/20 dark:text-on-dark dark:hover:bg-surface-dark-soft'
                    }`}
                  >
                    {empresa.razonSocial}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onConfirmEmpresa}
                disabled={isPending || !activeEmpresaId}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-coral px-5 text-sm font-medium text-white transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending && <Loader2 size={15} className="animate-spin" />}
                {t('empresaSelection.confirm')}
              </button>

              <button
                type="button"
                onClick={onBackToCredentials}
                className="w-full text-center text-xs text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
              >
                {t('empresaSelection.back')}
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
