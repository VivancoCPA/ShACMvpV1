import { useTranslation } from 'react-i18next'

export function IncidentMapLegend() {
  const { t } = useTranslation('incidents')

  return (
    <div className="absolute bottom-3 left-3 rounded-lg bg-surface-card/80 px-3 py-2 backdrop-blur-sm dark:bg-surface-dark-elevated/80">
      <ul className="flex flex-col gap-1.5">
        <li className="flex items-center gap-2 text-xs text-ink dark:text-on-dark">
          <span className="h-3 w-3 flex-shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
          {t('map.legend.single')}
        </li>
        <li className="flex items-center gap-2 text-xs text-ink dark:text-on-dark">
          <span className="h-3 w-3 flex-shrink-0 rounded-full bg-amber" aria-hidden="true" />
          {t('map.legend.twoToFour')}
        </li>
        <li className="flex items-center gap-2 text-xs text-ink dark:text-on-dark">
          <span className="h-3 w-3 flex-shrink-0 rounded-full bg-error" aria-hidden="true" />
          {t('map.legend.fivePlus')}
        </li>
      </ul>
    </div>
  )
}
