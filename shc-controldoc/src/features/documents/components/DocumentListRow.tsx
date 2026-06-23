import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, ChevronDown, RotateCcw } from 'lucide-react'
import { getDocumentPermissions } from '../permissions'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { RevisionSemaforo } from './RevisionSemaforo'
import { Tooltip } from '../../../components/ui/Tooltip'
import { deleteDocument, restaurarDocumento } from '../../../api/endpoints/documents.api'
import { QUERY_KEYS } from '../constants'
import type { Documento, DocRole } from '../../../types/documents.types'
import type { UserRole } from '../../../types/auth.types'

interface DocumentListRowProps {
  documento: Documento
  userRole: UserRole
  index: number
  onClick: () => void
  hasVersions?: boolean
  isExpanded?: boolean
  onToggle?: () => void
}

const READ_ONLY_ROLES: Set<UserRole> = new Set(['AUDITOR_INTERNO', 'ALTA_DIRECCION'])

function userRoleToDocRole(role: UserRole): DocRole {
  switch (role) {
    case 'JEFE_CALIDAD_SYST':
    case 'JEFE_CONTROL_DOCUMENTARIO':
      return 'JEFE_CALIDAD'
    case 'SUPERVISOR':
      return 'REVISOR'
    case 'OPERARIO':
      return 'OPERARIO'
    case 'AUDITOR_INTERNO':
    case 'ALTA_DIRECCION':
      return 'OPERARIO'
  }
}

