import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { useDashboardKpis } from '../hooks/useDashboardKpis'
import { usePeriodoKpi } from '../hooks/usePeriodoKpi'
import { useAccionesRequeridas } from '../hooks/useAccionesRequeridas'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { KpiGridWidget } from '../components/KpiGridWidget'
import { QEPorEstadoWidget } from '../components/QEPorEstadoWidget'
import { ACsVencidasPorVencerWidget, type PestanaAcs } from '../components/ACsVencidasPorVencerWidget'
import { IncidentesSinQeVencidosWidget } from '../components/IncidentesSinQeVencidosWidget'
import { TendenciaMensualWidget } from '../components/TendenciaMensualWidget'
import { HeatmapIncidentesWidget } from '../components/HeatmapIncidentesWidget'
import { ExportButton } from '../components/ExportButton'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { AlertaCard } from '../components/layout/AlertaCard'
import { PeriodoSelector } from '../components/layout/PeriodoSelector'
import { CardSkeleton, WidgetSkeleton } from '../components/layout/Skeletons'
import { KPI_IDS_JEFE_CALIDAD } from '../utils/kpiRing.utils'
import { filtrarAccionesPorTipo } from '../utils/accionesRequeridas.utils'
import { filtrarAcsNoVencidas } from '../utils/alertasDashboard.utils'
import { scrollADestino, useAlertaSeleccionada } from '../hooks/useAlertaSeleccionada'
import type { AccionRequeridaTipo } from '../types/accionesRequeridas.types'

// Una sola fuente por tarjeta (dashboard-alertas-coherentes D2): el número y la lista filtrada
// salen de la misma función sobre el mismo arreglo. D3: si "ambos" significaba otra cosa, basta
// con quitar QE_REGISTRAR_CIERRE de `aprobaciones`.
// AC_VERIFICAR: AC ejecutadas que esperan la verificación del JCA (ac-ejecucion-verificacion-evidencias).
const TIPOS_APROBACIONES: readonly AccionRequeridaTipo[] = [
  'QE_APROBAR_CAUSA_RAIZ',
  'QE_FIRMAR_CIERRE_JCA',
  'QE_REGISTRAR_CIERRE',
  'AC_VERIFICAR',
]

const ALERTAS = {
  aprobaciones: { destino: 'acciones-requeridas' },
  acVencidas: { destino: 'acs-vencidas-por-vencer' },
  acPorVencer: { destino: 'acs-vencidas-por-vencer' },
  incidentesSinQe: { destino: 'incidentes-sin-qe' },
} as const

type AlertaId = keyof typeof ALERTAS

export function JefeCalidadDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()
  const { tipo, setTipo, periodo } = usePeriodoKpi()
  const kpisQuery = useDashboardKpis(periodo)
  const { items: acciones } = useAccionesRequeridas()
  const { alerta, alternar, seleccionar, limpiar } = useAlertaSeleccionada()

  const summary = !isLoading && data?.rol === 'JEFE_CALIDAD' ? data.data : undefined

  const aprobaciones = useMemo(() => filtrarAccionesPorTipo(acciones, TIPOS_APROBACIONES), [acciones])
  const acsVencidas = summary?.accionesCorrectivasVencidas ?? []
  const acsPorVencer = useMemo(() => filtrarAcsNoVencidas(summary?.accionesCorrectivasPorVencer ?? []), [summary])

  const pestanaAcs: PestanaAcs =
    alerta === 'acVencidas' ? 'vencidas' : alerta === 'acPorVencer' ? 'porVencer' : acsVencidas.length > 0 ? 'vencidas' : 'porVencer'

  const seleccionarAlerta = (id: AlertaId) => {
    alternar(id)
    scrollADestino(ALERTAS[id].destino)
  }

  const alertas = summary ? (
    <>
      <AlertaCard
        valor={acsVencidas.length}
        titulo={t('alertas.jefeCalidad.acVencidas')}
        subtitulo={t('alertas.verLista')}
        nivel="error"
        activa={alerta === 'acVencidas'}
        onSelect={() => seleccionarAlerta('acVencidas')}
      />
      <AlertaCard
        valor={summary.incidentesSinQeVencidosTotal}
        titulo={t('alertas.jefeCalidad.incidentesSinQe')}
        subtitulo={t('alertas.verLista')}
        nivel="error"
        activa={alerta === 'incidentesSinQe'}
        onSelect={() => seleccionarAlerta('incidentesSinQe')}
      />
      <AlertaCard
        valor={aprobaciones.length}
        titulo={t('alertas.jefeCalidad.aprobaciones')}
        subtitulo={t('alertas.verLista')}
        nivel="warning"
        activa={alerta === 'aprobaciones'}
        onSelect={() => seleccionarAlerta('aprobaciones')}
      />
      <AlertaCard
        valor={summary.qeCriticosAbiertos.length}
        titulo={t('alertas.jefeCalidad.qeCriticos')}
        subtitulo={t('alertas.verLista')}
        nivel="info"
        to="/quality-events?severidad=CRITICA"
      />
    </>
  ) : (
    <CardSkeleton count={4} height="h-[68px]" />
  )

  const indicadores = kpisQuery.data ? (
    <KpiGridWidget kpis={kpisQuery.data} kpiIds={KPI_IDS_JEFE_CALIDAD} tendencias={summary?.tendenciaMensualKpis} />
  ) : (
    <CardSkeleton count={KPI_IDS_JEFE_CALIDAD.length} height="h-[118px]" />
  )

  return (
    <PageWrapper title={t('jefeCalidad.title')} actions={<ExportButton />}>
      <DashboardLayout
        alertas={alertas}
        indicadores={indicadores}
        periodoSelector={<PeriodoSelector value={tipo} onChange={setTipo} />}
        trabajoPrincipal={
          <>
            <div id="acciones-requeridas">
              {alerta === 'aprobaciones' ? (
                <AccionesRequeridasWidget
                  filtroTipos={TIPOS_APROBACIONES}
                  etiquetaFiltro={t('alertas.jefeCalidad.aprobaciones')}
                  onQuitarFiltro={limpiar}
                />
              ) : (
                <AccionesRequeridasWidget />
              )}
            </div>
            {summary ? (
              <TendenciaMensualWidget
                tendenciaMensualVolumen={summary.tendenciaMensualVolumen}
                tendenciaMensualKpis={summary.tendenciaMensualKpis}
              />
            ) : (
              <WidgetSkeleton />
            )}
          </>
        }
        trabajoLateral={
          summary ? (
            <>
              <QEPorEstadoWidget qePorEstado={summary.qePorEstado} />
              <div id="acs-vencidas-por-vencer">
                <ACsVencidasPorVencerWidget
                  vencidas={acsVencidas}
                  porVencer={acsPorVencer}
                  pestana={pestanaAcs}
                  onCambiarPestana={(p) => seleccionar(p === 'vencidas' ? 'acVencidas' : 'acPorVencer')}
                />
              </div>
              <div id="incidentes-sin-qe">
                <IncidentesSinQeVencidosWidget
                  incidentesSinQeVencidos={summary.incidentesSinQeVencidos}
                  incidentesSinQeVencidosTotal={summary.incidentesSinQeVencidosTotal}
                />
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
