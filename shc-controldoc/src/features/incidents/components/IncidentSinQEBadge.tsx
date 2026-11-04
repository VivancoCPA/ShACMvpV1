import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { getIncidentQEPlazoInfo } from '../utils/incidentQEAlert'
import type { IncidentQEAlertLevel } from '../utils/incidentQEAlert'
import type { Incidente } from '../types/incident.types'

const COLOR_MAP: Record<'AMARILLO' | 'ROJO', string> = {
  AMARILLO: 'bg-amber/15 text-amber dark:bg-amber/15 dark:text-amber',
  ROJO: 'bg-error/15 text-error dark:bg-error/15 dark:text-error',
}

// < 48 h → "X h"; desde 48 h → "X d Y h".
function formatDuracion(horas: number, t: TFunction<'incidents'>): string {
  if (horas < 48) return t('list.sinQEBadge.duracion.horas', { h: horas })
  return t('list.sinQEBadge.duracion.diasHoras', { d: Math.floor(horas / 24), h: horas % 24 })
}

interface Props {
  nivel: IncidentQEAlertLevel
  incidente: Pick<Incidente, 'tipo' | 'fechaEvento'>
  now?: Date
  className?: string
}

// RN-INC-006 — desaparece automáticamente en el siguiente render en cuanto el
// incidente obtiene qeId, sin acción explícita: nivel es una función pura del
// incidente (ver getIncidentQEAlertLevel), no un estado propio del componente.
export function IncidentSinQEBadge({ nivel, incidente, now, className = '' }: Props) {
  const { t } = useTranslation('incidents')

  if (nivel === 'NONE') return null

  const { plazoHoras, horasRestantes } = getIncidentQEPlazoInfo(incidente, now)
  const tooltip =
    nivel === 'ROJO'
      ? t('list.sinQEBadge.tooltip.ROJO', {
          plazo: plazoHoras,
          vencido: formatDuracion(Math.abs(horasRestantes), t),
        })
      : t('list.sinQEBadge.tooltip.AMARILLO', {
          plazo: plazoHoras,
          restante: formatDuracion(Math.max(horasRestantes, 0), t),
        })

  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ${COLOR_MAP[nivel]} ${className}`}
    >
      {t('list.sinQEBadge.label')}
    </span>
  )
}
