import { useTranslation } from 'react-i18next'
import { useAreas } from '../../areas/hooks/useAreas'

interface TasaCierrePorAreaWidgetProps {
  tasaCierreEnPlazoPorArea: { areaId: string; tasaCierreEnPlazo: number; totalCerrados: number }[]
}

export function TasaCierrePorAreaWidget({ tasaCierreEnPlazoPorArea }: TasaCierrePorAreaWidgetProps) {
  const { t } = useTranslation('dashboard')
  const { data: areas } = useAreas()
  const nombreArea = (id: string) => areas?.find((a) => a.id === id)?.nombre ?? id

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('auditor.tasaCierrePorArea.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {tasaCierreEnPlazoPorArea.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('auditor.tasaCierrePorArea.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {tasaCierreEnPlazoPorArea.map(({ areaId, tasaCierreEnPlazo, totalCerrados }) => (
              <div
                key={areaId}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 dark:border-hairline/20 dark:bg-surface-dark-elevated"
              >
                <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{nombreArea(areaId)}</p>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium text-body dark:text-on-dark-soft">
                    {t('auditor.tasaCierrePorArea.porcentaje', { valor: Math.round(tasaCierreEnPlazo) })}
                  </p>
                  <p className="text-xs text-muted dark:text-on-dark-soft">
                    {t('auditor.tasaCierrePorArea.totalCerrados', { count: totalCerrados })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
