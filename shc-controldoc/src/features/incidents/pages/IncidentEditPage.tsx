import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../../stores/authStore'
import { useIncident } from '../hooks/useIncidents'
import { getIncidentPermissions } from '../utils/incidentPermissions'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { IncidentForm } from '../components/IncidentForm'

function SkeletonBlock() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

export function IncidentEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('incidents')
  const user = useAuthStore((s) => s.user)

  const { data: incident, isLoading, isError } = useIncident(id ?? '')

  const permissions = user && incident ? getIncidentPermissions(incident, user.rol) : null

  useEffect(() => {
    if (!incident) return
    if (incident.deletedAt) {
      navigate('/incidents', { replace: true })
      return
    }
    if (permissions && !permissions.canEdit) {
      navigate('/incidents', { replace: true })
    }
  }, [incident, permissions, navigate])

  if (isLoading) return <SkeletonBlock />

  if (isError || !incident) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-error/30 bg-error/5 px-6 py-8 text-center">
          <p className="text-sm text-error">{t('detail.notFound')}</p>
        </div>
      </div>
    )
  }

  if (!permissions?.canEdit) return null

  return (
    <PageWrapper title={`${t('form.titleEdit')} — ${incident.numero}`}>
      <div className="mx-auto max-w-3xl">
        <IncidentForm
          mode="edit"
          incident={incident}
          onCancel={() => navigate(`/incidents/${incident.id}`)}
        />
      </div>
    </PageWrapper>
  )
}
