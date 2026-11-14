import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SemaforoRow } from '../../../components/shared/SemaforoRow'
import { calcularEstadoSemaforoDesdeFecha } from '../utils/semaforoPendientes'
import type { AccionCorrectivaResumen } from '../types/dashboardSummary.types'

const ORIGEN_ROUTE: Record<AccionCorrectivaResumen['origenTipo'], string> = {
  QE: '/quality-events',
  NC: '/nonconformities',
  INCIDENTE: '/incidents',
}

export type PestanaAcs = 'vencidas' | 'porVencer'

const PESTANAS: PestanaAcs[] = ['vencidas', 'porVencer']

interface ACsVencidasPorVencerWidgetProps {
  vencidas: AccionCorrectivaResumen[]
  porVencer: AccionCorrectivaResumen[]
  pestana: PestanaAcs
  onCambiarPestana: (pestana: PestanaAcs) => void
}

// Bloque lateral de AC del JCA (dashboard-alertas-coherentes D4/D6). Cada contador es el largo del
// mismo arreglo que se renderiza en su pestaña; "Vencidas" es la lista que cuenta KPI-08.
export function ACsVencidasPorVencerWidget({ vencidas, porVencer, pestana, onCambiarPestana }: ACsVencidasPorVencerWidgetProps) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const listas: Record<PestanaAcs, AccionCorrectivaResumen[]> = { vencidas, porVencer }
  const filas = listas[pestana]

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">{t('acs.title')}</h2>
      <div role="tablist" aria-label={t('acs.tablist')} className="flex gap-1 rounded-md bg-surface-soft p-1 dark:bg-surface-dark-soft">
        {PESTANAS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            id={`acs-tab-${p}`}
            aria-selected={pestana === p}
            aria-controls="acs-tabpanel"
            onClick={() => onCambiarPestana(p)}
            className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
              pestana === p
                ? 'bg-canvas text-ink shadow-sm dark:bg-surface-dark-elevated dark:text-on-dark'
                : 'text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark'
            }`}
          >
            {t(`acs.tabs.${p}`, { n: listas[p].length })}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="acs-tabpanel"
        aria-labelledby={`acs-tab-${pestana}`}
        className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20"
      >
        {filas.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">{t(`acs.empty.${pestana}`)}</p>
        ) : (
          <div className="space-y-2 p-3">
            {filas.map((ac) => {
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
