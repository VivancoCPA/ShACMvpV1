import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { ACSolicitudAjustePlazoResumen } from '../types/dashboardSummary.types'

interface ACsExtensionPlazoWidgetProps {
  acs: ACSolicitudAjustePlazoResumen[]
}

export function ACsExtensionPlazoWidget({ acs }: ACsExtensionPlazoWidgetProps) {
  const { t, i18n } = useTranslation('dashboard')
  const navigate = useNavigate()

  const gerenciaPendientes = acs
    .map((ac) => ({
      ac,
      solicitud: ac.solicitudesAjustePlazo.find((s) => s.estado === 'PENDIENTE' && s.requiereAprobacionGerencia),
    }))
    .filter((entry): entry is { ac: ACSolicitudAjustePlazoResumen; solicitud: NonNullable<typeof entry.solicitud> } =>
      !!entry.solicitud,
    )

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('altaDireccion.acsExtensionPlazo.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {gerenciaPendientes.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('altaDireccion.acsExtensionPlazo.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {gerenciaPendientes.map(({ ac, solicitud }) => (
              <button
                key={ac.acId}
                type="button"
                onClick={() => navigate(`/quality-events/${ac.qeId}`)}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 text-left dark:border-hairline/20 dark:bg-surface-dark-elevated"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{ac.qeNumero}</p>
                  <p className="truncate text-sm text-muted dark:text-on-dark-soft">{ac.acDescripcion}</p>
                </div>
                <p className="shrink-0 text-xs text-muted dark:text-on-dark-soft">
                  {t('altaDireccion.acsExtensionPlazo.fechaSolicitada', {
                    fecha: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
                      new Date(solicitud.fechaSolicitada),
                    ),
                  })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
