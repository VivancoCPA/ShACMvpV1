import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, Lock, Upload, Loader2 } from 'lucide-react'
import { useDocumentDetail } from '../hooks/useDocumentDetail'
import { useGetArchivoOriginalUrl } from '../hooks/useDocumentActions'
import { useDocumentActionsAvailability } from '../hooks/useDocumentActionsAvailability'
import { useDocumentActionsController } from '../hooks/useDocumentActionsController'
import { useDocumentVersiones } from '../hooks/useDocumentVersiones'
import { DocumentDetailHeader } from '../components/DocumentDetailHeader'
import { DocumentDetailBanners } from '../components/DocumentDetailBanners'
import { DocumentDetailSidebar } from '../components/DocumentDetailSidebar'
import { DocumentActionModals } from '../components/DocumentActionModals'
import { DocumentHistorial, getHistorialEntries } from '../components/DocumentHistorial'
import { DocumentAuditTrail } from '../components/DocumentAuditTrail'
import { DocumentVersionesTab } from '../components/DocumentVersionesTab'
import { DocumentQEVinculadosList } from '../components/DocumentQEVinculadosList'
import { DocumentNCVinculadasList } from '../components/DocumentNCVinculadasList'
import { DocumentReplaceArchivoOriginalModal } from '../components/DocumentReplaceArchivoOriginalModal'
import { DocumentPublicadoCard } from '../components/DocumentPublicadoCard'
import { Tabs } from '../../../components/ui/Tabs'
import type { TabItem } from '../../../components/ui/Tabs'
import { getDocumentPermissions, resolveDocRoleForUser } from '../permissions'
import { useAuthStore } from '../../../stores/authStore'
import { useUserNames } from '../../users/hooks/useUserNames'
import { formatCalendarDateMedium } from '../../../utils/date.utils'
import type { User } from '../../../types/auth.types'
import type { Documento } from '../../../types/documents.types'

// detalle-documento-dos-columnas (design.md, hallazgo de contexto): `copias-controladas` no
// existe todavía en el repo (ni change activo ni archivado, ni spec) — la pestaña "Copias" queda
// detrás de este flag hasta que ese change la implemente de verdad. Apagarlo/prenderlo no debe
// requerir tocar la lógica de la lista de pestañas, solo este valor.
const DOCUMENT_DETAIL_COPIAS_TAB_ENABLED = false

const VALID_TAB_IDS = ['resumen', 'historial', 'versiones', 'vinculos', 'copias', 'log'] as const
type TabId = (typeof VALID_TAB_IDS)[number]

function isValidTabId(value: string | null): value is TabId {
  if (!value) return false
  if (value === 'copias') return DOCUMENT_DETAIL_COPIAS_TAB_ENABLED
  return (VALID_TAB_IDS as readonly string[]).includes(value)
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-8">
      <div className="h-6 w-1/3 rounded-lg bg-surface-soft dark:bg-surface-dark-soft" />
      <div className="h-8 w-2/3 rounded-lg bg-surface-soft dark:bg-surface-dark-soft" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-surface-soft dark:bg-surface-dark-soft" />
        ))}
      </div>
    </div>
  )
}

export function DocumentDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation('documents')
  const user = useAuthStore((s) => s.user)

  const [showReplaceOriginalModal, setShowReplaceOriginalModal] = useState(false)

  const { documento, isLoading, isError } = useDocumentDetail(id)
  const { abrirArchivoOriginal, isLoading: isLoadingOriginal } = useGetArchivoOriginalUrl()

  // Una sola llamada a useUserNames por pantalla (nombres-usuarios-reales D4): el header
  // necesita autor/revisor/aprobador y el action panel necesita aprobador (preview de PDF) —
  // ambos comparten este mismo getName/getUser en vez de llamar el hook cada uno por su cuenta.
  const { getName, getUser } = useUserNames([documento?.autorId, documento?.revisorId, documento?.aprobadorId])

  const initialAction = searchParams.get('action') === 'iniciar-revision'
    ? ('revision-periodica' as const)
    : undefined

  const rawTab = searchParams.get('tab')
  const activeTab: TabId = isValidTabId(rawTab) ? rawTab : 'resumen'

  function setActiveTab(nextTab: string) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-surface-dark">
      {isLoading && <DetailSkeleton />}

      {isError && !isLoading && (
        <div className="flex items-center justify-center py-24 text-sm text-error">
          {t('errors.loadError')}
        </div>
      )}

      {documento && (
        <DocumentDetailPageBody
          documento={documento}
          user={user}
          getName={getName}
          getUser={getUser}
          initialAction={initialAction}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showReplaceOriginalModal={showReplaceOriginalModal}
          setShowReplaceOriginalModal={setShowReplaceOriginalModal}
          abrirArchivoOriginal={abrirArchivoOriginal}
          isLoadingOriginal={isLoadingOriginal}
        />
      )}
    </div>
  )
}

