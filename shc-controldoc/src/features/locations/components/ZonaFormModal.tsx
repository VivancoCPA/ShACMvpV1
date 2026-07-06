import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { ZonaForm } from './ZonaForm'
import type { Zona } from '../../incidents/types/incident.types'

interface ZonaFormModalProps {
  localId: string
  zona?: Zona
  mode: 'create' | 'edit'
}

export function ZonaFormModal({ localId, zona, mode }: ZonaFormModalProps) {
  const { t } = useTranslation('locations')
  const navigate = useNavigate()

  const titulo = mode === 'edit' ? t('form.titles.editarZona') : t('form.titles.nuevaZona')

  const handleClose = () => navigate('/admin/locales')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('form.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 className="mb-4 font-medium text-ink dark:text-on-dark">{titulo}</h2>
        <ZonaForm mode={mode} localId={localId} zona={zona} onSaved={handleClose} />
      </div>
    </div>
  )
}
