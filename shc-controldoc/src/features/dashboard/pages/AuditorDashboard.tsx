import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { useAccionesRequeridas } from '../hooks/useAccionesRequeridas'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { HallazgosPorNormaWidget } from '../components/HallazgosPorNormaWidget'
import { HallazgosPorEstadoWidget } from '../components/HallazgosPorEstadoWidget'
import { EvidenciasHallazgosWidget } from '../components/EvidenciasHallazgosWidget'
import { TasaCierrePorAreaWidget } from '../components/TasaCierrePorAreaWidget'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { AlertaCard } from '../components/layout/AlertaCard'
import { CardSkeleton, WidgetSkeleton } from '../components/layout/Skeletons'
import { contarHallazgosAbiertos } from '../utils/alertasDashboard.utils'
import { filtrarAccionesPorTipo } from '../utils/accionesRequeridas.utils'
import { scrollADestino, useAlertaSeleccionada } from '../hooks/useAlertaSeleccionada'
import type { AccionRequeridaTipo } from '../types/accionesRequeridas.types'

// Una sola fuente por tarjeta (dashboard-alertas-coherentes D2).
const TIPOS_VERIFICACIONES: readonly AccionRequeridaTipo[] = ['QE_VERIFICAR']
const ALERTA_VERIFICACIONES = 'verificaciones'

export function AuditorDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()
  const { items: acciones } = useAccionesRequeridas()
  const { alerta, alternar, limpiar } = useAlertaSeleccionada()

  const summary = !isLoading && data?.rol === 'AUDITOR' ? data.data : undefined

  // QE_VERIFICAR del Auditor ya viene filtrado por auditorAsignadoId (dashboard-acciones-requeridas).
  const verificaciones = useMemo(() => filtrarAccionesPorTipo(acciones, TIPOS_VERIFICACIONES), [acciones])

  const hallazgosAbiertos = useMemo(
    () => (summary ? contarHallazgosAbiertos(summary.hallazgosPorEstado) : 0),
    [summary],
  )

  const alertas = summary ? (
    <>
      <AlertaCard
        valor={verificaciones.length}
        titulo={t('alertas.auditor.verificaciones')}
        subtitulo={t('alertas.verLista')}
        nivel="warning"
        activa={alerta === ALERTA_VERIFICACIONES}
        onSelect={() => {
          alternar(ALERTA_VERIFICACIONES)
          scrollADestino('acciones-requeridas')
        }}
      />
      <AlertaCard
        valor={hallazgosAbiertos}
        titulo={t('alertas.auditor.hallazgosAbiertos')}
        subtitulo={t('alertas.verLista')}
        nivel="info"
        to="/quality-events?origen=O3_HALLAZGO_AUDITORIA"
      />
    </>
  ) : (
    <CardSkeleton count={2} height="h-[68px]" />
  )

  return (
    <PageWrapper title={t('auditor.title')}>
      <DashboardLayout
        alertas={alertas}
        trabajoPrincipal={
          <>
            <div id="acciones-requeridas">
              {alerta === ALERTA_VERIFICACIONES ? (
                <AccionesRequeridasWidget
                  filtroTipos={TIPOS_VERIFICACIONES}
                  etiquetaFiltro={t('alertas.auditor.verificaciones')}
                  onQuitarFiltro={limpiar}
                />
              ) : (
                <AccionesRequeridasWidget />
              )}
            </div>
            {summary ? <HallazgosPorEstadoWidget hallazgosPorEstado={summary.hallazgosPorEstado} /> : <WidgetSkeleton />}
          </>
        }
        trabajoLateral={
          summary ? (
            <>
              <HallazgosPorNormaWidget hallazgosPorNorma={summary.hallazgosPorNorma} />
              <EvidenciasHallazgosWidget evidenciasHallazgos={summary.evidenciasHallazgos} />
              <TasaCierrePorAreaWidget tasaCierreEnPlazoPorArea={summary.tasaCierreEnPlazoPorArea} />
            </>
          ) : (
            <>
              <WidgetSkeleton />
              <WidgetSkeleton />
              <WidgetSkeleton />
            </>
          )
        }
      />
    </PageWrapper>
  )
}
