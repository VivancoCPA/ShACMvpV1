import { useTranslation } from 'react-i18next'

interface HallazgosPorAreaWidgetProps {
  hallazgosPorArea: { area: string; total: number }[]
}

export function HallazgosPorAreaWidget({ hallazgosPorArea }: HallazgosPorAreaWidgetProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('auditor.hallazgosPorArea.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {hallazgosPorArea.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('auditor.hallazgosPorArea.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {hallazgosPorArea.map(({ area, total }) => (
              <div
                key={area}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 dark:border-hairline/20 dark:bg-surface-dark-elevated"
              >
                <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{area}</p>
                <span className="shrink-0 text-sm font-medium text-body dark:text-on-dark-soft">{total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
