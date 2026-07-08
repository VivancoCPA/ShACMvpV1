import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SemaforoRow } from '../../../components/shared/SemaforoRow'
import { QEStatusBadge } from '../../quality-events/components/QEStatusBadge'
import { calcularEstadoSemaforoDesdeFecha } from '../utils/semaforoPendientes'
import type { QEResumen } from '../types/dashboardSummary.types'

interface MisQEsWidgetProps {
  misQEReportados: QEResumen[]
}

export function MisQEsWidget({ misQEReportados }: MisQEsWidgetProps) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('operario.misQEs.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {misQEReportados.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('operario.misQEs.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {misQEReportados.map((qe) => {
              const onClick = () => navigate(`/quality-events/${qe.id}`)

              if (qe.estado === 'EN_VERIFICACION' && qe.fechaVerificacionProgramada) {
                const { estado, diasHabilesRestantes } = calcularEstadoSemaforoDesdeFecha(
                  qe.fechaVerificacionProgramada,
                )
                return (
                  <SemaforoRow
                    key={qe.id}
                    estado={estado}
                    codigo={qe.numero}
                    descripcion={qe.areaAfectada}
                    diasHabilesRestantes={diasHabilesRestantes}
                    onClick={onClick}
                  />
                )
              }

              return (
                <button
                  key={qe.id}
                  type="button"
                  onClick={onClick}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 text-left dark:border-hairline/20 dark:bg-surface-dark-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{qe.numero}</p>
                    <p className="truncate text-sm text-muted dark:text-on-dark-soft">{qe.areaAfectada}</p>
                  </div>
                  <QEStatusBadge status={qe.estado} className="shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
