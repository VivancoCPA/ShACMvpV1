import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, Pencil, X } from 'lucide-react'
import { useQEList } from '../hooks/useQEList'
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

const CHIP_FILTER_KEYS = [
  'estado',
  'tipo',
  'severidad',
  'origen',
  'fechaDesde',
  'fechaHasta',
  'soloReincidencias',
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
  return value
}

export function QEList() {
  const { t } = useTranslation('qualityEvents')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)

  const { qualityEvents, isLoading, isError, pagination, refetch } = useQEList()

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

                const rowClass = `${TABLE_ROW_CLASS}${qe.severidad === 'CRITICA' ? ' border-l-4 border-error' : ''}`

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
                      <QEStatusBadge status={qe.estado} />
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
                        {perms?.puedeEditarCabecera && (
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
    </div>
  )
}
