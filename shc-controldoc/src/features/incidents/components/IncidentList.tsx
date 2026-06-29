import { useRef, useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react'
import { useIncidentList } from '../hooks/useIncidentList'
import { useDeleteIncident, useRestoreIncident } from '../hooks/useIncidents'
import { getIncidentPermissions } from '../utils/incidentPermissions'
import { useAuthStore } from '../../../stores/authStore'
import { FilterBar } from '../../../components/shared/FilterBar'
import { Switch } from '../../../components/ui/Switch'
import { SeverityBadge } from '../../../components/shared/SeverityBadge'
import { Pagination } from '../../../components/shared/Pagination'
import { IncidentStatusBadge } from './IncidentStatusBadge'
import { IncidentTypeBadge } from './IncidentTypeBadge'
import { TABLE_ROW_CLASS } from '../../../constants/ui.constants'
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  AREAS_SHAC,
} from '../../../constants/shared.constants'
import { formatShortDate } from '../../../utils/date.utils'
import type { Incidente, IncidentType, IncidentStatus, IncidentSeveridad } from '../types/incident.types'
import type { NCSeveridad } from '../../nonconformities/types/nonconformity.types'

const COLUMN_COUNT = 8

const INCIDENT_TYPE_VALUES: IncidentType[] = [
  'ACCIDENTE',
  'INCIDENTE',
  'CUASI_ACCIDENTE',
  'CONDICION_INSEGURA',
]

const INCIDENT_STATUS_VALUES: IncidentStatus[] = [
  'ABIERTO',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
  'CERRADO',
  'ANULADO',
]

const SEVERIDAD_VALUES: IncidentSeveridad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']

