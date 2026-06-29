import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { IncidentSeveridad } from '../types/incident.types'

interface EscaladoBannerProps {
  severidad: IncidentSeveridad
}

export function EscaladoBanner({ severidad }: EscaladoBannerProps) {
  const { t } = useTranslation('incidents')

  if (severidad !== 'CRITICA' && severidad !== 'ALTA') return null

  const isCritica = severidad === 'CRITICA'

  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 ${
        isCritica
          ? 'border-error/30 bg-error/10'
          : 'border-amber/30 bg-amber/10'
      }`}
    >
      <AlertTriangle
        size={18}
        className={`mt-0.5 shrink-0 ${isCritica ? 'text-error' : 'text-amber'}`}
      />
      <p className={`text-sm font-medium ${isCritica ? 'text-error' : 'text-amber'}`}>
        {t('detail.escalado', { severidad: t(`severidad.${severidad}`) })}
      </p>
    </div>
  )
}
