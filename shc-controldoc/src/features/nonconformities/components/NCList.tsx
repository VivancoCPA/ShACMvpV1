import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { useNCList } from '../hooks/useNCList'
import { SeverityBadge } from '../../../components/shared/SeverityBadge'
import { NCStatusBadge } from '../../../components/shared/NCStatusBadge'
import { DeadlineBadge } from '../../../components/shared/DeadlineBadge'
import { Pagination } from '../../../components/shared/Pagination'
import { TABLE_ROW_CLASS } from '../../../constants/ui.constants'
import type { NoConformidad } from '../types/nonconformity.types'

const COLUMN_COUNT = 9

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className={TABLE_ROW_CLASS}>
          {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
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
              <th className={thClass}>{t('list.columns.titulo')}</th>
              <th className={thClass}>{t('list.columns.areaAfectada')}</th>
              <th className={thClass}>{t('list.columns.severidad')}</th>
              <th className={thClass}>{t('list.columns.estado')}</th>
              <th className={thClass}>{t('list.columns.responsableAC')}</th>
              <th className={thClass}>{t('list.columns.fechaDeteccion')}</th>
              <th className={thClass}>{t('list.columns.fechaCierre')}</th>
              <th className={thClass}>{t('list.columns.acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline dark:divide-hairline/20">
            {isLoading ? (
              <TableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-12 text-center">
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
                <td
                  colSpan={COLUMN_COUNT}
                  className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft"
                >
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
                    className={`${TABLE_ROW_CLASS} ${isAnulada ? 'opacity-50' : ''}`}
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
                    <td
                      className="max-w-[200px] truncate px-4 py-3 text-xs text-ink dark:text-on-dark"
                      title={nc.descripcion}
                    >
                      {nc.descripcion}
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
                      <DeadlineBadge
                        fechaCierre={nc.fechaCierre ?? null}
                        estado={nc.estado}
                      />
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

      {pagination && (
        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize ?? 5}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
