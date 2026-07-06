import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../../stores/authStore'
import { puedeAdministrarLocales } from '../permissions/localesPermissions'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { LocalForm } from '../components/LocalForm'

export function LocalNewPage() {
  const { t } = useTranslation('locations')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const permissions = user ? puedeAdministrarLocales(user) : null

  useEffect(() => {
    if (permissions === false) {
      navigate('/admin/locales', { replace: true })
    }
  }, [permissions, navigate])

  if (!permissions) return null

  return (
    <PageWrapper title={t('form.titles.nuevoLocal')}>
      <div className="mx-auto max-w-3xl">
        <LocalForm mode="create" onCancel={() => navigate('/admin/locales')} />
      </div>
    </PageWrapper>
  )
}
