import { useTranslation } from 'react-i18next'
import type { KpiPeriodoTipo } from '../../types/kpi.types'

const TIPOS: KpiPeriodoTipo[] = ['mes', 'trimestre', 'anio']

interface PeriodoSelectorProps {
  value: KpiPeriodoTipo
  onChange: (tipo: KpiPeriodoTipo) => void
}

// Control segmentado Mes / Trimestre / Año. El estado vive en la URL (usePeriodoKpi).
export function PeriodoSelector({ value, onChange }: PeriodoSelectorProps) {
  const { t } = useTranslation('dashboard')
  return (
    <div
      role="group"
      aria-label={t('layout.periodo.label')}
      className="inline-flex rounded-md border border-hairline bg-canvas p-0.5 dark:border-hairline/20 dark:bg-surface-dark-soft"
    >
      {TIPOS.map((tipo) => {
        const activo = tipo === value
        return (
          <button
            key={tipo}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(tipo)}
            className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
              activo
                ? 'bg-coral text-white dark:bg-coral dark:text-white'
                : 'text-body hover:bg-surface-soft dark:text-on-dark-soft dark:hover:bg-surface-dark-elevated'
            }`}
          >
            {t(`layout.periodo.${tipo}`)}
          </button>
        )
      })}
    </div>
  )
}
