import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SemaforoRow } from '../../../components/shared/SemaforoRow'
import { calcularEstadoSemaforoDesdeFecha } from '../utils/semaforoPendientes'
import { FiltroAlertaChip } from './layout/FiltroAlertaChip'
import type { AccionCorrectivaResumen } from '../types/dashboardSummary.types'

const ORIGEN_ROUTE: Record<AccionCorrectivaResumen['origenTipo'], string> = {
  QE: '/quality-events',
  NC: '/nonconformities',
  INCIDENTE: '/incidents',
}

interface MisACsWidgetProps {
  accionesCorrectivasAsignadas: AccionCorrectivaResumen[]
  // Con una tarjeta de alerta seleccionada, la página pasa el arreglo ya filtrado (el mismo que
  // cuenta la tarjeta) y la etiqueta del chip (dashboard-alertas-coherentes D2).
  etiquetaFiltro?: string
  onQuitarFiltro?: () => void
}

export function MisACsWidget({ accionesCorrectivasAsignadas, etiquetaFiltro, onQuitarFiltro }: MisACsWidgetProps) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('operario.misACs.title')}
      </h2>
      {etiquetaFiltro && (
        <FiltroAlertaChip etiqueta={etiquetaFiltro} n={accionesCorrectivasAsignadas.length} onQuitar={onQuitarFiltro} />
      )}
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {accionesCorrectivasAsignadas.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('operario.misACs.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {accionesCorrectivasAsignadas.map((ac) => {
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
