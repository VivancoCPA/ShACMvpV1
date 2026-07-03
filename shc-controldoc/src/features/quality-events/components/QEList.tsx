import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Eye, Pencil, Trash2, RotateCcw, X } from 'lucide-react'
import { useQEList } from '../hooks/useQEList'
import { useDeleteQualityEvent } from '../hooks/useDeleteQualityEvent'
import { useReactivateQualityEvent } from '../hooks/useReactivateQualityEvent'
import { getQualityEventPermissions } from '../utils/qualityEventPermissions'
import { useAuthStore } from '../../../stores/authStore'
import { QEStatusBadge } from './QEStatusBadge'
import { QETypeBadge } from './QETypeBadge'
import { QEOriginBadge } from './QEOriginBadge'
import { QESeverityBadge } from './QESeverityBadge'
import { DeadlineBadge } from '../../../components/shared/DeadlineBadge'
import { Pagination } from '../../../components/shared/Pagination'
import { TABLE_ROW_CLASS } from '../../../constants/ui.constants'
import { QE_STATUS_LABELS, QE_TYPE_LABELS, QE_SEVERITY_LABELS, QE_ORIGIN_LABELS } from '../../../constants/shared.constants'
import type { QualityEvent } from '../types/qualityEvent.types'

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

interface DeleteModalProps {
  qe: QualityEvent
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function DeleteConfirmModal({ qe, isPending, onConfirm, onClose }: DeleteModalProps) {
  const { t } = useTranslation('qualityEvents')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('delete.confirm.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">{t('delete.confirm.title')}</h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
              {t('delete.confirm.message', { numero: qe.numero })}
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
            {t('delete.confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/80 disabled:opacity-60"
          >
            {t('delete.confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ReactivateModalProps {
  qe: QualityEvent
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function ReactivateConfirmModal({ qe, isPending, onConfirm, onClose }: ReactivateModalProps) {
  const { t } = useTranslation('qualityEvents')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('reactivate.confirm.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4">
          <h2 className="font-medium text-ink dark:text-on-dark">{t('reactivate.confirm.title')}</h2>
          <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
            {t('reactivate.confirm.message', { numero: qe.numero })}
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
          >
            {t('reactivate.confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/80 disabled:opacity-60"
          >
            {t('reactivate.confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

const CHIP_FILTER_KEYS = [
  'estado',
  'tipo',
  'severidad',
  'origen',
  'fechaDesde',
  'fechaHasta',
  'soloReincidencias',
  'showDeleted',
] as const

function getChipLabel(
  key: string,
  value: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  if (key === 'estado') return QE_STATUS_LABELS[value as keyof typeof QE_STATUS_LABELS] ?? value
  if (key === 'tipo') return QE_TYPE_LABELS[value as keyof typeof QE_TYPE_LABELS] ?? value
  if (key === 'severidad') return QE_SEVERITY_LABELS[value as keyof typeof QE_SEVERITY_LABELS] ?? value
  if (key === 'origen') return QE_ORIGIN_LABELS[value as keyof typeof QE_ORIGIN_LABELS] ?? value
  if (key === 'fechaDesde') return `Desde: ${value}`
  if (key === 'fechaHasta') return `Hasta: ${value}`
  if (key === 'soloReincidencias') return t('list.filters.soloReincidencias')
  if (key === 'showDeleted') return t('list.filters.mostrarEliminados')
  return value
}

export function QEList() {
  const { t } = useTranslation('qualityEvents')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)

  const { qualityEvents, isLoading, isError, pagination, refetch } = useQEList()
  const deleteQE = useDeleteQualityEvent()
  const reactivateQE = useReactivateQualityEvent()

  const [pendingDelete, setPendingDelete] = useState<QualityEvent | null>(null)
  const [pendingReactivate, setPendingReactivate] = useState<QualityEvent | null>(null)

  const canDelete = user?.rol === 'JEFE_CALIDAD_SYST' || user?.rol === 'ALTA_DIRECCION'

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
  for (const key of CHIP_FILTER_KEYS) {
    const value = searchParams.get(key)
    if (value) {
      activeChips.push({ key, label: getChipLabel(key, value, t) })
    }
  }

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
                aria-label={`${t('list.filters.limpiar')} ${chip.label}`}
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
              <th className={thClass}>{t('list.columns.tipoOrigen')}</th>
              <th className={thClass}>{t('list.columns.descripcion')}</th>
              <th className={thClass}>{t('list.columns.area')}</th>
              <th className={thClass}>{t('list.columns.severidad')}</th>
              <th className={thClass}>{t('list.columns.estado')}</th>
              <th className={thClass}>{t('list.columns.ciclo')}</th>
              <th className={thClass}>{t('list.columns.vencimiento')}</th>
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
            ) : qualityEvents.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMN_COUNT}
                  className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft"
                >
                  {t('list.empty')}
                </td>
              </tr>
            ) : (
              qualityEvents.map((qe: QualityEvent) => {
                const perms = user?.rol
                  ? getQualityEventPermissions(qe.estado, user.rol, false)
                  : null

                const isDeleted = !!qe.deletedAt
                const showDeleteBtn = canDelete && !isDeleted
                const showReactivateBtn = canDelete && isDeleted

                const rowClass = `${TABLE_ROW_CLASS}${qe.severidad === 'CRITICA' ? ' border-l-4 border-error' : ''}${isDeleted ? ' opacity-50' : ''}`

                return (
                  <tr
                    key={qe.id}
                    onClick={() => navigate(`/quality-events/${qe.id}`)}
                    className={rowClass}
                  >
                    {/* Número */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs font-medium text-ink dark:text-on-dark">
                          {qe.numero}
                        </span>
                        {qe.ciclo > 1 && (
                          <span className="inline-flex w-fit items-center rounded-pill bg-amber/15 px-1.5 py-0.5 text-[10px] font-medium text-amber">
                            {t('list.reincidencia', { count: qe.ciclo })}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tipo + Origen */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <QETypeBadge type={qe.tipo} />
                        <QEOriginBadge origin={qe.origen} />
                      </div>
                    </td>

                    {/* Descripción */}
                    <td
                      className="max-w-[240px] truncate px-4 py-3 text-xs text-ink dark:text-on-dark"
                      title={qe.descripcion}
                    >
                      {qe.descripcion.length > 80
                        ? qe.descripcion.slice(0, 80)
                        : qe.descripcion}
                    </td>

                    {/* Área */}
                    <td className="px-4 py-3 text-xs text-ink dark:text-on-dark">
                      {qe.areaAfectada}
                    </td>

                    {/* Severidad */}
                    <td className="px-4 py-3">
                      <QESeverityBadge severity={qe.severidad} />
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <QEStatusBadge status={qe.estado} />
                        {isDeleted && (
                          <span className="rounded-full bg-error/15 px-2 py-0.5 text-xs font-medium text-error dark:bg-error/20 dark:text-error">
                            {t('deletedBadge')}
                          </span>
                        )}
                      </div>
                      {user?.rol === 'JEFE_CALIDAD_SYST' && qe.solicitudesAC > 0 && (
                        <span className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
                          <AlertTriangle size={11} aria-hidden="true" />
                          {t('list.solicitudesACPendientes', { count: qe.solicitudesAC })}
                        </span>
                      )}
                    </td>

                    {/* Ciclo */}
                    <td className="px-4 py-3 text-center text-xs text-muted dark:text-on-dark-soft">
                      {qe.ciclo}
                    </td>

                    {/* Vencimiento */}
                    <td className="px-4 py-3">
                      {qe.estado === 'EN_VERIFICACION' ? (
                        <DeadlineBadge
                          fechaCierre={qe.fechaVerificacionProgramada ?? null}
                          estado={qe.estado}
                        />
                      ) : (
                        <span className="text-xs text-muted dark:text-on-dark-soft">—</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/quality-events/${qe.id}`)
                          }}
                          aria-label={t('list.actions.ver')}
                          title={t('list.actions.ver')}
                          className="rounded-sm p-1 text-muted transition-colors hover:text-coral dark:text-on-dark-soft dark:hover:text-coral"
                        >
                          <Eye size={14} aria-hidden="true" />
                        </button>
                        {perms?.puedeEditarCabecera && !isDeleted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/quality-events/${qe.id}/editar`)
                            }}
                            aria-label={t('list.actions.editar')}
                            title={t('list.actions.editar')}
                            className="rounded-sm p-1 text-muted transition-colors hover:text-coral dark:text-on-dark-soft dark:hover:text-coral"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        )}
                        {showDeleteBtn && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPendingDelete(qe)
                            }}
                            aria-label={t('delete.confirm.confirm')}
                            title={t('delete.confirm.confirm')}
                            className="rounded-sm p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                        {showReactivateBtn && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPendingReactivate(qe)
                            }}
                            aria-label={t('reactivate.confirm.confirm')}
                            title={t('reactivate.confirm.confirm')}
                            className="rounded-sm p-1 text-muted transition-colors hover:text-success dark:text-on-dark-soft dark:hover:text-success"
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
          pageSize={pagination.pageSize}
          onPageChange={setPage}
        />
      )}

      {pendingDelete && (
        <DeleteConfirmModal
          qe={pendingDelete}
          isPending={deleteQE.isPending}
          onConfirm={() => {
            deleteQE.mutate(pendingDelete.id, {
              onSettled: () => setPendingDelete(null),
            })
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {pendingReactivate && (
        <ReactivateConfirmModal
          qe={pendingReactivate}
          isPending={reactivateQE.isPending}
          onConfirm={() => {
            reactivateQE.mutate(pendingReactivate.id, {
              onSettled: () => setPendingReactivate(null),
            })
          }}
          onClose={() => setPendingReactivate(null)}
        />
      )}
    </div>
  )
}
