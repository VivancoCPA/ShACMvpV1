import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SemaforoCriticoBanner } from '../../../components/shared/SemaforoCriticoBanner'
import { SemaforoRow } from '../../../components/shared/SemaforoRow'
import { calcularEstadoSemaforoDesdeFecha } from '../utils/semaforoPendientes'
import type { AccionCorrectivaResumen } from '../types/dashboardSummary.types'

const ORIGEN_ROUTE: Record<AccionCorrectivaResumen['origenTipo'], string> = {
  QE: '/quality-events',
  NC: '/nonconformities',
  INCIDENTE: '/incidents',
}

interface ACsPorVencerWidgetProps {
  accionesCorrectivasPorVencer: AccionCorrectivaResumen[]
}

export function ACsPorVencerWidget({ accionesCorrectivasPorVencer }: ACsPorVencerWidgetProps) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  const clasificadas = accionesCorrectivasPorVencer.map((ac) => ({
    ac,
    ...calcularEstadoSemaforoDesdeFecha(ac.plazoFecha),
  }))
  const rojas = clasificadas.filter(({ estado }) => estado === 'ROJO')
  const amarillas = clasificadas.filter(({ estado }) => estado === 'AMARILLO')

  const goToOrigen = (ac: AccionCorrectivaResumen) => navigate(`${ORIGEN_ROUTE[ac.origenTipo]}/${ac.origenId}`)

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">{t('jefeCalidad.acsPorVencer.title')}</h2>
      {rojas.length === 0 && amarillas.length === 0 ? (
        <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('jefeCalidad.acsPorVencer.empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <SemaforoCriticoBanner
            items={rojas.map(({ ac }) => ({
              id: ac.id,
              codigo: ac.descripcion,
              descripcion: t(`operario.misACs.origen.${ac.origenTipo}`),
            }))}
            onItemClick={(id) => {
              const found = rojas.find(({ ac }) => ac.id === id)
              if (found) goToOrigen(found.ac)
            }}
          />
          {amarillas.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
              <div className="space-y-2 p-3">
                {amarillas.map(({ ac, diasHabilesRestantes }) => (
                  <SemaforoRow
                    key={ac.id}
                    estado="AMARILLO"
                    codigo={ac.descripcion}
                    descripcion={t(`operario.misACs.origen.${ac.origenTipo}`)}
                    diasHabilesRestantes={diasHabilesRestantes}
                    onClick={() => goToOrigen(ac)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
