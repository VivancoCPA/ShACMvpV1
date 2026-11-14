import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { useAccionesRequeridas } from '../hooks/useAccionesRequeridas'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { PanelPendientesAreaWidget } from '../components/PanelPendientesAreaWidget'
import { QEPorTipoWidget } from '../components/QEPorTipoWidget'
import { ACsVencidasWidget } from '../components/ACsVencidasWidget'
import { IncidentesRecientesWidget } from '../components/IncidentesRecientesWidget'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { AlertaCard } from '../components/layout/AlertaCard'
import { CardSkeleton, WidgetSkeleton } from '../components/layout/Skeletons'
import { contarIncidentesRecientes } from '../utils/alertasDashboard.utils'
import { filtrarAccionesPorTipo } from '../utils/accionesRequeridas.utils'
import { scrollADestino, useAlertaSeleccionada } from '../hooks/useAlertaSeleccionada'
import type { AccionRequeridaTipo } from '../types/accionesRequeridas.types'

// Una sola fuente por tarjeta (dashboard-alertas-coherentes D2).
const TIPOS_FIRMA_CIERRE: readonly AccionRequeridaTipo[] = ['QE_FIRMAR_CIERRE']

const ALERTAS = {
  acVencidas: { destino: 'acs-vencidas' },
  firmaCierre: { destino: 'acciones-requeridas' },
} as const

type AlertaId = keyof typeof ALERTAS

export function SupervisorDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()
  const { items: acciones } = useAccionesRequeridas()
  const { alerta, alternar, limpiar } = useAlertaSeleccionada()

  const summary = !isLoading && data?.rol === 'SUPERVISOR' ? data.data : undefined

  const esperanFirma = useMemo(() => filtrarAccionesPorTipo(acciones, TIPOS_FIRMA_CIERRE), [acciones])

  const seleccionarAlerta = (id: AlertaId) => {
    alternar(id)
    scrollADestino(ALERTAS[id].destino)
  }

  // `incidentesRecientes` llega topado a 10 por el backend, así que este conteo también
  // (dashboard-layout-4-zonas design.md D9).
  const { total: incidentesUltimos7Dias, fechaDesde } = useMemo(
    () => contarIncidentesRecientes(summary?.incidentesRecientes ?? []),
    [summary],
  )

  const alertas = summary ? (
    <>
      <AlertaCard
        valor={summary.accionesCorrectivasVencidas.length}
        titulo={t('alertas.supervisor.acVencidas')}
        subtitulo={t('alertas.verLista')}
        nivel="error"
        activa={alerta === 'acVencidas'}
        onSelect={() => seleccionarAlerta('acVencidas')}
      />
      <AlertaCard
        valor={esperanFirma.length}
        titulo={t('alertas.supervisor.firmaCierre')}
        subtitulo={t('alertas.verLista')}
        nivel="warning"
        activa={alerta === 'firmaCierre'}
        onSelect={() => seleccionarAlerta('firmaCierre')}
      />
      <AlertaCard
        valor={incidentesUltimos7Dias}
        titulo={t('alertas.supervisor.incidentesRecientes')}
        subtitulo={t('alertas.verLista')}
        nivel="info"
        to={`/incidents?fechaDesde=${fechaDesde}`}
      />
    </>
  ) : (
    <CardSkeleton count={3} height="h-[68px]" />
  )

  return (
    <PageWrapper title={t('supervisor.title')}>
      <DashboardLayout
        alertas={alertas}
        trabajoPrincipal={
          <>
            <div id="acciones-requeridas">
              {alerta === 'firmaCierre' ? (
                <AccionesRequeridasWidget
                  filtroTipos={TIPOS_FIRMA_CIERRE}
                  etiquetaFiltro={t('alertas.supervisor.firmaCierre')}
                  onQuitarFiltro={limpiar}
                />
              ) : (
                <AccionesRequeridasWidget />
              )}
            </div>
            {summary ? (
              <PanelPendientesAreaWidget
                qesEnVerificacionArea={summary.qesEnVerificacionArea}
                accionesCorrectivasPendientesArea={summary.accionesCorrectivasPendientesArea}
              />
            ) : (
              <WidgetSkeleton />
            )}
          </>
        }
        trabajoLateral={
          summary ? (
            <>
              <div id="acs-vencidas">
                <ACsVencidasWidget accionesCorrectivasVencidas={summary.accionesCorrectivasVencidas} />
              </div>
              <IncidentesRecientesWidget incidentesRecientes={summary.incidentesRecientes} />
              <QEPorTipoWidget qeAbiertosPorTipo={summary.qeAbiertosPorTipo} />
            </>
          ) : (
            <>
              <WidgetSkeleton />
              <WidgetSkeleton />
            </>
          )
        }
      />
    </PageWrapper>
  )
}
