import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { INCIDENT_TYPE_LABELS } from '../../../constants/shared.constants'
import { formatShortDate } from '../../../utils/date.utils'
import { IncidentMapLegend } from './IncidentMapLegend'
import type { Incidente } from '../types/incident.types'

export interface MarkerGroup {
  id: string
  members: Incidente[]
  centroid: { x: number; y: number }
}

const CLUSTER_RADIUS = 5

export function computeClusters(incidents: Incidente[], localId: string): MarkerGroup[] {
  const eligible = incidents
    .filter((inc) => inc.localId === localId && inc.ubicacion !== undefined)
    .sort((a, b) => a.ubicacion!.x - b.ubicacion!.x)

  const groups: MarkerGroup[] = []
  const assigned = new Set<string>()

  for (const seed of eligible) {
    if (assigned.has(seed.id)) continue

    const members: Incidente[] = [seed]
    assigned.add(seed.id)

    for (const other of eligible) {
      if (assigned.has(other.id)) continue
      const dx = seed.ubicacion!.x - other.ubicacion!.x
      const dy = seed.ubicacion!.y - other.ubicacion!.y
      if (Math.sqrt(dx * dx + dy * dy) <= CLUSTER_RADIUS) {
        members.push(other)
        assigned.add(other.id)
      }
    }

    const cx = members.reduce((sum, m) => sum + m.ubicacion!.x, 0) / members.length
    const cy = members.reduce((sum, m) => sum + m.ubicacion!.y, 0) / members.length

    groups.push({ id: seed.id, members, centroid: { x: cx, y: cy } })
  }

  return groups
}

function getMarkerStyle(count: number): string {
  if (count >= 5) return 'w-10 h-10 bg-error'
  if (count >= 2) return 'w-[30px] h-[30px] bg-amber'
  return 'w-5 h-5 bg-blue-500'
}

function mostFrequent(values: string[]): string {
  const freq = new Map<string, number>()
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

interface Props {
  incidentes: Incidente[]
  localId: string
  planoPngUrl?: string
  onGroupClick: (group: MarkerGroup) => void
}

export function IncidentMapCanvas({ incidentes, localId, planoPngUrl, onGroupClick }: Props) {
  const { t, i18n } = useTranslation('incidents')
  const [imgError, setImgError] = useState(false)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)

  const groups = useMemo(
    () => computeClusters(incidentes, localId),
    [incidentes, localId],
  )

  const showPlan = !imgError && !!planoPngUrl

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-soft">
      {/* Floor plan image */}
      {planoPngUrl && !imgError && (
        <img
          src={planoPngUrl}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setImgError(true)}
          aria-hidden="true"
        />
      )}

      {/* Plan unavailable */}
      {(!planoPngUrl || imgError) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-muted dark:text-on-dark-soft">{t('map.planUnavailable')}</p>
        </div>
      )}

      {/* Empty state overlay (plan may still be visible) */}
      {showPlan && groups.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-md bg-canvas/80 px-3 py-2 text-sm text-muted dark:bg-surface-dark/80 dark:text-on-dark-soft">
            {t('map.noIncidents')}
          </p>
        </div>
      )}

      {/* Markers */}
      {groups.map((group) => {
        const { id, members, centroid } = group
        const count = members.length
        const markerStyle = getMarkerStyle(count)
        const isHovered = hoveredGroupId === id

        const allSameZone = members.every((m) => m.zonaId === members[0].zonaId)
        const zoneLabel = allSameZone
          ? (members[0].zonaNombre ?? '')
          : t('map.multipleZones')

        const tipos = members.map((m) => m.tipo)
        const topTipo = mostFrequent(tipos)
        const tipoLabel = INCIDENT_TYPE_LABELS[topTipo as keyof typeof INCIDENT_TYPE_LABELS] ?? topTipo

        const latestDate = members
          .map((m) => m.fechaEvento)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

        return (
          <div
            key={id}
            style={{ left: `${centroid.x}%`, top: `${centroid.y}%` }}
            className="absolute"
          >
            {/* Marker circle */}
            <button
              type="button"
              onClick={() => onGroupClick(group)}
              onMouseEnter={() => setHoveredGroupId(id)}
              onMouseLeave={() => setHoveredGroupId(null)}
              style={{ transform: 'translate(-50%, -50%)' }}
              className={`${markerStyle} flex items-center justify-center rounded-full text-xs font-bold text-white opacity-85 transition-opacity hover:opacity-100`}
              aria-label={`${count} incidente${count !== 1 ? 's' : ''}`}
            >
              {count > 1 ? count : null}
            </button>

            {/* Tooltip */}
            {isHovered && (
              <div
                style={{ transform: 'translate(-50%, calc(-100% - 12px))' }}
                className="absolute left-0 top-0 z-10 w-40 rounded-md bg-ink/90 px-2.5 py-2 text-xs text-white shadow-lg dark:bg-surface-dark-elevated dark:text-on-dark"
              >
                <p className="font-medium">{count} incidente{count !== 1 ? 's' : ''}</p>
                <p className="mt-0.5 text-white/70">{zoneLabel}</p>
                <p className="mt-0.5 text-white/70">{tipoLabel}</p>
                <p className="mt-0.5 text-white/70">{formatShortDate(latestDate, i18n.language)}</p>
              </div>
            )}
          </div>
        )
      })}

      {/* Legend */}
      <IncidentMapLegend />
    </div>
  )
}
