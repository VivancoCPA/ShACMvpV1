import { useTranslation } from 'react-i18next'
import { ShieldAlert, X } from 'lucide-react'
import type { AreaConteoBloqueo } from '../types/area.types'

interface AreaBloqueoModalProps {
  conteo: AreaConteoBloqueo
  onClose: () => void
}

export function AreaBloqueoModal({ conteo, onClose }: AreaBloqueoModalProps) {
  const { t } = useTranslation('areas')

  const lineas = [
    conteo.qe > 0 ? t('bloqueo.lineaQe', { count: conteo.qe }) : null,
    conteo.nc > 0 ? t('bloqueo.lineaNc', { count: conteo.nc }) : null,
    conteo.incidentes > 0 ? t('bloqueo.lineaIncidentes', { count: conteo.incidentes }) : null,
  ].filter((linea): linea is string => linea !== null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('bloqueo.cerrar')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4 flex items-start gap-3">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-error" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">{t('bloqueo.titulo')}</h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">{t('bloqueo.descripcion')}</p>
            <ul className="mt-2 space-y-1 text-sm font-medium text-error">
              {lineas.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted dark:text-on-dark-soft">
              {t('bloqueo.total', { total: conteo.total })}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('bloqueo.cerrar')}
          </button>
        </div>
      </div>
    </div>
  )
}
