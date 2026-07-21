import { useTranslation } from 'react-i18next'
import type { IncidentQEAlertLevel } from '../utils/incidentQEAlert'

const COLOR_MAP: Record<'AMARILLO' | 'ROJO', string> = {
  AMARILLO: 'bg-amber/15 text-amber dark:bg-amber/15 dark:text-amber',
  ROJO: 'bg-error/15 text-error dark:bg-error/15 dark:text-error',
}

interface Props {
  nivel: IncidentQEAlertLevel
  className?: string
}

// RN-INC-006 — desaparece automáticamente en el siguiente render en cuanto el
// incidente obtiene qeId, sin acción explícita: nivel es una función pura del
// incidente (ver getIncidentQEAlertLevel), no un estado propio del componente.
export function IncidentSinQEBadge({ nivel, className = '' }: Props) {
  const { t } = useTranslation('incidents')

  if (nivel === 'NONE') return null

  return (
    <span
      title={t(`list.sinQEBadge.tooltip.${nivel}`)}
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ${COLOR_MAP[nivel]} ${className}`}
    >
      {t('list.sinQEBadge.label')}
    </span>
  )
}
