import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, ChevronUp, Download, Lock, Upload, Loader2 } from 'lucide-react'
import { useDocumentDetail } from '../hooks/useDocumentDetail'
import { useGetArchivoOriginalUrl } from '../hooks/useDocumentActions'
import { DocumentDetailHeader } from '../components/DocumentDetailHeader'
import { DocumentActionPanel } from '../components/DocumentActionPanel'
import { DocumentHistorial } from '../components/DocumentHistorial'
import { DocumentAuditTrail } from '../components/DocumentAuditTrail'
import { DocumentVersionesTab } from '../components/DocumentVersionesTab'
import { DocumentQEVinculadosList } from '../components/DocumentQEVinculadosList'
import { DocumentNCVinculadasList } from '../components/DocumentNCVinculadasList'
import { DocumentReplaceArchivoOriginalModal } from '../components/DocumentReplaceArchivoOriginalModal'
import { getDocumentPermissions, resolveDocRoleForUser } from '../permissions'
import { useAuthStore } from '../../../stores/authStore'
import { useUserNames } from '../../users/hooks/useUserNames'

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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation('documents')
  const user = useAuthStore((s) => s.user)

  const [descripcionOpen, setDescripcionOpen] = useState(true)
  const [historialOpen, setHistorialOpen] = useState(true)
  const [qeVinculadosOpen, setQeVinculadosOpen] = useState(true)
  const [ncVinculadasOpen, setNcVinculadasOpen] = useState(true)
  const [auditTrailOpen, setAuditTrailOpen] = useState(true)
  const [showReplaceOriginalModal, setShowReplaceOriginalModal] = useState(false)

  const { documento, isLoading, isError } = useDocumentDetail(id)
  const { abrirArchivoOriginal, isLoading: isLoadingOriginal } = useGetArchivoOriginalUrl()

  // Una sola llamada a useUserNames por pantalla (nombres-usuarios-reales D4): el header
  // necesita autor/revisor/aprobador y el action panel necesita aprobador (preview de PDF) —
  // ambos comparten este mismo getName en vez de llamar el hook cada uno por su cuenta.
  const { getName } = useUserNames([documento?.autorId, documento?.revisorId, documento?.aprobadorId])

  const initialAction = searchParams.get('action') === 'iniciar-revision'
    ? ('revision-periodica' as const)
    : undefined

  return (
    <div className="min-h-screen bg-canvas dark:bg-surface-dark">
      {/* Back button */}
      <div className="border-b border-hairline bg-canvas px-6 py-3 dark:border-hairline/20 dark:bg-surface-dark">
        <button
          onClick={() => navigate('/documentos')}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('detail.backToList')}
        </button>
      </div>

      {isLoading && <DetailSkeleton />}

      {isError && !isLoading && (
        <div className="flex items-center justify-center py-24 text-sm text-error">
          {t('errors.loadError')}
        </div>
      )}

      {documento && (() => {
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
        // "Descargar copia (PDF)" (DocumentActionPanel) la reemplaza. Esta sección solo cubre el
        // archivo original.
        const showArchivoSection = perms.canViewArchivoOriginal || isObsoletoHistorico

        return (
          <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
            <DocumentDetailHeader documento={documento} getName={getName} />

            <div className="flex flex-wrap items-center gap-2">
              <DocumentActionPanel documento={documento} initialAction={initialAction} getName={getName} />
            </div>

            {/* Descripción y detalle — collapsible, open by default */}
            <div className="rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
              <button
                type="button"
                onClick={() => setDescripcionOpen((v) => !v)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
                aria-expanded={descripcionOpen}
              >
                <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
                  {t('detail.sections.descripcion')}
                </h2>
                {descripcionOpen ? (
                  <ChevronUp size={16} className="text-muted dark:text-on-dark-soft" />
                ) : (
                  <ChevronDown size={16} className="text-muted dark:text-on-dark-soft" />
                )}
              </button>

              {descripcionOpen && (
                <div className="space-y-4 border-t border-hairline px-6 pb-6 pt-4 text-sm text-body dark:border-hairline/20 dark:text-on-dark">
                  {documento.descripcion ? (
                    <p>{documento.descripcion}</p>
                  ) : (
                    <p className="text-muted dark:text-on-dark-soft">—</p>
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
              )}
            </div>

            {/* Historial de estados — collapsible, open by default */}
            <div className="rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
              <button
                type="button"
                onClick={() => setHistorialOpen((v) => !v)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
                aria-expanded={historialOpen}
              >
                <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
                  {t('detail.sections.historial')}
                </h2>
                {historialOpen ? (
                  <ChevronUp size={16} className="text-muted dark:text-on-dark-soft" />
                ) : (
                  <ChevronDown size={16} className="text-muted dark:text-on-dark-soft" />
                )}
              </button>

              {historialOpen && (
                <div className="border-t border-hairline px-6 pb-6 pt-4 dark:border-hairline/20">
                  <DocumentHistorial documento={documento} />
                </div>
              )}
            </div>

            {/* Versiones — highlighted, always-open card */}
            <div className="rounded-lg border border-l-4 border-hairline border-l-coral bg-surface-card p-6 dark:border-hairline/20 dark:border-l-coral dark:bg-surface-dark-elevated">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
                  {t('detail.sections.versiones')}
                </h2>
                <span className="rounded-[9999px] bg-coral/20 px-2.5 py-0.5 text-xs font-medium text-coral dark:bg-coral/15">
                  {t('versiones.vigente')}
                </span>
              </div>
              <DocumentVersionesTab documento={documento} />
            </div>

            {/* QE vinculados — collapsible, open by default */}
            <div className="rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
              <button
                type="button"
                onClick={() => setQeVinculadosOpen((v) => !v)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
                aria-expanded={qeVinculadosOpen}
              >
                <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
                  {t('detail.sections.qeVinculados')}
                </h2>
                {qeVinculadosOpen ? (
                  <ChevronUp size={16} className="text-muted dark:text-on-dark-soft" />
                ) : (
                  <ChevronDown size={16} className="text-muted dark:text-on-dark-soft" />
                )}
              </button>

              {qeVinculadosOpen && (
                <div className="border-t border-hairline px-6 pb-6 pt-4 dark:border-hairline/20">
                  <DocumentQEVinculadosList documento={documento} canEdit={perms.canEdit} />
                </div>
              )}
            </div>

            {/* NC vinculadas — collapsible, open by default */}
            <div className="rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
              <button
                type="button"
                onClick={() => setNcVinculadasOpen((v) => !v)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
                aria-expanded={ncVinculadasOpen}
              >
                <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
                  {t('detail.sections.ncVinculados')}
                </h2>
                {ncVinculadasOpen ? (
                  <ChevronUp size={16} className="text-muted dark:text-on-dark-soft" />
                ) : (
                  <ChevronDown size={16} className="text-muted dark:text-on-dark-soft" />
                )}
              </button>

              {ncVinculadasOpen && (
                <div className="border-t border-hairline px-6 pb-6 pt-4 dark:border-hairline/20">
                  <DocumentNCVinculadasList documento={documento} canEdit={perms.canEdit} />
                </div>
              )}
            </div>

            {/* Audit trail — collapsible, open by default, last section */}
            <div className="rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
              <button
                type="button"
                onClick={() => setAuditTrailOpen((v) => !v)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
                aria-expanded={auditTrailOpen}
              >
                <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
                  {t('detail.sections.auditTrail')}
                </h2>
                {auditTrailOpen ? (
                  <ChevronUp size={16} className="text-muted dark:text-on-dark-soft" />
                ) : (
                  <ChevronDown size={16} className="text-muted dark:text-on-dark-soft" />
                )}
              </button>

              {auditTrailOpen && (
                <div className="border-t border-hairline px-6 pb-6 pt-4 dark:border-hairline/20">
                  <DocumentAuditTrail documento={documento} />
                </div>
              )}
            </div>

            {showReplaceOriginalModal && (
              <DocumentReplaceArchivoOriginalModal
                documentId={documento.id}
                archivoOriginalNombre={documento.archivoOriginalNombre}
                onClose={() => setShowReplaceOriginalModal(false)}
              />
            )}
          </div>
        )
      })()}
    </div>
  )
}
