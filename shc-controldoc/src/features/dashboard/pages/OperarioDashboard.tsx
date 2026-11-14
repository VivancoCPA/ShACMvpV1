import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { MisQEsWidget } from '../components/MisQEsWidget'
import { MisACsWidget } from '../components/MisACsWidget'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { AlertaCard } from '../components/layout/AlertaCard'
import { CardSkeleton, WidgetSkeleton } from '../components/layout/Skeletons'
import { clasificarAcsVencidasYPorVencer } from '../utils/alertasDashboard.utils'
import { scrollADestino, useAlertaSeleccionada } from '../hooks/useAlertaSeleccionada'
import { useNotifications } from '../../notifications/hooks/useNotifications'
import { NotificationList } from '../../notifications/components/NotificationList'

// Las dos tarjetas filtran MisACsWidget con el mismo arreglo que cuentan (dashboard-alertas-coherentes D2).
const ALERTAS = {
  acVencidas: { destino: 'mis-acs', etiqueta: 'alertas.operario.acVencidas' },
  acPorVencer: { destino: 'mis-acs', etiqueta: 'alertas.operario.acPorVencer' },
} as const

type AlertaId = keyof typeof ALERTAS

export function OperarioDashboard() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const { data, isLoading } = useDashboardSummary()
  const { data: notifications = [] } = useNotifications()
  const { alerta, alternar, limpiar } = useAlertaSeleccionada()

  const summary = !isLoading && data?.rol === 'OPERARIO' ? data.data : undefined

  const notificacionesOrdenadas = [...notifications].sort((a, b) => {
    if (a.leida !== b.leida) return a.leida ? 1 : -1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const { vencidas, porVencer } = useMemo(
    () => clasificarAcsVencidasYPorVencer(summary?.accionesCorrectivasAsignadas ?? []),
    [summary],
  )
  const filtradas: Record<AlertaId, typeof vencidas> = { acVencidas: vencidas, acPorVencer: porVencer }
  const alertaActiva: AlertaId | null = alerta === 'acVencidas' || alerta === 'acPorVencer' ? alerta : null

  const seleccionarAlerta = (id: AlertaId) => {
    alternar(id)
    scrollADestino(ALERTAS[id].destino)
  }

  const actions = (
    <button
      type="button"
      onClick={() => navigate('/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO')}
      className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
    >
      {t('operario.crearReporte')}
    </button>
  )

  const alertas = summary ? (
    <>
      <AlertaCard
        valor={vencidas.length}
        titulo={t('alertas.operario.acVencidas')}
        subtitulo={t('alertas.verLista')}
        nivel="error"
        activa={alertaActiva === 'acVencidas'}
        onSelect={() => seleccionarAlerta('acVencidas')}
      />
      <AlertaCard
        valor={porVencer.length}
        titulo={t('alertas.operario.acPorVencer')}
        subtitulo={t('alertas.verLista')}
        nivel="warning"
        activa={alertaActiva === 'acPorVencer'}
        onSelect={() => seleccionarAlerta('acPorVencer')}
      />
    </>
  ) : (
    <CardSkeleton count={2} height="h-[68px]" />
  )

  return (
    <PageWrapper title={t('operario.title')} actions={actions}>
      <DashboardLayout
        alertas={alertas}
        trabajoPrincipal={
          <>
            <div id="acciones-requeridas">
              <AccionesRequeridasWidget />
            </div>
            {summary ? (
              <div id="mis-acs">
                {alertaActiva ? (
                  <MisACsWidget
                    accionesCorrectivasAsignadas={filtradas[alertaActiva]}
                    etiquetaFiltro={t(ALERTAS[alertaActiva].etiqueta)}
                    onQuitarFiltro={limpiar}
                  />
                ) : (
                  <MisACsWidget accionesCorrectivasAsignadas={summary.accionesCorrectivasAsignadas} />
                )}
              </div>
            ) : (
              <WidgetSkeleton />
            )}
          </>
        }
        trabajoLateral={
          <>
            {summary ? <MisQEsWidget misQEReportados={summary.misQEReportados} /> : <WidgetSkeleton />}
            <section className="rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
              <h2 className="border-b border-hairline px-6 py-4 text-base font-medium text-ink dark:border-hairline/20 dark:text-on-dark">
                {t('operario.notificacionesPendientes.title')}
              </h2>
              <NotificationList
                notifications={notificacionesOrdenadas}
                emptyMessage={t('operario.notificacionesPendientes.empty')}
              />
            </section>
          </>
        }
      />
    </PageWrapper>
  )
}
