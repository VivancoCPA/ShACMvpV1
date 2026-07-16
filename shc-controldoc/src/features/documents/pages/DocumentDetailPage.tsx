import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, ChevronUp, FileText, FileType, Sheet, Download, Lock, Upload, FileDown, Loader2 } from 'lucide-react'
import { useDocumentDetail } from '../hooks/useDocumentDetail'
import { useGetArchivoOriginalUrl, useGetArchivoDistribucionUrl } from '../hooks/useDocumentActions'
import { DocumentDetailHeader } from '../components/DocumentDetailHeader'
import { DocumentActionPanel } from '../components/DocumentActionPanel'
import { DocumentHistorial } from '../components/DocumentHistorial'
import { DocumentAuditTrail } from '../components/DocumentAuditTrail'
import { DocumentVersionesTab } from '../components/DocumentVersionesTab'
import { getDocumentPermissions } from '../permissions'
import { useAuthStore } from '../../../stores/authStore'
import type { DocRole } from '../../../types/documents.types'

function getFileTypeInfo(archivoUrl?: string, tipoArchivo?: string): { icon: JSX.Element; label: string } | null {
  const ext = archivoUrl?.split('.').pop()?.toLowerCase() ?? ''
  const mime = tipoArchivo ?? ''
  if (ext === 'pdf' || mime === 'application/pdf') {
    return { icon: <FileText size={14} aria-hidden="true" />, label: 'PDF' }
  }
  if (ext === 'docx' || ext === 'doc' || mime.includes('wordprocessingml') || mime === 'application/msword') {
    return { icon: <FileType size={14} aria-hidden="true" />, label: 'Word' }
  }
  if (ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheetml') || mime === 'application/vnd.ms-excel') {
    return { icon: <Sheet size={14} aria-hidden="true" />, label: 'Excel' }
  }
  if (!ext && !mime) return null
  return { icon: <FileText size={14} aria-hidden="true" />, label: ext.toUpperCase() || 'Archivo' }
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation('documents')
  const user = useAuthStore((s) => s.user)

  const [descripcionOpen, setDescripcionOpen] = useState(true)
  const [historialOpen, setHistorialOpen] = useState(true)
  const [auditTrailOpen, setAuditTrailOpen] = useState(true)

  const { documento, isLoading, isError } = useDocumentDetail(id)
  const { abrirArchivoOriginal, isLoading: isLoadingOriginal } = useGetArchivoOriginalUrl()
  const { descargarArchivoDistribucion, isLoading: isLoadingDistribucion } = useGetArchivoDistribucionUrl()

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
        // Derive DocRole from authenticated user + document assignment
        let docRole: DocRole = 'OPERARIO'
        if (user) {
          const isJefeCalidad = user.rol === 'JEFE_CALIDAD_SYST' || user.rol === 'JEFE_CONTROL_DOCUMENTARIO'
          const isAutor = documento.autorId === user.id
          const isRevisor = documento.revisorId === user.id
          const isAprobador = documento.aprobadorId === user.id
          if (isAutor) docRole = 'AUTOR'
          else if (isRevisor) docRole = 'REVISOR'
          else if (isAprobador) docRole = 'APROBADOR'
          else if (isJefeCalidad) docRole = 'JEFE_CALIDAD'
        }

        const perms = getDocumentPermissions(documento.estado, docRole, {
          isAssignedAuthor: docRole === 'AUTOR',
          archivoOriginalBloqueado: documento.archivoOriginalBloqueado,
        })

        // CA-34: JEFE_CONTROL_DOCUMENTARIO and ALTA_DIRECCION can see the original
        // of OBSOLETO documents for historical traceability
        const isObsoletoHistorico =
          documento.estado === 'OBSOLETO' &&
          (user?.rol === 'JEFE_CONTROL_DOCUMENTARIO' || user?.rol === 'ALTA_DIRECCION')

        const distUrl = documento.archivoDistribucionUrl
        const showArchivoSection =
          perms.canViewArchivoOriginal || isObsoletoHistorico || perms.canViewArchivoDistribucion

        return (
          <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
            <DocumentDetailHeader documento={documento} />

            <div className="flex flex-wrap items-center gap-2">
              <DocumentActionPanel documento={documento} initialAction={initialAction} />
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
                  {(documento.archivoUrl || documento.tipoArchivo) && (() => {
                    const fileInfo = getFileTypeInfo(documento.archivoUrl, documento.tipoArchivo)
                    if (!fileInfo) return null
                    return (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">
                          {t('archivo.tipo')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded bg-surface-soft px-2 py-0.5 text-xs font-medium text-body dark:bg-surface-dark-elevated dark:text-on-dark">
                          {fileInfo.icon}
                          {fileInfo.label}
                        </span>
                      </div>
                    )
                  })()}

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
                              onClick={() => void abrirArchivoOriginal(documento.id)}
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
                                onClick={() => navigate(`/documents/${documento.id}/edit`)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-cream dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
                              >
                                <Upload size={12} aria-hidden="true" />
                                {t('archivo.original.reemplazar')}
                              </button>
                            )}
                          </div>
                        )}

                        {perms.canViewArchivoDistribucion && distUrl && (
                          <button
                            type="button"
                            onClick={() => void descargarArchivoDistribucion(documento.id)}
                            disabled={isLoadingDistribucion}
                            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-cream disabled:cursor-not-allowed disabled:opacity-60 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
                          >
                            {isLoadingDistribucion
                              ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                              : <FileDown size={12} aria-hidden="true" />}
                            {t('archivo.distribucion.ver')}
                          </button>
                        )}

                        {perms.canViewArchivoDistribucion && !distUrl && (
                          <p className="text-xs text-muted dark:text-on-dark-soft">
                            {t('archivo.distribucion.autoGenerado')}
                          </p>
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
          </div>
        )
      })()}
    </div>
  )
}
