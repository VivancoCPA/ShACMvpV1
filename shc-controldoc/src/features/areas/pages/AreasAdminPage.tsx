import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { useAuthStore } from '../../../stores/authStore'
import { puedeAdministrarAreas } from '../permissions/areasPermissions'
import { AreaList } from '../components/AreaList'
import { AreaFormModal } from '../components/AreaFormModal'
import type { Area } from '../types/area.types'

export function AreasAdminPage() {
  const { t } = useTranslation('areas')
  const user = useAuthStore((s) => s.user)
  const canAdminister = user ? puedeAdministrarAreas(user) : false

  const [formArea, setFormArea] = useState<Area | null | undefined>(undefined)

  const actions = canAdminister ? (
    <button
      type="button"
      onClick={() => setFormArea(null)}
      className="inline-flex items-center gap-1.5 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
    >
      <Plus size={14} aria-hidden="true" />
      {t('header.nuevaArea')}
    </button>
  ) : undefined

  return (
    <PageWrapper title={t('header.title')} actions={actions}>
      <ErrorBoundary>
        <AreaList onEdit={setFormArea} />
      </ErrorBoundary>

      {formArea !== undefined && (
        <AreaFormModal area={formArea ?? undefined} onClose={() => setFormArea(undefined)} />
      )}
    </PageWrapper>
  )
}
