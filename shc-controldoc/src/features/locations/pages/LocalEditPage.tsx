import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../../stores/authStore'
import { useLocal } from '../hooks/useLocales'
import { puedeAdministrarLocales } from '../permissions/localesPermissions'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { LocalForm } from '../components/LocalForm'

function SkeletonBlock() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

export function LocalEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('locations')
  const user = useAuthStore((s) => s.user)

  const { data: local, isLoading, isError } = useLocal(id ?? '')

  const permissions = user ? puedeAdministrarLocales(user) : null

  useEffect(() => {
    if (permissions === false) {
      navigate('/admin/locales', { replace: true })
    }
  }, [permissions, navigate])

  if (!permissions) return null

  if (isLoading) return <SkeletonBlock />

  if (isError || !local) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-error/30 bg-error/5 px-6 py-8 text-center">
          <p className="text-sm text-error">{t('form.errors.localNoEncontrado')}</p>
        </div>
      </div>
    )
  }

  return (
    <PageWrapper title={`${t('form.titles.editarLocal')} — ${local.nombre}`}>
      <div className="mx-auto max-w-3xl">
        <LocalForm mode="edit" local={local} onCancel={() => navigate('/admin/locales')} />
      </div>
    </PageWrapper>
  )
}
