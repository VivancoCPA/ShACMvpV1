import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SemaforoRow } from '../../../components/shared/SemaforoRow'
import { calcularEstadoSemaforoDesdeFecha } from '../utils/semaforoPendientes'
import type { QEResumen, AccionCorrectivaResumen } from '../types/dashboardSummary.types'

const ORIGEN_ROUTE: Record<AccionCorrectivaResumen['origenTipo'], string> = {
  QE: '/quality-events',
  NC: '/nonconformities',
  INCIDENTE: '/incidents',
}

interface PanelPendientesAreaWidgetProps {
  qesEnVerificacionArea: QEResumen[]
  accionesCorrectivasPendientesArea: AccionCorrectivaResumen[]
}

export function PanelPendientesAreaWidget({
  qesEnVerificacionArea,
  accionesCorrectivasPendientesArea,
}: PanelPendientesAreaWidgetProps) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  const isEmpty = qesEnVerificacionArea.length === 0 && accionesCorrectivasPendientesArea.length === 0

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('supervisor.panelPendientes.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {isEmpty ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('supervisor.panelPendientes.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {qesEnVerificacionArea.map((qe) => {
              const { estado, diasHabilesRestantes } = calcularEstadoSemaforoDesdeFecha(
                qe.fechaVerificacionProgramada!,
              )
              return (
                <SemaforoRow
                  key={qe.id}
                  estado={estado}
                  codigo={qe.numero}
                  descripcion={qe.areaAfectada}
                  diasHabilesRestantes={diasHabilesRestantes}
                  onClick={() => navigate(`/quality-events/${qe.id}`)}
                />
              )
            })}
            {accionesCorrectivasPendientesArea.map((ac) => {
              const { estado, diasHabilesRestantes } = calcularEstadoSemaforoDesdeFecha(ac.plazoFecha)
              return (
                <SemaforoRow
                  key={ac.id}
                  estado={estado}
                  codigo={ac.descripcion}
                  descripcion={t(`operario.misACs.origen.${ac.origenTipo}`)}
                  diasHabilesRestantes={diasHabilesRestantes}
                  onClick={() => navigate(`${ORIGEN_ROUTE[ac.origenTipo]}/${ac.origenId}`)}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