export function DocumentListRow({
  documento,
  userRole,
  index,
  onClick,
  hasVersions = false,
  isExpanded = false,
  onToggle,
}: DocumentListRowProps) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [confirmingRestore, setConfirmingRestore] = useState(false)

  const isDeleted = !!documento.deletedAt
  const isReadOnly = READ_ONLY_ROLES.has(userRole)
  const docRole = userRoleToDocRole(userRole)
  const perms = isDeleted || isReadOnly
    ? { canEdit: false, canDelete: false, canStartReview: false }
    : getDocumentPermissions(documento.estado, docRole)

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(documento.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('actions.delete.toast.success'))
      setConfirming(false)
    },
    onError: () => {
      toast.error(t('actions.delete.toast.error'))
      setConfirming(false)
    },
  })

  const restaurarMutation = useMutation({
    mutationFn: () => restaurarDocumento(documento.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('deleted.restore.toast.success'))
      setConfirmingRestore(false)
    },
    onError: () => {
      toast.error(t('deleted.restore.toast.error'))
      setConfirmingRestore(false)
    },
  })

  const rowBg = isDeleted
    ? 'bg-error/8 dark:bg-error/10'
    : index % 2 === 0
      ? 'bg-canvas dark:bg-surface-dark'
      : 'bg-hairline/30 dark:bg-surface-dark-elevated/30'

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-b border-hairline hover:bg-coral/5 dark:border-hairline/20 dark:hover:bg-coral/10 ${rowBg}`}
    >
      <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-ink dark:text-on-dark">
        <span className="flex items-center gap-1.5">
          {hasVersions ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle?.() }}
              aria-label={isExpanded ? t('versiones.colapsar') : t('versiones.expandir')}
              aria-expanded={isExpanded}
              className="flex-shrink-0 rounded-sm text-muted transition-colors hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
            >
              {isExpanded
                ? <ChevronDown size={14} aria-hidden="true" />
                : <ChevronRight size={14} aria-hidden="true" />}
            </button>
          ) : (
            <span className="w-[14px] flex-shrink-0" aria-hidden="true" />
          )}
          {documento.codigo}
          {documento.qeVinculados.length > 0 && (
            <span
              aria-label={t('list.actions.qeActivo')}
              title={t('list.actions.qeActivo')}
              className="text-warning"
            >
              ⚠
            </span>
          )}
        </span>
      </td>

      <td className="px-4 py-3 text-sm text-ink dark:text-on-dark">
        <span className="line-clamp-2 max-w-xs">{documento.titulo}</span>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted dark:text-on-dark-soft">
        {documento.tipo}
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted dark:text-on-dark-soft">
        {documento.version}
      </td>

      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={documento.estado} />
          {isDeleted && (
            <span className="rounded-full bg-error/15 px-2 py-0.5 text-xs font-medium text-error dark:bg-error/20 dark:text-error">
              {t('deleted.badge')}
            </span>
          )}
        </div>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted dark:text-on-dark-soft">
        {documento.area}
      </td>

      <td className="whitespace-nowrap px-4 py-3">
        <RevisionSemaforo fechaRevisionProxima={documento.fechaRevisionProxima} />
      </td>

      <td
        className="whitespace-nowrap px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {/* Restore action — only for deleted docs */}
          {isDeleted && (
            confirmingRestore ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-body dark:text-on-dark">
                  {t('deleted.restore.confirm.title')}
                </span>
                <button
                  type="button"
                  aria-label={t('deleted.restore.confirm.cancel')}
                  onClick={() => setConfirmingRestore(false)}
                  disabled={restaurarMutation.isPending}
                  className="rounded-sm px-1.5 py-0.5 text-xs text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
                >
                  {t('deleted.restore.confirm.cancel')}
                </button>
                <button
                  type="button"
                  aria-label={t('deleted.restore.confirm.confirm')}
                  onClick={() => restaurarMutation.mutate()}
                  disabled={restaurarMutation.isPending}
                  className="rounded-sm px-1.5 py-0.5 text-xs font-medium text-teal hover:text-teal/80 disabled:opacity-50 dark:text-teal"
                >
                  {t('deleted.restore.confirm.confirm')}
                </button>
              </div>
            ) : (
              <Tooltip content={t('deleted.restore.tooltip')}>
                <button
                  type="button"
                  aria-label={t('deleted.restore.tooltip')}
                  onClick={() => setConfirmingRestore(true)}
                  className="rounded-sm p-1 text-muted transition-colors hover:text-teal dark:text-on-dark-soft dark:hover:text-teal"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                </button>
              </Tooltip>
            )
          )}

          {/* Normal actions — only for non-deleted docs */}
          {!isDeleted && perms.canEdit && documento.estado === 'BORRADOR' && (
            <Tooltip content={t('list.actions.tooltips.editar')}>
              <button
                type="button"
                aria-label={t('list.actions.editar')}
                onClick={() => navigate(`/documents/${documento.id}/edit`)}
                className="rounded-sm p-1 text-muted transition-colors hover:text-coral dark:text-on-dark-soft dark:hover:text-coral"
              >
                ✏
              </button>
            </Tooltip>
          )}
          {!isDeleted && perms.canStartReview && (
            <Tooltip content={t('list.actions.tooltips.iniciarRevision')}>
              <button
                type="button"
                aria-label={t('list.actions.iniciarRevision')}
                onClick={() => navigate(`/documentos/${documento.id}?action=iniciar-revision`)}
                className="rounded-sm p-1 text-muted transition-colors hover:text-teal dark:text-on-dark-soft dark:hover:text-teal"
              >
                ↻
              </button>
            </Tooltip>
          )}
          {!isDeleted && perms.canDelete && (
            confirming ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-error dark:text-error">
                  {t('actions.delete.confirm.title')}
                </span>
                <button
                  type="button"
                  aria-label={t('actions.delete.confirm.cancel')}
                  onClick={() => setConfirming(false)}
                  disabled={deleteMutation.isPending}
                  className="rounded-sm px-1.5 py-0.5 text-xs text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
                >
                  {t('actions.delete.confirm.cancel')}
                </button>
                <button
                  type="button"
                  aria-label={t('actions.delete.confirm.confirm')}
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="rounded-sm px-1.5 py-0.5 text-xs font-medium text-error hover:text-error/80 disabled:opacity-50 dark:text-error"
                >
                  {t('actions.delete.confirm.confirm')}
                </button>
              </div>
            ) : (
              <Tooltip content={t('list.actions.tooltips.eliminar')}>
                <button
                  type="button"
                  aria-label={t('list.actions.eliminar')}
                  onClick={() => setConfirming(true)}
                  className="rounded-sm p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
                >
                  ✕
                </button>
              </Tooltip>
            )
          )}
        </div>
      </td>
    </tr>
  )
}
