import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { IncidentStatusBadge } from './IncidentStatusBadge'
import { formatShortDate } from '../../../utils/date.utils'
import { useArea } from '../../areas/hooks/useAreas'
import type { MarkerGroup } from './IncidentMapCanvas'

interface Props {
  group: MarkerGroup
  onClose: () => void
}

export function IncidentMapSidePanel({ group, onClose }: Props) {
  const { t, i18n } = useTranslation('incidents')
  const navigate = useNavigate()

  const isSingle = group.members.length === 1

  return (
    <div className="flex h-full w-80 flex-shrink-0 flex-col overflow-hidden border-l border-hairline bg-canvas dark:border-hairline/20 dark:bg-surface-dark">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3 dark:border-hairline/20">
        <span className="text-sm font-medium text-ink dark:text-on-dark">
          {isSingle ? group.members[0].numero : `${group.members.length} incidentes`}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common:actions.close')}
          className="rounded-sm p-1 text-muted transition-colors hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isSingle ? (
          /* Single incident detail */
          <div className="p-4">
            <SingleDetail group={group} onNavigate={(id) => navigate(`/incidents/${id}`)} />
          </div>
        ) : (
          /* Multi incident list */
          <ul className="divide-y divide-hairline dark:divide-hairline/20">
            {group.members.map((inc) => (
              <li key={inc.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/incidents/${inc.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-soft dark:hover:bg-surface-dark-soft"
                >
                  <span className="font-mono text-xs font-medium text-ink dark:text-on-dark">
                    {inc.numero}
                  </span>
                  <IncidentStatusBadge status={inc.estado} />
                  <span className="ml-auto text-xs text-muted dark:text-on-dark-soft">
                    {formatShortDate(inc.fechaEvento, i18n.language)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

interface SingleDetailProps {
  group: MarkerGroup
  onNavigate: (id: string) => void
}

function SingleDetail({ group, onNavigate }: SingleDetailProps) {
  const { t, i18n } = useTranslation('incidents')
  const inc = group.members[0]
  const { data: area } = useArea(inc.areaId)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-ink dark:text-on-dark">{inc.descripcion}</p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-muted dark:text-on-dark-soft">{t('list.columns.tipo')}</dt>
          <dd className="mt-0.5 text-ink dark:text-on-dark">{inc.tipo}</dd>
        </div>
        <div>
          <dt className="text-muted dark:text-on-dark-soft">{t('list.columns.estado')}</dt>
          <dd className="mt-0.5">
            <IncidentStatusBadge status={inc.estado} />
          </dd>
        </div>
        <div>
          <dt className="text-muted dark:text-on-dark-soft">{t('list.columns.area')}</dt>
          <dd className="mt-0.5 text-ink dark:text-on-dark">{area?.nombre ?? inc.areaId}</dd>
        </div>
        <div>
          <dt className="text-muted dark:text-on-dark-soft">{t('list.columns.fechaEvento')}</dt>
          <dd className="mt-0.5 text-ink dark:text-on-dark">
            {formatShortDate(inc.fechaEvento, i18n.language)}
          </dd>
        </div>
        {inc.zonaNombre && (
          <div>
            <dt className="text-muted dark:text-on-dark-soft">Zona</dt>
            <dd className="mt-0.5 text-ink dark:text-on-dark">{inc.zonaNombre}</dd>
          </div>
        )}
        {inc.localNombre && (
          <div>
            <dt className="text-muted dark:text-on-dark-soft">Local</dt>
            <dd className="mt-0.5 text-ink dark:text-on-dark">{inc.localNombre}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        onClick={() => onNavigate(inc.id)}
        className="mt-2 w-full rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
      >
        {t('list.actions.verDetalle')}
      </button>
    </div>
  )
}
