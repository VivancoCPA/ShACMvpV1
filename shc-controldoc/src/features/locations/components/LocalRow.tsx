import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronDown, Pencil, Ban, RotateCcw, Plus } from 'lucide-react'
import { ActivoBadge } from './ActivoBadge'
import { ZonaRow } from './ZonaRow'
import type { Local, Zona } from '../../incidents/types/incident.types'

interface LocalRowProps {
  local: Local
  zonas: Zona[]
  expanded: boolean
  onToggleExpand: (localId: string) => void
  canAdminister: boolean
  incidentesBloqueantesPorZona: Record<string, number>
  onEditarLocal: (local: Local) => void
  onDesactivarLocal: (local: Local) => void
  onReactivarLocal: (local: Local) => void
  onEditarZona: (zona: Zona) => void
  onDesactivarZona: (zona: Zona) => void
  onReactivarZona: (zona: Zona) => void
  onNuevaZona: (localId: string) => void
}

export function LocalRow({
  local,
  zonas,
  expanded,
  onToggleExpand,
  canAdminister,
  incidentesBloqueantesPorZona,
  onEditarLocal,
  onDesactivarLocal,
  onReactivarLocal,
  onEditarZona,
  onDesactivarZona,
  onReactivarZona,
  onNuevaZona,
}: LocalRowProps) {
  const { t } = useTranslation('locations')
  const zonasActivas = zonas.filter((z) => z.activo).length

  return (
    <div
      data-testid={`local-row-${local.id}`}
      className="border-b border-hairline last:border-b-0 dark:border-hairline/20"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleExpand(local.id)}
            aria-label={t(expanded ? 'actions.colapsar' : 'actions.expandir')}
            aria-expanded={expanded}
            className="shrink-0 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
          >
            {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-ink dark:text-on-dark">
                {local.nombre}
              </span>
              <ActivoBadge activo={local.activo} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted dark:text-on-dark-soft">
              {local.direccion && <span>{local.direccion}</span>}
              <span>{t('list.zonasActivas', { activas: zonasActivas, total: zonas.length })}</span>
            </div>
          </div>
        </div>
        {canAdminister && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onEditarLocal(local)}
              aria-label={t('actions.editar')}
              title={t('actions.editar')}
              className="rounded-sm p-1 text-muted transition-colors hover:text-coral dark:text-on-dark-soft dark:hover:text-coral"
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            {local.activo ? (
              <button
                type="button"
                onClick={() => onDesactivarLocal(local)}
                aria-label={t('actions.desactivar')}
                title={t('actions.desactivar')}
                className="rounded-sm p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
              >
                <Ban size={14} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onReactivarLocal(local)}
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

      {expanded && (
        <div className="bg-surface-soft/50 pb-2 dark:bg-surface-dark-soft/30">
          {zonas.map((zona) => (
            <ZonaRow
              key={zona.id}
              zona={zona}
              incidentesBloqueantes={incidentesBloqueantesPorZona[zona.id] ?? 0}
              canAdminister={canAdminister}
              onEditar={onEditarZona}
              onDesactivar={onDesactivarZona}
              onReactivar={onReactivarZona}
            />
          ))}
          {canAdminister && (
            <div className="pl-12 pr-4 pt-2">
              <button
                type="button"
                onClick={() => onNuevaZona(local.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-coral hover:text-coral-dark"
              >
                <Plus size={12} aria-hidden="true" />
                {t('list.nuevaZona')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
