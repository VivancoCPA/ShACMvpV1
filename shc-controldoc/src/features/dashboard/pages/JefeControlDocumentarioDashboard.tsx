import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { AlertaCard } from '../components/layout/AlertaCard'
import { CardSkeleton } from '../components/layout/Skeletons'

// La lista de documentos no filtra por fecha de revisión: las dos alertas enlazan a los
// publicados (dashboard-layout-4-zonas design.md D9).
const DOCUMENTOS_PUBLICADOS = '/documentos?estado=PUBLICADO'

export function JefeControlDocumentarioDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()

  const summary = !isLoading && data?.rol === 'JEFE_CONTROL_DOC' ? data.data : undefined

  const alertas = summary ? (
    <>
      <AlertaCard
        valor={summary.documentosRevisionVencida}
        titulo={t('alertas.jefeControlDoc.revisionVencida')}
        subtitulo={t('alertas.verLista')}
        nivel="error"
        to={DOCUMENTOS_PUBLICADOS}
      />
      <AlertaCard
        valor={summary.documentosRevisionProxima}
        titulo={t('alertas.jefeControlDoc.revisionProxima')}
        subtitulo={t('alertas.verLista')}
        nivel="warning"
        to={DOCUMENTOS_PUBLICADOS}
      />
    </>
  ) : (
    <CardSkeleton count={2} height="h-[68px]" />
  )

  return (
    <PageWrapper title={t('jefeControlDoc.title')}>
      <DashboardLayout
        alertas={alertas}
        trabajoPrincipal={
          <div id="acciones-requeridas">
            <AccionesRequeridasWidget />
          </div>
        }
      />
    </PageWrapper>
  )
}