// Separado de DocumentDetailPage simplemente para no mezclar el estado de carga/error con el
// cuerpo real de la página — `documento` llega ya resuelto (no-undefined) a todos los hooks que
// lo necesitan, sin optional-chaining en cada uno.
interface DocumentDetailPageBodyProps {
  documento: Documento
  user: User | null
  getName: (id?: string | null) => string
  getUser: (id?: string | null) => { nombre: string; apellido: string; avatarUrl?: string } | undefined
  initialAction?: 'revision-periodica'
  activeTab: TabId
  onTabChange: (id: string) => void
  showReplaceOriginalModal: boolean
  setShowReplaceOriginalModal: (v: boolean) => void
  abrirArchivoOriginal: (id: string, nombre?: string) => void
  isLoadingOriginal: boolean
}

function DocumentDetailPageBody({
  documento,
  user,
  getName,
  getUser,
  initialAction,
  activeTab,
  onTabChange,
  showReplaceOriginalModal,
  setShowReplaceOriginalModal,
  abrirArchivoOriginal,
  isLoadingOriginal,
}: DocumentDetailPageBodyProps) {
  const { t, i18n } = useTranslation('documents')
  // Comparte query key con DocumentVersionesTab (useDocumentVersiones) — no es una llamada de
  // red adicional, solo lectura del mismo cache de TanStack Query para el contador de la pestaña.
  const { data: versionesData } = useDocumentVersiones(documento.codigo)

  const availability = useDocumentActionsAvailability(documento)
  const controller = useDocumentActionsController(documento, initialAction)

  const docRole = resolveDocRoleForUser(documento, user)
  const perms = getDocumentPermissions(documento.estado, docRole, {
    isAssignedAuthor: docRole === 'AUTOR',
    archivoOriginalBloqueado: documento.archivoOriginalBloqueado,
  })

  // CA-34: JEFE_CONTROL_DOCUMENTARIO and ALTA_DIRECCION can see the original
  // of OBSOLETO documents for historical traceability
  const isObsoletoHistorico =
    documento.estado === 'OBSOLETO' &&
    (user?.rol === 'JEFE_CONTROL_DOCUMENTARIO' || user?.rol === 'ALTA_DIRECCION')

  // proteccion-documental (design.md D1) — la descarga de la distribución ya no vive aquí:
  // "Descargar copia (PDF)" (sidebar) la reemplaza. Esta sección solo cubre el archivo original.
  const showArchivoSection = perms.canViewArchivoOriginal || isObsoletoHistorico

  const historialCount = getHistorialEntries(documento).length
  const versionesCount = versionesData?.items.length ?? 0
  const vinculosCount = documento.qeVinculados.length + documento.ncVinculados.length
  const logCount = documento.auditTrail.length

  const tabs: TabItem[] = [
    {
      id: 'resumen',
      label: t('detail.tabs.resumen'),
      panel: (
        <div className="space-y-4 p-6">
          {documento.descripcion ? (
            <p className="text-sm text-body dark:text-on-dark">{documento.descripcion}</p>
          ) : (
            <p className="text-sm text-muted dark:text-on-dark-soft">{t('detail.sinDescripcion')}</p>
          )}

          <DocumentPublicadoCard
            documento={documento}
            availability={availability}
            controller={controller}
            getName={getName}
          />

          {documento.motivoVersion && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted dark:text-on-dark-soft">
                {t('detail.motivoCambio', { version: documento.version })}
              </h4>
              <p className="text-sm text-body dark:text-on-dark">{documento.motivoVersion}</p>
            </div>
          )}

          {(documento.estado === 'PUBLICADO' || documento.estado === 'EN_REVISION_PERIODICA') &&
            documento.fechaVigencia && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted dark:text-on-dark-soft">
                  {t('detail.vigenteDesde')}
                </h4>
                <p className="text-sm text-body dark:text-on-dark">
                  {formatCalendarDateMedium(documento.fechaVigencia, i18n.language)}
                </p>
              </div>
            )}

          {showArchivoSection && (
            <div className="rounded-lg border border-hairline bg-surface-soft p-4 dark:border-hairline/20 dark:bg-surface-dark-elevated">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-on-dark-soft">
                {t('archivo.seccion')}
              </h4>
              <div className="flex flex-col gap-2">
                {(perms.canViewArchivoOriginal || isObsoletoHistorico) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void abrirArchivoOriginal(documento.id, documento.archivoOriginalNombre ?? undefined)}
                      disabled={isLoadingOriginal}
                      className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-cream disabled:cursor-not-allowed disabled:opacity-60 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
                    >
                      {isLoadingOriginal
                        ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                        : <Download size={12} aria-hidden="true" />}
                      {t('archivo.original.descargar')}
                    </button>

                    {documento.archivoOriginalBloqueado && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning dark:bg-warning/20">
                        <Lock size={10} aria-hidden="true" />
                        {t('archivo.original.congelado')}
                      </span>
                    )}

                    {perms.canReplaceArchivoOriginal && (
                      <button
                        type="button"
                        onClick={() => setShowReplaceOriginalModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-cream dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
                      >
                        <Upload size={12} aria-hidden="true" />
                        {t('archivo.original.reemplazar')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'historial',
      label: t('detail.tabs.historial'),
      count: historialCount,
      panel: (
        <div className="p-6">
          <DocumentHistorial documento={documento} />
        </div>
      ),
    },
    {
      id: 'versiones',
      label: t('detail.tabs.versiones'),
      count: versionesCount,
      panel: (
        <div className="p-6">
          <DocumentVersionesTab documento={documento} />
        </div>
      ),
    },
    {
      id: 'vinculos',
      label: t('detail.tabs.vinculos'),
      count: vinculosCount,
      panel: (
        <div className="space-y-6 p-6">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-on-dark-soft">
              {t('detail.vinculos.qeTitulo')}
            </h3>
            <DocumentQEVinculadosList documento={documento} canEdit={perms.canEdit} />
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-on-dark-soft">
              {t('detail.vinculos.ncTitulo')}
            </h3>
            <DocumentNCVinculadasList documento={documento} canEdit={perms.canEdit} />
          </div>
        </div>
      ),
    },
    ...(DOCUMENT_DETAIL_COPIAS_TAB_ENABLED
      ? [{
          id: 'copias',
          label: t('detail.tabs.copias'),
          count: 0,
          panel: (
            <div className="p-6 text-sm text-muted dark:text-on-dark-soft">
              {t('detail.copias.placeholder')}
            </div>
          ),
        } satisfies TabItem]
      : []),
    {
      id: 'log',
      label: t('detail.tabs.log'),
      count: logCount,
      panel: (
        <div className="p-6">
          <DocumentAuditTrail documento={documento} />
        </div>
      ),
    },
  ]

  return (
    <>
      <DocumentDetailHeader documento={documento} availability={availability} controller={controller} />

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:px-8">
        <DocumentDetailBanners documento={documento} />

        {/* Orden en el DOM: contenido (pestañas) antes que la sidebar — igual que el mockup de
            referencia (D1 corregido en design.md: el boceto usa `order` de CSS para subir la
            sidebar en mobile/tablet, no el orden natural del DOM que proponía la primera versión
            de este documento). La sidebar lleva `order-first` por debajo de `xl` y vuelve al
            orden natural (segunda columna) desde `xl`. */}
        <section className="min-w-0 overflow-hidden rounded-lg border border-hairline bg-white dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <Tabs tabs={tabs} activeId={activeTab} onChange={onTabChange} idPrefix="document-detail" />
        </section>

        <div className="order-first xl:order-none">
          <DocumentDetailSidebar
            documento={documento}
            availability={availability}
            controller={controller}
            getName={getName}
            getUser={getUser}
            onVerLog={() => onTabChange('log')}
          />
        </div>
      </div>

      <DocumentActionModals documento={documento} controller={controller} getName={getName} />

      {showReplaceOriginalModal && (
        <DocumentReplaceArchivoOriginalModal
          documentId={documento.id}
          tipo={documento.tipo}
          archivoOriginalNombre={documento.archivoOriginalNombre}
          onClose={() => setShowReplaceOriginalModal(false)}
        />
      )}
    </>
  )
}
