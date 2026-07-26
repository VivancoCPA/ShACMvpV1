import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { useAuthStore } from '../../../stores/authStore'
import { puedeAdministrarEmpresas } from '../permissions/empresasPermissions'
import { EmpresaList } from '../components/EmpresaList'
import { EmpresaFormModal } from '../components/EmpresaFormModal'
import type { Empresa } from '../types/empresa.types'

export function EmpresasAdminPage() {
  const { t } = useTranslation('empresas')
  const user = useAuthStore((s) => s.user)
  const canAdminister = user ? puedeAdministrarEmpresas(user) : false

  const [formEmpresa, setFormEmpresa] = useState<Empresa | null | undefined>(undefined)

  const actions = canAdminister ? (
    <button
      type="button"
      onClick={() => setFormEmpresa(null)}
      className="inline-flex items-center gap-1.5 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
    >
      <Plus size={14} aria-hidden="true" />
      {t('header.nuevaEmpresa')}
    </button>
  ) : undefined

  return (
    <PageWrapper title={t('header.title')} actions={actions}>
      <ErrorBoundary>
        <EmpresaList onEdit={setFormEmpresa} canAdminister={canAdminister} />
      </ErrorBoundary>

      {formEmpresa !== undefined && (
        <EmpresaFormModal empresa={formEmpresa ?? undefined} onClose={() => setFormEmpresa(undefined)} />
      )}
    </PageWrapper>
  )
}
