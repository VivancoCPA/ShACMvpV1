import { useTranslation } from 'react-i18next'

interface EvidenciasHallazgosWidgetProps {
  evidenciasHallazgos: { conEvidencia: number; sinEvidencia: number }
}

export function EvidenciasHallazgosWidget({ evidenciasHallazgos }: EvidenciasHallazgosWidgetProps) {
  const { t } = useTranslation('dashboard')
  const { conEvidencia, sinEvidencia } = evidenciasHallazgos

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('auditor.evidenciasHallazgos.title')}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-hairline bg-surface-card px-4 py-5 text-center dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <p className="text-2xl font-medium text-success">{conEvidencia}</p>
          <p className="mt-1 text-sm text-body dark:text-on-dark-soft">
            {t('auditor.evidenciasHallazgos.conEvidencia')}
          </p>
        </div>
        <div className="rounded-lg border border-hairline bg-surface-card px-4 py-5 text-center dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <p className="text-2xl font-medium text-error">{sinEvidencia}</p>
          <p className="mt-1 text-sm text-body dark:text-on-dark-soft">
            {t('auditor.evidenciasHallazgos.sinEvidencia')}
          </p>
        </div>
      </div>
    </section>
  )
}
