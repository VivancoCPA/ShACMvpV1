import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { AreaForm } from './AreaForm'
import type { Area } from '../types/area.types'

interface AreaFormModalProps {
  area?: Area
  onClose: () => void
}

export function AreaFormModal({ area, onClose }: AreaFormModalProps) {
  const { t } = useTranslation('areas')
  const isEdit = !!area

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 dark:bg-black/60">
      <div className="relative w-full max-w-lg rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('form.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <h2 className="mb-4 font-medium text-ink dark:text-on-dark">
          {isEdit ? t('form.titles.editarArea') : t('form.titles.nuevaArea')}
        </h2>

        <AreaForm mode={isEdit ? 'edit' : 'create'} area={area} onCancel={onClose} onSuccess={onClose} />
      </div>
    </div>
  )
}
