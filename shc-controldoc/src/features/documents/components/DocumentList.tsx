import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDocumentList } from '../hooks/useDocumentList'
import { DocumentListRow } from './DocumentListRow'
import { useAuthStore } from '../../../stores/authStore'

const SKELETON_ROWS = 5
const CREATE_ROLES = new Set(['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST'])

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 8 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-hairline animate-pulse dark:bg-surface-dark-elevated" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function DocumentList() {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const userRole = useAuthStore((s) => s.user?.rol)
  const { documentos, isLoading, isError, pagination, refetch } = useDocumentList()

  const canCreate = userRole !== undefined && CREATE_ROLES.has(userRole)

  const currentPage = pagination?.page ?? 1
  const totalPages = pagination?.totalPages ?? 1
  const totalItems = pagination?.totalItems ?? 0
  const pageSize = pagination?.pageSize ?? 20
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)

  const goToPage = (page: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(page))
      return next
    })
  }

  const columns = [
    t('list.columns.codigo'),
    t('list.columns.titulo'),
    t('list.columns.tipo'),
    t('list.columns.version'),
    t('list.columns.estado'),
    t('list.columns.area'),
    t('list.columns.proxRevision'),
    t('list.columns.acciones'),
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-hairline dark:border-hairline/20">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-canvas text-left dark:bg-surface-dark">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-elevated">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted dark:text-on-dark-soft"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton />}

            {!isLoading && isError && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="mb-3 text-sm text-muted dark:text-on-dark-soft">
                    {t('list.actions.errorMsg')}
                  </p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
                  >
                    {t('list.actions.reintentar')}
                  </button>
                </td>
              </tr>
            )}

            {!isLoading && !isError && documentos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="mb-3 text-sm text-muted dark:text-on-dark-soft">
                    {t('list.empty')}
                  </p>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => navigate('/documents/new')}
                      className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
                    >
                      {t('list.actions.nuevo')}
                    </button>
                  )}
                </td>
              </tr>
            )}

            {!isLoading &&
              !isError &&
              documentos.map((doc, index) => (
                <DocumentListRow
                  key={doc.id}
                  documento={doc}
                  userRole={userRole ?? 'OPERARIO'}
                  index={index}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                />
              ))}
          </tbody>
        </table>
      </div>

      {!isLoading && !isError && totalItems > 0 && (
        <div className="flex items-center justify-between border-t border-hairline bg-canvas px-4 py-3 dark:border-hairline/20 dark:bg-surface-dark">
          <p className="text-sm text-muted dark:text-on-dark-soft">
            {t('list.pagination.showing', { from, to, total: totalItems })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label={t('list.pagination.previous')}
              className="rounded-sm px-2 py-1 text-sm text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:text-on-dark-soft dark:hover:text-on-dark"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const page = i + 1
              const isActive = page === currentPage
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => goToPage(page)}
                  className={`min-w-[2rem] rounded-sm px-2 py-1 text-sm transition-colors ${
                    isActive
                      ? 'bg-coral text-white'
                      : 'text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label={t('list.pagination.next')}
              className="rounded-sm px-2 py-1 text-sm text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:text-on-dark-soft dark:hover:text-on-dark"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
