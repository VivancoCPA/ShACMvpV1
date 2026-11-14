import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { ResponsablesAcForm } from './ResponsablesAcForm'

interface ResponsablesAcEmpresaModalProps {
  empresaId: string
  empresaNombre: string
  onClose: () => void
}

/** SUPERADMIN edita los responsables de AC de cualquier empresa desde /admin/empresas. */
export function ResponsablesAcEmpresaModal({ empresaId, empresaNombre, onClose }: ResponsablesAcEmpresaModalProps) {
  const { t } = useTranslation('users')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 dark:bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="responsables-ac-modal-title"
        className="relative w-full max-w-4xl rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('responsablesAc.cerrar')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 id="responsables-ac-modal-title" className="mb-1 pr-8 font-medium text-ink dark:text-on-dark">
          {t('responsablesAc.modalTitle', { empresa: empresaNombre })}
        </h2>
        <p className="mb-5 text-sm text-body dark:text-on-dark-soft">{t('responsablesAc.descripcion')}</p>
        <ErrorBoundary>
          <ResponsablesAcForm empresaId={empresaId} />
        </ErrorBoundary>
      </div>
    </div>
  )
}
