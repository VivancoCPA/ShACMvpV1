import { useTranslation } from 'react-i18next'
import type { NormaISO } from '../../quality-events/types/qualityEvent.types'

interface HallazgosPorNormaWidgetProps {
  hallazgosPorNorma: { norma: NormaISO; total: number }[]
}

const NORMA_LABELS: Record<NormaISO, string> = {
  ISO_9001_2015: 'ISO 9001:2015',
  ISO_45001_2018: 'ISO 45001:2018',
  OTRA: 'Otra normativa',
}

export function HallazgosPorNormaWidget({ hallazgosPorNorma }: HallazgosPorNormaWidgetProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('auditor.hallazgosPorNorma.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {hallazgosPorNorma.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('auditor.hallazgosPorNorma.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {hallazgosPorNorma.map(({ norma, total }) => (
              <div
                key={norma}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 dark:border-hairline/20 dark:bg-surface-dark-elevated"
              >
                <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{NORMA_LABELS[norma]}</p>
                <span className="shrink-0 text-sm font-medium text-body dark:text-on-dark-soft">{total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
