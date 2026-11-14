import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { useDashboardKpis } from '../hooks/useDashboardKpis'
import { usePeriodoKpi } from '../hooks/usePeriodoKpi'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { KpisEjecutivosWidget } from '../components/KpisEjecutivosWidget'
import { ComparativaMensualWidget } from '../components/ComparativaMensualWidget'
import { QEsCriticosWidget } from '../components/QEsCriticosWidget'
import { ReaperturasWidget } from '../components/ReaperturasWidget'
import { ACsExtensionPlazoWidget } from '../components/ACsExtensionPlazoWidget'
import { HeatmapIncidentesWidget } from '../components/HeatmapIncidentesWidget'
import { ExportButton } from '../components/ExportButton'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { AlertaCard } from '../components/layout/AlertaCard'
import { PeriodoSelector } from '../components/layout/PeriodoSelector'
import { CardSkeleton, WidgetSkeleton } from '../components/layout/Skeletons'
import { contarReaperturasEnRango, filtrarSolicitudesGerenciaPendientes } from '../utils/alertasDashboard.utils'
import { scrollADestino, useAlertaSeleccionada } from '../hooks/useAlertaSeleccionada'

const ALERTA_EXTENSIONES = 'extensiones'

export function AltaDireccionDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()
  const { tipo, setTipo, periodo, rango } = usePeriodoKpi()
  const kpisQuery = useDashboardKpis(periodo)
  const { alerta, alternar } = useAlertaSeleccionada()

  const summary = !isLoading && data?.rol === 'ALTA_DIRECCION' ? data.data : undefined

  const reaperturasDelPeriodo = useMemo(
    () => (summary ? contarReaperturasEnRango(summary.reaperturas, rango) : 0),
    [summary, rango],
  )

  // Mismo arreglo para la tarjeta y para ACsExtensionPlazoWidget (dashboard-alertas-coherentes D2).
  const extensiones = useMemo(
    () => filtrarSolicitudesGerenciaPendientes(summary?.acsConSolicitudAjustePlazo ?? []),
    [summary],
  )

  const alertas = summary ? (
    <>
      <AlertaCard
        valor={summary.alertasCriticas.length}
        titulo={t('alertas.altaDireccion.qeCriticos')}
        subtitulo={t('alertas.verLista')}
        nivel="error"
        to="/quality-events?severidad=CRITICA"
      />
      <AlertaCard
        valor={reaperturasDelPeriodo}
        titulo={t('alertas.altaDireccion.reaperturas')}
        subtitulo={t('alertas.verLista')}
        nivel="warning"
        to="/quality-events?soloReincidencias=true"
      />
      <AlertaCard
        valor={extensiones.length}
        titulo={t('alertas.altaDireccion.extensiones')}
        subtitulo={t('alertas.verLista')}
        nivel="warning"
        activa={alerta === ALERTA_EXTENSIONES}
        onSelect={() => {
          alternar(ALERTA_EXTENSIONES)
          scrollADestino('acs-extension-plazo')
        }}
      />
    </>
  ) : (
    <CardSkeleton count={3} height="h-[68px]" />
  )

  const indicadores =
    summary && kpisQuery.data ? (
      <KpisEjecutivosWidget
        resumenQE={summary.resumenPorModulo.qualityEvents}
        kpis={kpisQuery.data}
        tendencias={summary.tendenciaMensualKpis}
      />
    ) : (
      <CardSkeleton count={5} height="h-[118px]" />
    )

  return (
    <PageWrapper title={t('altaDireccion.title')} actions={<ExportButton />}>
      <DashboardLayout
        alertas={alertas}
        indicadores={indicadores}
        periodoSelector={<PeriodoSelector value={tipo} onChange={setTipo} />}
        trabajoPrincipal={
          <>
            <div id="acciones-requeridas">
              <AccionesRequeridasWidget />
            </div>
            {summary ? <ComparativaMensualWidget comparativaMensual={summary.comparativaMensual} /> : <WidgetSkeleton />}
          </>
        }
        trabajoLateral={
          summary ? (
            <>
              <QEsCriticosWidget alertasCriticas={summary.alertasCriticas} />
              <ReaperturasWidget reaperturas={summary.reaperturas} />
              <div id="acs-extension-plazo">
                <ACsExtensionPlazoWidget acs={extensiones} />
              </div>
            </>
          ) : (
            <>
              <WidgetSkeleton />
              <WidgetSkeleton />
            </>
          )
        }
        mapa={summary ? <HeatmapIncidentesWidget /> : null}
      />
    </PageWrapper>
  )
}
