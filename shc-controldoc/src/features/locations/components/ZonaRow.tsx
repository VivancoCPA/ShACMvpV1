import { useTranslation } from 'react-i18next'
import { Pencil, Ban, RotateCcw } from 'lucide-react'
import { ActivoBadge } from './ActivoBadge'
import type { Zona } from '../../incidents/types/incident.types'

interface ZonaRowProps {
  zona: Zona
  incidentesBloqueantes: number
  canAdminister: boolean
  onEditar: (zona: Zona) => void
  onDesactivar: (zona: Zona) => void
  onReactivar: (zona: Zona) => void
}

export function ZonaRow({
  zona,
  incidentesBloqueantes,
  canAdminister,
  onEditar,
  onDesactivar,
  onReactivar,
}: ZonaRowProps) {
  const { t } = useTranslation('locations')

  return (
    <div
      data-testid={`zona-row-${zona.id}`}
      className="flex items-center justify-between gap-3 border-t border-hairline/60 py-2.5 pl-12 pr-4 dark:border-hairline/10"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-sm text-ink dark:text-on-dark">{zona.nombre}</span>
        <ActivoBadge activo={zona.activo} />
        {incidentesBloqueantes > 0 && (
          <span className="truncate text-xs text-error">
            · {t('list.incidentesActivos', { count: incidentesBloqueantes })}
          </span>
        )}
      </div>
      {canAdminister && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEditar(zona)}
            aria-label={t('actions.editar')}
            title={t('actions.editar')}
            className="rounded-sm p-1 text-muted transition-colors hover:text-coral dark:text-on-dark-soft dark:hover:text-coral"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
          {zona.activo ? (
            <button
              type="button"
              onClick={() => onDesactivar(zona)}
              aria-label={t('actions.desactivar')}
              title={t('actions.desactivar')}
              className="rounded-sm p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
            >
              <Ban size={14} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onReactivar(zona)}
              aria-label={t('actions.reactivar')}
              title={t('actions.reactivar')}
              className="rounded-sm p-1 text-muted transition-colors hover:text-teal dark:text-on-dark-soft dark:hover:text-teal"
            >
              <RotateCcw size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
