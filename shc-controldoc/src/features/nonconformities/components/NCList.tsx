import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { useNCList } from '../hooks/useNCList'
import { SeverityBadge } from '../../../components/shared/SeverityBadge'
import { NCStatusBadge } from '../../../components/shared/NCStatusBadge'
import type { NoConformidad } from '../types/nonconformity.types'

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = []
  const left = Math.max(1, current - 3)
  const right = Math.min(total, current + 3)
  if (left > 1) { pages.push(1); if (left > 2) pages.push('...') }
  for (let p = left; p <= right; p++) pages.push(p)
  if (right < total) { if (right < total - 1) pages.push('...'); pages.push(total) }
  return pages
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 8 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded bg-hairline dark:bg-surface-dark-soft" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function hasOverdueACs(nc: NoConformidad): boolean {
  if (nc.estado === 'CERRADA' || nc.estado === 'ANULADA') return false
  return nc.accionesCorrectivas.some((ac) => ac.estado === 'VENCIDA')
}

export function NCList() {
  const { t } = useTranslation('nonconformities')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { nonconformidades, isLoading, isError, pagination, refetch } = useNCList()

  const currentPage = parseInt(searchParams.get('page') ?? '1', 10)

  const setPage = (page: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(page))
      return next
    })
  }

  const thClass =
    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft'

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        <table className="w-full text-sm">
          <thead className="border-b border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-soft">
            <tr>
              <th className={thClass}>{t('list.columns.numero')}</th>
              <th className={thClass}>{t('list.columns.dominio')}</th>
              <th className={thClass}>{t('list.columns.areaAfectada')}</th>
              <th className={thClass}>{t('list.columns.severidad')}</th>
              <th className={thClass}>{t('list.columns.estado')}</th>
              <th className={thClass}>{t('list.columns.responsableAC')}</th>
              <th className={thClass}>{t('list.columns.fechaDeteccion')}</th>
              <th className={thClass}>{t('list.columns.acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline dark:divide-hairline/20">
            {isLoading ? (
              <TableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="text-sm text-error">{t('list.actions.errorMsg')}</p>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="mt-3 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
                  >
                    {t('list.actions.reintentar')}
                  </button>
                </td>
              </tr>
            ) : nonconformidades.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
                  {t('list.empty')}
                </td>
              </tr>
            ) : (
              nonconformidades.map((nc) => {
                const isAnulada = nc.estado === 'ANULADA'
                const showOverdueAlert = hasOverdueACs(nc)
                const responsable = nc.accionesCorrectivas[0]?.responsableId ?? '—'
                const fechaDeteccion = new Intl.DateTimeFormat(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }).format(new Date(nc.fechaDeteccion))

                return (
                  <tr
                    key={nc.id}
                    onClick={() => navigate(`/nonconformities/${nc.id}`)}
                    className={`cursor-pointer transition-colors hover:bg-surface-soft dark:hover:bg-surface-dark-soft ${
                      isAnulada ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-ink dark:text-on-dark">
                      <span className="flex items-center gap-1.5">
                        {nc.numero}
                        {showOverdueAlert && (
                          <AlertTriangle
                            size={14}
                            className="text-error"
                            aria-label={t('list.acVencidaLabel')}
                          />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted dark:text-on-dark-soft">
                      {nc.dominio}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink dark:text-on-dark">
                      {nc.areaAfectada}
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={nc.severidad} />
                    </td>
                    <td className="px-4 py-3">
                      <NCStatusBadge status={nc.estado} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted dark:text-on-dark-soft">
                      {responsable}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted dark:text-on-dark-soft">
                      {fechaDeteccion}
                    </td>
                    <td className="px-4 py-3">
                      {!isAnulada && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/nonconformities/${nc.id}`)
                          }}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-coral transition-colors hover:bg-coral/10 dark:hover:bg-coral/15"
                          aria-label={t('list.actions.verDetalle')}
                        >
                          {t('list.actions.verDetalle')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted dark:text-on-dark-soft">
            {t('list.pagination', {
              from: (currentPage - 1) * (pagination.pageSize ?? 5) + 1,
              to: Math.min(currentPage * (pagination.pageSize ?? 5), pagination.totalItems),
              total: pagination.totalItems,
            })}
          </p>
          <nav className="flex items-center gap-1" aria-label="Paginación">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-md px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hairline disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-surface-dark-soft dark:text-on-dark-soft"
            >
              ←
            </button>
            {getPageNumbers(currentPage, pagination.totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted dark:text-on-dark-soft">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p as number)}
                  className={`min-w-[2rem] rounded-md px-2 py-1 text-xs transition-colors ${
                    p === currentPage
                      ? 'bg-coral text-white'
                      : 'text-muted hover:bg-hairline dark:text-on-dark-soft dark:hover:bg-surface-dark-soft'
                  }`}
                  aria-current={p === currentPage ? 'page' : undefined}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={currentPage >= pagination.totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-md px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hairline disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-surface-dark-soft dark:text-on-dark-soft"
            >
              →
            </button>
          </nav>
        </div>
      )}

      {/* Showing X-Y of Z when single page */}
      {pagination && pagination.totalPages <= 1 && pagination.totalItems > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted dark:text-on-dark-soft">
            {t('list.pagination', {
              from: 1,
              to: pagination.totalItems,
              total: pagination.totalItems,
            })}
          </p>
        </div>
      )}
    </div>
  )
}
