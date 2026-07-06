import { useTranslation } from 'react-i18next'
import { ShieldAlert, X } from 'lucide-react'

interface BloqueoIncidentesModalProps {
  tipo: 'local' | 'zona'
  mensaje: string
  onClose: () => void
}

export function BloqueoIncidentesModal({ tipo, mensaje, onClose }: BloqueoIncidentesModalProps) {
  const { t } = useTranslation('locations')
  const descripcion =
    tipo === 'local' ? t('bloqueoIncidentes.mensajeLocal') : t('bloqueoIncidentes.mensajeZona')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('bloqueoIncidentes.cerrar')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4 flex items-start gap-3">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-error" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">{t('bloqueoIncidentes.titulo')}</h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">{descripcion}</p>
            <p className="mt-2 text-sm font-medium text-error">{mensaje}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled
            title={t('bloqueoIncidentes.verIncidentesNota')}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-muted opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft"
          >
            {t('bloqueoIncidentes.verIncidentes')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('bloqueoIncidentes.cerrar')}
          </button>
        </div>
      </div>
    </div>
  )
}
