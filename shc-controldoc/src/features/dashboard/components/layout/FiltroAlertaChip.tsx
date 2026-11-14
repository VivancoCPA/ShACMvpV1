import { useTranslation } from 'react-i18next'

interface FiltroAlertaChipProps {
  etiqueta: string
  n: number
  onQuitar?: () => void
}

// Chip "Mostrando: {etiqueta} ({n}) ✕" de una lista filtrada por una tarjeta de alerta
// (dashboard-alertas-coherentes D2). `n` es el largo del mismo arreglo que se renderiza.
export function FiltroAlertaChip({ etiqueta, n, onQuitar }: FiltroAlertaChipProps) {
  const { t } = useTranslation('dashboard')
  return (
    <div className="inline-flex items-center gap-1.5 rounded-pill bg-surface-soft py-1 pl-3 pr-1 text-xs font-medium text-body-strong dark:bg-surface-dark-soft dark:text-on-dark">
      <span>{t('accionesRequeridas.mostrando', { etiqueta, n })}</span>
      {onQuitar && (
        <button
          type="button"
          onClick={onQuitar}
          aria-label={t('accionesRequeridas.quitarFiltro')}
          className="flex h-5 w-5 items-center justify-center rounded-pill text-muted hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral dark:text-on-dark-soft dark:hover:bg-surface-dark-elevated dark:hover:text-on-dark"
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  )
}
