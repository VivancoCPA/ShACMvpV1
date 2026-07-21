import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Eye, Trash2, RotateCcw, X } from 'lucide-react'
import { useNCList } from '../hooks/useNCList'
import { useDeleteNC, useRestoreNC } from '../hooks/useNonconformities'
import { useAreas } from '../../areas/hooks/useAreas'
import { getNCPermissions } from '../utils/ncPermissions'
import { useAuthStore } from '../../../stores/authStore'
import { SeverityBadge } from '../../../components/shared/SeverityBadge'
import { NCStatusBadge } from '../../../components/shared/NCStatusBadge'
import { DeadlineBadge } from '../../../components/shared/DeadlineBadge'
import { Pagination } from '../../../components/shared/Pagination'
import { TABLE_ROW_CLASS } from '../../../constants/ui.constants'
import { formatShortDate } from '../../../utils/date.utils'
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

interface ConfirmModalProps {
  nc: NoConformidad
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function DeleteConfirmModal({ nc, isPending, onConfirm, onClose }: ConfirmModalProps) {
  const { t } = useTranslation('nonconformities')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('delete.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">{t('delete.confirm.title')}</h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
              {t('delete.confirm.message', { numero: nc.numero })}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
          >
            {t('delete.actions.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/80 disabled:opacity-60"
          >
            {t('delete.actions.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RestoreConfirmModal({ nc, isPending, onConfirm, onClose }: ConfirmModalProps) {
  const { t } = useTranslation('nonconformities')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('restore.confirm.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4">
          <h2 className="font-medium text-ink dark:text-on-dark">{t('restore.confirm.title')}</h2>
          <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
            {t('restore.confirm.message', { numero: nc.numero })}
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
          >
            {t('restore.confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/80 disabled:opacity-60"
          >
            {t('restore.confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function NCList() {
  const { t, i18n } = useTranslation('nonconformities')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)

  const { nonconformidades, isLoading, isError, pagination, refetch } = useNCList()
  const { data: areas } = useAreas()
  const nombreArea = (id: string) => areas?.find((a) => a.id === id)?.nombre ?? id
  const deleteNC = useDeleteNC()
  const restoreNC = useRestoreNC()

  const [pendingDeleteNC, setPendingDeleteNC] = useState<NoConformidad | null>(null)
  const [pendingRestoreNC, setPendingRestoreNC] = useState<NoConformidad | null>(null)

  const currentPage = parseInt(searchParams.get('page') ?? '1', 10)

  const setPage = (page: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(page))
      return next
    })
  }

  const removeParam = useCallback(
    (key: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete(key)
        next.set('page', '1')
        return next
      })
    },
    [setSearchParams],
  )

  type ChipDef = { key: string; label: string }
  const activeChips: ChipDef[] = []
  const estadoParam = searchParams.get('estado')
  if (estadoParam) activeChips.push({ key: 'estado', label: t(`status.${estadoParam}`) })
  const severidadParam = searchParams.get('severidad')
  if (severidadParam) activeChips.push({ key: 'severidad', label: severidadParam })
  const areaIdParam = searchParams.get('areaId')
  if (areaIdParam) activeChips.push({ key: 'areaId', label: nombreArea(areaIdParam) })
  const fechaDesdeParam = searchParams.get('fechaDesde')
  if (fechaDesdeParam) activeChips.push({ key: 'fechaDesde', label: `Desde: ${fechaDesdeParam}` })
  const fechaHastaParam = searchParams.get('fechaHasta')
  if (fechaHastaParam) activeChips.push({ key: 'fechaHasta', label: `Hasta: ${fechaHastaParam}` })
  const searchParam = searchParams.get('search')
  if (searchParam) activeChips.push({ key: 'search', label: `"${searchParam}"` })
  if (searchParams.get('showDeleted') === 'true') activeChips.push({ key: 'showDeleted', label: t('filters.mostrarEliminados') })

  const thClass =
    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft'

  return (
    <div>
      {activeChips.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-pill bg-surface-soft px-2.5 py-1 text-xs text-ink dark:bg-surface-dark-soft dark:text-on-dark"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => removeParam(chip.key)}
                aria-label={`${t('filters.limpiar')} ${chip.label}`}
                className="ml-0.5 text-muted hover:text-error dark:text-on-dark-soft dark:hover:text-error"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

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
                const isDeleted = !!nc.deletedAt
                const showOverdueAlert = hasOverdueACs(nc)
                const responsable = nc.accionesCorrectivas[0]?.responsableId ?? '—'
                const fechaDeteccion = formatShortDate(nc.fechaDeteccion, i18n.language)

                const perms = user?.rol
                  ? getNCPermissions(nc, user.rol)
                  : null

                const showDeleteBtn =
                  perms?.canDelete && nc.estado === 'ABIERTA' && !isDeleted
                const showRestoreBtn = perms?.canRestore && isDeleted

                const rowClass = isDeleted
                  ? `${TABLE_ROW_CLASS} opacity-50`
                  : `${TABLE_ROW_CLASS} ${isAnulada ? 'opacity-50' : ''}`

                return (
                  <tr
                    key={nc.id}
                    onClick={() => !isDeleted && navigate(`/nonconformities/${nc.id}`)}
                    className={`${rowClass} ${isDeleted ? 'cursor-default' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-ink dark:text-on-dark">
                      <span className="flex items-center gap-1.5">
                        <span className={isDeleted ? 'line-through' : ''}>{nc.numero}</span>
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
                      className={`max-w-[200px] truncate px-4 py-3 text-xs text-ink dark:text-on-dark ${isDeleted ? 'line-through' : ''}`}
                      title={nc.titulo}
                    >
                      {nc.titulo}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink dark:text-on-dark">
                      {nombreArea(nc.areaId)}
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={nc.severidad} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <NCStatusBadge status={nc.estado} />
                        {isDeleted && (
                          <span className="rounded-full bg-error/15 px-2 py-0.5 text-xs font-medium text-error dark:bg-error/20 dark:text-error">
                            {t('deletedBadge')}
                          </span>
                        )}
                      </div>
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
                      <div className="flex items-center gap-1">
                        {!isAnulada && !isDeleted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/nonconformities/${nc.id}`)
                            }}
                            aria-label={t('list.actions.verDetalle')}
                            title={t('list.actions.verDetalle')}
                            className="rounded-sm p-1 text-muted transition-colors hover:text-coral dark:text-on-dark-soft dark:hover:text-coral"
                          >
                            <Eye size={14} aria-hidden="true" />
                          </button>
                        )}
                        {showDeleteBtn && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPendingDeleteNC(nc)
                            }}
                            aria-label={t('delete.actions.confirm')}
                            title={t('delete.actions.confirm')}
                            className="rounded-sm p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                        {showRestoreBtn && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPendingRestoreNC(nc)
                            }}
                            aria-label={t('restore.tooltip')}
                            title={t('restore.tooltip')}
                            className="rounded-sm p-1 text-muted transition-colors hover:text-teal dark:text-on-dark-soft dark:hover:text-teal"
                          >
                            <RotateCcw size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
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

      {pendingDeleteNC && (
        <DeleteConfirmModal
          nc={pendingDeleteNC}
          isPending={deleteNC.isPending}
          onConfirm={() => {
            deleteNC.mutate(pendingDeleteNC.id, {
              onSettled: () => setPendingDeleteNC(null),
            })
          }}
          onClose={() => setPendingDeleteNC(null)}
        />
      )}

      {pendingRestoreNC && (
        <RestoreConfirmModal
          nc={pendingRestoreNC}
          isPending={restoreNC.isPending}
          onConfirm={() => {
            restoreNC.mutate(pendingRestoreNC.id, {
              onSettled: () => setPendingRestoreNC(null),
            })
          }}
          onClose={() => setPendingRestoreNC(null)}
        />
      )}
    </div>
  )
}
