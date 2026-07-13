import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { UserAvatar } from '../../../components/ui/UserAvatar'
import { ROLE_BG_CLASSES } from '../../../components/ui/roleColors'
import { useAuthStore } from '../../../stores/authStore'
import { formatShortDate, formatDateTime } from '../../../utils/date.utils'
import { useChangePassword } from '../../auth/hooks/useChangePassword'
import { changePasswordSchema } from '../../auth/schemas/changePassword.schema'
import type { ChangePasswordInput } from '../../auth/schemas/changePassword.schema'

export function ProfilePage() {
  const { t, i18n } = useTranslation('users')
  const { t: tAuth } = useTranslation('auth')
  const locale = i18n.language
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { mutate: doChangePassword, isPending } = useChangePassword()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) })

  if (!user) return null

  const onSubmit = (data: ChangePasswordInput) => {
    doChangePassword(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      { onSuccess: () => reset() },
    )
  }

  return (
    <PageWrapper title={t('profile.title')}>
      <div className="mx-auto max-w-2xl space-y-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('profile.back')}
        </button>

        <section className="rounded-lg bg-surface-card p-6 dark:bg-surface-dark-elevated">
          <h2 className="mb-4 text-sm font-medium text-body-strong dark:text-on-dark">
            {t('profile.readOnlySection.title')}
          </h2>
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="lg" />
            <div>
              <p className="text-base font-medium text-ink dark:text-on-dark">
                {user.nombre} {user.apellido}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BG_CLASSES[user.rol]}`}
              >
                {tAuth(`roles.${user.rol}`)}
              </span>
            </div>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between border-t border-hairline pt-3 dark:border-hairline/20">
              <dt className="text-muted dark:text-on-dark-soft">{t('profile.readOnlySection.email')}</dt>
              <dd className="text-ink dark:text-on-dark">{user.email}</dd>
            </div>
            {user.area && (
              <div className="flex justify-between border-t border-hairline pt-3 dark:border-hairline/20">
                <dt className="text-muted dark:text-on-dark-soft">{t('profile.readOnlySection.area')}</dt>
                <dd className="text-ink dark:text-on-dark">{user.area}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-hairline pt-3 dark:border-hairline/20">
              <dt className="text-muted dark:text-on-dark-soft">{t('profile.readOnlySection.createdAt')}</dt>
              <dd className="text-ink dark:text-on-dark">{formatShortDate(user.createdAt, locale)}</dd>
            </div>
            {user.lastLogin && (
              <div className="flex justify-between border-t border-hairline pt-3 dark:border-hairline/20">
                <dt className="text-muted dark:text-on-dark-soft">{t('profile.readOnlySection.lastLogin')}</dt>
                <dd className="text-ink dark:text-on-dark">{formatDateTime(user.lastLogin, locale)}</dd>
              </div>
            )}
            {user.rol === 'SUPERVISOR' && user.areasAsignadas && user.areasAsignadas.length > 0 && (
              <div className="flex justify-between border-t border-hairline pt-3 dark:border-hairline/20">
                <dt className="text-muted dark:text-on-dark-soft">
                  {t('profile.readOnlySection.areasAsignadas')}
                </dt>
                <dd className="flex flex-wrap justify-end gap-1.5">
                  {user.areasAsignadas.map((area) => (
                    <span
                      key={area}
                      className="rounded-full bg-hairline px-2 py-0.5 text-xs text-body dark:bg-surface-dark-soft dark:text-on-dark-soft"
                    >
                      {area}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-lg bg-surface-card p-6 dark:bg-surface-dark-elevated">
          <h2 className="mb-4 text-sm font-medium text-body-strong dark:text-on-dark">
            {t('changePassword.title')}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="currentPassword"
                className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
              >
                {t('changePassword.currentPassword')}
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('currentPassword')}
                  className="h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? tAuth('login.hidePassword') : tAuth('login.showPassword')}
                  className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-ink dark:hover:text-on-dark"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="mt-1 text-xs text-error">{tAuth(errors.currentPassword.message ?? '')}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
              >
                {t('changePassword.newPassword')}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('newPassword')}
                  className="h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? tAuth('login.hidePassword') : tAuth('login.showPassword')}
                  className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-ink dark:hover:text-on-dark"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-xs text-error">{tAuth(errors.newPassword.message ?? '')}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
              >
                {t('changePassword.confirmPassword')}
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
                  aria-label={showConfirm ? tAuth('login.hidePassword') : tAuth('login.showPassword')}
                  className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-ink dark:hover:text-on-dark"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-error">{tAuth(errors.confirmPassword.message ?? '')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-coral px-5 text-sm font-medium text-white transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending && <Loader2 size={15} className="animate-spin" />}
              {t('changePassword.submit')}
            </button>
          </form>
        </section>
      </div>
    </PageWrapper>
  )
}
