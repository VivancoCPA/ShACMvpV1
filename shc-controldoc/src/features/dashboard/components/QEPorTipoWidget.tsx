import { useTranslation } from 'react-i18next'
import type { QEType } from '../../quality-events/types/qualityEvent.types'

const QE_TIPOS: QEType[] = ['CALIDAD', 'SST', 'ADUANERO', 'OPERACIONAL']

interface QEPorTipoWidgetProps {
  qeAbiertosPorTipo: Record<QEType, number>
}

export function QEPorTipoWidget({ qeAbiertosPorTipo }: QEPorTipoWidgetProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('supervisor.qePorTipo.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        <div className="space-y-2 p-3">
          {QE_TIPOS.map((tipo) => (
            <div
              key={tipo}
              className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 dark:border-hairline/20 dark:bg-surface-dark-elevated"
            >
              <p className="text-sm font-medium text-ink dark:text-on-dark">
                {t(`supervisor.qePorTipo.tipos.${tipo}`)}
              </p>
              <span className="shrink-0 text-sm font-medium text-body dark:text-on-dark-soft">
                {qeAbiertosPorTipo[tipo]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
