import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { NCForm } from '../components/NCForm'

export function NonconformityNewPage() {
  const { t } = useTranslation('nonconformities')
  const navigate = useNavigate()

  return (
    <PageWrapper title={t('form.actions.submit')}>
      <div className="mx-auto max-w-3xl rounded-xl bg-surface-card p-8 dark:bg-surface-dark-elevated">
        <NCForm onCancel={() => navigate('/nonconformities')} />
      </div>
    </PageWrapper>
  )
}