const FILTER_PARAMS = [
  'search',
  'tipo',
  'estado',
  'severidad',
  'areaId',
  'fechaDesde',
  'fechaHasta',
  'showDeleted',
  'page',
]

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
  incidente: Incidente
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function DeleteConfirmModal({ incidente, isPending, onConfirm, onClose }: DeleteModalProps) {
  const { t } = useTranslation('incidents')
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
              {t('delete.confirm.message', { numero: incidente.numero })}
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

interface RestoreModalProps {
  incidente: Incidente
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function RestoreConfirmModal({ incidente, isPending, onConfirm, onClose }: RestoreModalProps) {
  const { t } = useTranslation('incidents')
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
            {t('restore.confirm.message', { numero: incidente.numero })}
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

export function IncidentList() {
  const { t, i18n } = useTranslation('incidents')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)

  const { incidentes, isLoading, isError, pagination, refetch } = useIncidentList()
  const deleteIncident = useDeleteIncident()
  const restoreIncident = useRestoreIncident()

  const [pendingDelete, setPendingDelete] = useState<Incidente | null>(null)
  const [pendingRestore, setPendingRestore] = useState<Incidente | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canSeeDeleted = user?.rol === 'JEFE_CALIDAD_SYST'
  const currentPage = parseInt(searchParams.get('page') ?? '1', 10)

  const hasActiveFilters = FILTER_PARAMS.some(
    (p) => p !== 'page' && searchParams.has(p),
  )

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        if (key !== 'page') next.set('page', '1')
        return next
      })
    },
    [setSearchParams],
  )

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setParam('search', value)
      }, 300)
    },
    [setParam],
  )

  const handleClear = useCallback(() => {
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

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

  const setPage = (page: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(page))
      return next
    })
  }

  const inputBase =
    'h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:placeholder:text-on-dark-soft'

  const selectBase =
    'h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'

  const thClass =
    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft'

  // Active filter chips config
  type ChipDef = { key: string; label: string }
  const activeChips: ChipDef[] = []
  const tipoParam = searchParams.get('tipo')
  if (tipoParam) activeChips.push({ key: 'tipo', label: INCIDENT_TYPE_LABELS[tipoParam as IncidentType] ?? tipoParam })
  const estadoParam = searchParams.get('estado')
  if (estadoParam) activeChips.push({ key: 'estado', label: INCIDENT_STATUS_LABELS[estadoParam as IncidentStatus] ?? estadoParam })
  const severidadParam = searchParams.get('severidad')
  if (severidadParam) activeChips.push({ key: 'severidad', label: severidadParam })
  const areaIdParam = searchParams.get('areaId')
  if (areaIdParam) activeChips.push({ key: 'areaId', label: areaIdParam })
  const fechaDesdeParam = searchParams.get('fechaDesde')
  if (fechaDesdeParam) activeChips.push({ key: 'fechaDesde', label: `Desde: ${fechaDesdeParam}` })
  const fechaHastaParam = searchParams.get('fechaHasta')
  if (fechaHastaParam) activeChips.push({ key: 'fechaHasta', label: `Hasta: ${fechaHastaParam}` })
  const searchParam = searchParams.get('search')
  if (searchParam) activeChips.push({ key: 'search', label: `"${searchParam}"` })
  if (searchParams.get('showDeleted') === 'true') activeChips.push({ key: 'showDeleted', label: t('filters.mostrarEliminados') })

  return (
    <div>
      {/* FilterBar */}
      <FilterBar>
        {/* Búsqueda libre */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="inc-search">
            {t('filters.searchLabel')}
          </label>
          <input
            id="inc-search"
            type="search"
            className={`${inputBase} w-56`}
            placeholder={t('filters.searchPlaceholder')}
            defaultValue={searchParams.get('search') ?? ''}
            onChange={handleSearch}
            aria-label={t('filters.searchLabel')}
          />
        </div>

        {/* Tipo */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="inc-tipo">
            {t('filters.tipoLabel')}
          </label>
          <select
            id="inc-tipo"
            className={`${selectBase} w-40`}
            value={searchParams.get('tipo') ?? ''}
            onChange={(e) => setParam('tipo', e.target.value)}
          >
            <option value="">{t('filters.todos')}</option>
            {INCIDENT_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {INCIDENT_TYPE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="inc-estado">
            {t('filters.estadoLabel')}
          </label>
          <select
            id="inc-estado"
            className={`${selectBase} w-44`}
            value={searchParams.get('estado') ?? ''}
            onChange={(e) => setParam('estado', e.target.value)}
          >
            <option value="">{t('filters.todos')}</option>
            {INCIDENT_STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {INCIDENT_STATUS_LABELS[v]}
              </option>
            ))}
          </select>
        </div>

        {/* Severidad */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="inc-severidad">
            {t('filters.severidadLabel')}
          </label>
          <select
            id="inc-severidad"
            className={`${selectBase} w-32`}
            value={searchParams.get('severidad') ?? ''}
            onChange={(e) => setParam('severidad', e.target.value)}
          >
            <option value="">{t('filters.todos')}</option>
            {SEVERIDAD_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Área */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="inc-area">
            {t('filters.areaLabel')}
          </label>
          <select
            id="inc-area"
            className={`${selectBase} w-44`}
            value={searchParams.get('areaId') ?? ''}
            onChange={(e) => setParam('areaId', e.target.value)}
          >
            <option value="">{t('filters.todos')}</option>
            {AREAS_SHAC.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Fecha desde/hasta */}
        <div className="flex flex-col gap-1">
          <label className="sr-only" htmlFor="inc-fecha-desde">
            {t('filters.fechaDesdeLabel')}
          </label>
          <span className="text-xs font-medium text-muted dark:text-on-dark-soft">
            {t('filters.fechaDesdeLabel')}
          </span>
          <div className="flex items-center gap-2">
            <input
              id="inc-fecha-desde"
              type="date"
              lang="es-PE"
              title={t('filters.fechaDesdeLabel')}
              className={`${inputBase} w-36`}
              value={searchParams.get('fechaDesde') ?? ''}
              onChange={(e) => setParam('fechaDesde', e.target.value)}
            />
            <span className="text-xs text-muted dark:text-on-dark-soft">–</span>
            <label className="sr-only" htmlFor="inc-fecha-hasta">
              {t('filters.fechaHastaLabel')}
            </label>
            <input
              id="inc-fecha-hasta"
              type="date"
              lang="es-PE"
              title={t('filters.fechaHastaLabel')}
              className={`${inputBase} w-36`}
              value={searchParams.get('fechaHasta') ?? ''}
              onChange={(e) => setParam('fechaHasta', e.target.value)}
            />
          </div>
        </div>

        {/* Mostrar eliminados — solo JEFE_CALIDAD_SYST */}
        {canSeeDeleted && (
          <div className="self-end">
            <Switch
              id="inc-show-deleted"
              checked={searchParams.get('showDeleted') === 'true'}
              onChange={() => {
                const current = searchParams.get('showDeleted') === 'true'
                setParam('showDeleted', current ? '' : 'true')
              }}
              label={t('filters.mostrarEliminados')}
              danger
            />
          </div>
        )}

        {/* Limpiar filtros */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="h-9 self-end rounded-md border border-hairline bg-canvas px-3 text-sm text-muted transition-colors hover:border-error/40 hover:text-error dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:text-error"
          >
            {t('filters.limpiar')}
          </button>
        )}
      </FilterBar>

      {/* Active filter chips */}
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

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        <table className="w-full text-sm">
          <thead className="border-b border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-soft">
            <tr>
              <th className={thClass}>{t('list.columns.numero')}</th>
              <th className={thClass}>{t('list.columns.tipo')}</th>
              <th className={thClass}>{t('list.columns.descripcion')}</th>
              <th className={thClass}>{t('list.columns.area')}</th>
              <th className={thClass}>{t('list.columns.severidad')}</th>
              <th className={thClass}>{t('list.columns.estado')}</th>
              <th className={thClass}>{t('list.columns.fechaEvento')}</th>
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
            ) : incidentes.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMN_COUNT}
                  className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft"
                >
                  <p>{hasActiveFilters ? t('list.emptyWithFilters') : t('list.empty')}</p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="mt-3 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs text-muted hover:text-ink dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:text-on-dark"
                    >
                      {t('filters.limpiar')}
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              incidentes.map((inc) => {
                const isDeleted = !!inc.deletedAt
                const perms = user?.rol ? getIncidentPermissions(inc, user.rol) : null

                const showDeleteBtn = perms?.canDelete && inc.estado === 'ABIERTO' && !isDeleted
                const showRestoreBtn = perms?.canRestore && isDeleted

                const rowClass = isDeleted
                  ? `${TABLE_ROW_CLASS} opacity-50`
                  : TABLE_ROW_CLASS

                const descripcionTruncated =
                  inc.descripcion.length > 60
                    ? `${inc.descripcion.slice(0, 60)}…`
                    : inc.descripcion

                return (
                  <tr
                    key={inc.id}
                    onClick={() => !isDeleted && navigate(`/incidents/${inc.id}`)}
                    className={`${rowClass} ${isDeleted ? 'cursor-default' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-ink dark:text-on-dark">
                      {inc.numero}
                    </td>
                    <td className="px-4 py-3">
                      <IncidentTypeBadge type={inc.tipo} />
                    </td>
                    <td
                      className={`max-w-[200px] truncate px-4 py-3 text-xs text-ink dark:text-on-dark ${isDeleted ? 'line-through' : ''}`}
                      title={inc.descripcion}
                    >
                      {descripcionTruncated}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink dark:text-on-dark">
                      {inc.areaId}
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={inc.severidad as NCSeveridad} />
                    </td>
                    <td className="px-4 py-3">
                      <IncidentStatusBadge status={inc.estado} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted dark:text-on-dark-soft">
                      {formatShortDate(inc.fechaEvento, i18n.language)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {perms?.canView && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/incidents/${inc.id}`)
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
                              setPendingDelete(inc)
                            }}
                            aria-label={t('delete.confirm.confirm')}
                            title={t('delete.confirm.confirm')}
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
                              setPendingRestore(inc)
                            }}
                            aria-label={t('restore.confirm.confirm')}
                            title={t('restore.confirm.confirm')}
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
          pageSize={pagination.pageSize}
          onPageChange={setPage}
        />
      )}

      {pendingDelete && (
        <DeleteConfirmModal
          incidente={pendingDelete}
          isPending={deleteIncident.isPending}
          onConfirm={() => {
            deleteIncident.mutate(pendingDelete.id, {
              onSettled: () => setPendingDelete(null),
            })
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {pendingRestore && (
        <RestoreConfirmModal
          incidente={pendingRestore}
          isPending={restoreIncident.isPending}
          onConfirm={() => {
            restoreIncident.mutate(pendingRestore.id, {
              onSettled: () => setPendingRestore(null),
            })
          }}
          onClose={() => setPendingRestore(null)}
        />
      )}
    </div>
  )
}
