import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { getIncidentPermissions } from '../utils/incidentPermissions'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { IncidentForm } from '../components/IncidentForm'

export function IncidentNewPage() {
  const { t } = useTranslation('incidents')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const permissions = user ? getIncidentPermissions(null, user.rol) : null

  useEffect(() => {
    if (permissions && !permissions.canCreate) {
      navigate('/incidents', { replace: true })
    }
  }, [permissions, navigate])

  if (!permissions?.canCreate) return null

  return (
    <PageWrapper title={t('form.titleNew')}>
      <div className="mx-auto max-w-3xl">
        <IncidentForm mode="create" onCancel={() => navigate('/incidents')} />
      </div>
    </PageWrapper>
  )
}
