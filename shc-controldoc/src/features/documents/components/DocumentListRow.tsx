import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronDown, RotateCcw } from 'lucide-react'
import { TABLE_ROW_CLASS } from '../../../constants/ui.constants'
import { getDocumentPermissions } from '../permissions'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { RevisionSemaforo } from './RevisionSemaforo'
import { Tooltip } from '../../../components/ui/Tooltip'
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
  isPending?: boolean
  onDeleteClick?: (doc: Documento) => void
  onRestoreClick?: (doc: Documento) => void
}

const READ_ONLY_ROLES: Set<UserRole> = new Set(['AUDITOR_INTERNO', 'ALTA_DIRECCION', 'ADMINISTRADOR_SISTEMA'])

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
    case 'ADMINISTRADOR_SISTEMA':
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
  isPending = false,
  onDeleteClick,
  onRestoreClick,
}: DocumentListRowProps) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()

  const isDeleted = !!documento.deletedAt
  const isReadOnly = READ_ONLY_ROLES.has(userRole)
  const docRole = userRoleToDocRole(userRole)
  const perms = isDeleted || isReadOnly
    ? { canEdit: false, canDelete: false, canStartReview: false }
    : getDocumentPermissions(documento.estado, docRole)

  const rowBg = index % 2 === 0
    ? 'bg-canvas dark:bg-surface-dark'
    : 'bg-hairline/30 dark:bg-surface-dark-elevated/30'

  const pendingBorder = isPending
    ? 'border-l-2 border-l-amber dark:border-l-amber'
    : 'border-l-2 border-l-transparent'

  return (
    <tr
      onClick={onClick}
      className={`${TABLE_ROW_CLASS} border-b border-hairline dark:border-hairline/20 ${rowBg} ${pendingBorder} ${isDeleted ? 'opacity-50 cursor-default' : ''}`}
    >
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-ink dark:text-on-dark">
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
          <span className={isDeleted ? 'line-through' : ''}>{documento.codigo}</span>
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

      <td className={`max-w-[200px] truncate px-4 py-3 text-xs text-ink dark:text-on-dark ${isDeleted ? 'line-through' : ''}`} title={documento.titulo}>
        {documento.titulo}
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted dark:text-on-dark-soft">
        {documento.tipo}
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted dark:text-on-dark-soft">
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

      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted dark:text-on-dark-soft">
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
            <Tooltip content={t('deleted.restore.tooltip')}>
              <button
                type="button"
                aria-label={t('deleted.restore.tooltip')}
                onClick={() => onRestoreClick?.(documento)}
                className="rounded-sm p-1 text-muted transition-colors hover:text-teal dark:text-on-dark-soft dark:hover:text-teal"
              >
                <RotateCcw size={14} aria-hidden="true" />
              </button>
            </Tooltip>
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
            <Tooltip content={t('list.actions.tooltips.eliminar')}>
              <button
                type="button"
                aria-label={t('list.actions.eliminar')}
                onClick={() => onDeleteClick?.(documento)}
                className="rounded-sm p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
              >
                ✕
              </button>
            </Tooltip>
          )}
        </div>
      </td>
    </tr>
  )
}
