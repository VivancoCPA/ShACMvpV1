import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FilterBar } from '../../../components/shared/FilterBar'
import { Switch } from '../../../components/ui/Switch'
import { useAuthStore } from '../../../stores/authStore'
import { QE_STATUS_LABELS, QE_TYPE_LABELS, QE_SEVERITY_LABELS, QE_ORIGIN_LABELS } from '../../../constants/shared.constants'
import type { QEStatus, QEType, QESeverity, QEOrigin } from '../types/qualityEvent.types'

const QE_STATUS_VALUES: QEStatus[] = [
  'ABIERTO',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
  'CERRADO',
  'EN_VERIFICACION',
  'VERIFICADO',
  'REABIERTO',
]

const QE_TYPE_VALUES: QEType[] = ['CALIDAD', 'SST', 'ADUANERO', 'OPERACIONAL']
const QE_SEVERITY_VALUES: QESeverity[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']
const QE_ORIGIN_VALUES: QEOrigin[] = [
  'O1_INCIDENTE_CAMPO',
  'O2_NC_DETECTADA',
  'O3_HALLAZGO_AUDITORIA',
  'O4_REPORTE_EXTERNO',
]

const FILTER_PARAMS = [
  'estado',
  'tipo',
  'severidad',
  'origen',
  'fechaDesde',
  'fechaHasta',
  'soloReincidencias',
  'showDeleted',
]

export function QEListFilters() {
  const { t } = useTranslation('qualityEvents')
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const canSeeDeleted = user?.rol === 'JEFE_CALIDAD_SYST' || user?.rol === 'ALTA_DIRECCION'

  const hasActiveFilters = FILTER_PARAMS.some((p) => searchParams.has(p))

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

  const handleClear = useCallback(() => {
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

  const selectBase =
    'h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'

  const inputBase =
    'h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:placeholder:text-on-dark-soft'

  return (
    <FilterBar>
      {/* Estado */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="qe-estado">
          {t('list.filters.estado')}
        </label>
        <select
          id="qe-estado"
          className={`${selectBase} w-44`}
          value={searchParams.get('estado') ?? ''}
          onChange={(e) => setParam('estado', e.target.value)}
        >
          <option value="">{t('list.filters.todos')}</option>
          {QE_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {QE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="qe-tipo">
          {t('list.filters.tipo')}
        </label>
        <select
          id="qe-tipo"
          className={`${selectBase} w-36`}
          value={searchParams.get('tipo') ?? ''}
          onChange={(e) => setParam('tipo', e.target.value)}
        >
          <option value="">{t('list.filters.todos')}</option>
          {QE_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {QE_TYPE_LABELS[v]}
            </option>
          ))}
        </select>
      </div>

      {/* Severidad */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="qe-severidad">
          {t('list.filters.severidad')}
        </label>
        <select
          id="qe-severidad"
          className={`${selectBase} w-32`}
          value={searchParams.get('severidad') ?? ''}
          onChange={(e) => setParam('severidad', e.target.value)}
        >
          <option value="">{t('list.filters.todos')}</option>
          {QE_SEVERITY_VALUES.map((v) => (
            <option key={v} value={v}>
              {QE_SEVERITY_LABELS[v]}
            </option>
          ))}
        </select>
      </div>

      {/* Origen */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="qe-origen">
          {t('list.filters.origen')}
        </label>
        <select
          id="qe-origen"
          className={`${selectBase} w-44`}
          value={searchParams.get('origen') ?? ''}
          onChange={(e) => setParam('origen', e.target.value)}
        >
          <option value="">{t('list.filters.todos')}</option>
          {QE_ORIGIN_VALUES.map((v) => (
            <option key={v} value={v}>
              {QE_ORIGIN_LABELS[v]}
            </option>
          ))}
        </select>
      </div>

      {/* Fecha del evento — Desde / Hasta */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="qe-fecha-desde">
          {t('list.filters.fechaEvento')}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="qe-fecha-desde"
            type="date"
            lang="es-PE"
            className={`${inputBase} w-36`}
            value={searchParams.get('fechaDesde') ?? ''}
            onChange={(e) => setParam('fechaDesde', e.target.value)}
          />
          <span className="text-xs text-muted dark:text-on-dark-soft">–</span>
          <label className="sr-only" htmlFor="qe-fecha-hasta">
            {t('list.filters.fechaHasta')}
          </label>
          <input
            id="qe-fecha-hasta"
            type="date"
            lang="es-PE"
            className={`${inputBase} w-36`}
            value={searchParams.get('fechaHasta') ?? ''}
            onChange={(e) => setParam('fechaHasta', e.target.value)}
          />
        </div>
      </div>

      {/* Solo Reincidencias */}
      <div className="flex items-end pb-0.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink dark:text-on-dark">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-hairline accent-coral dark:border-hairline/20"
            checked={searchParams.get('soloReincidencias') === 'true'}
            onChange={(e) => setParam('soloReincidencias', e.target.checked ? 'true' : '')}
          />
          {t('list.filters.soloReincidencias')}
        </label>
      </div>

      {/* Mostrar eliminados — solo JEFE_CALIDAD_SYST y ALTA_DIRECCION */}
      {canSeeDeleted && (
        <div className="self-end">
          <Switch
            id="qe-show-deleted"
            checked={searchParams.get('showDeleted') === 'true'}
            onChange={() => {
              const current = searchParams.get('showDeleted') === 'true'
              setParam('showDeleted', current ? '' : 'true')
            }}
            label={t('list.filters.mostrarEliminados')}
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
          {t('list.filters.limpiar')}
        </button>
      )}
    </FilterBar>
  )
}
