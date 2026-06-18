import { useTranslation } from 'react-i18next'
import { getDocumentPermissions } from '../permissions'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { RevisionSemaforo } from './RevisionSemaforo'
import type { Documento, DocRole } from '../../../types/documents.types'
import type { UserRole } from '../../../types/auth.types'

interface DocumentListRowProps {
  documento: Documento
  userRole: UserRole
  index: number
  onClick: () => void
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

export function DocumentListRow({ documento, userRole, index, onClick }: DocumentListRowProps) {
  const { t } = useTranslation('documents')

  const isReadOnly = READ_ONLY_ROLES.has(userRole)
  const docRole = userRoleToDocRole(userRole)
  const perms = isReadOnly
    ? { canEdit: false, canDelete: false, canStartReview: false }
    : getDocumentPermissions(documento.estado, docRole)

  const rowBg =
    index % 2 === 0
      ? 'bg-canvas dark:bg-surface-dark'
      : 'bg-hairline/30 dark:bg-surface-dark-elevated/30'

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-b border-hairline hover:bg-coral/5 dark:border-hairline/20 dark:hover:bg-coral/10 ${rowBg}`}
    >
      <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-ink dark:text-on-dark">
        <span className="flex items-center gap-1.5">
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
        <StatusBadge status={documento.estado} />
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
          {perms.canEdit && documento.estado !== 'OBSOLETO' && (
            <button
              type="button"
              aria-label={t('list.actions.editar')}
              className="rounded-sm p-1 text-muted transition-colors hover:text-coral dark:text-on-dark-soft dark:hover:text-coral"
            >
              ✏
            </button>
          )}
          {perms.canStartReview && (
            <button
              type="button"
              aria-label={t('list.actions.iniciarRevision')}
              className="rounded-sm p-1 text-muted transition-colors hover:text-teal dark:text-on-dark-soft dark:hover:text-teal"
            >
              ↻
            </button>
          )}
          {perms.canDelete && (
            <button
              type="button"
              aria-label={t('list.actions.eliminar')}
              className="rounded-sm p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
            >
              ✕
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
