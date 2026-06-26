import { useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { NCStatus, NCSeveridad, NCDominio } from '../types/nonconformity.types'

const NC_STATUS_VALUES: NCStatus[] = [
  'ABIERTA',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
  'CERRADA',
  'ANULADA',
]

const NC_SEVERITY_VALUES: NCSeveridad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']

const NC_DOMINIO_VALUES: NCDominio[] = ['CALIDAD', 'SST', 'ADUANERO', 'OPERACIONAL']

const FILTER_PARAMS = ['search', 'estado', 'dominio', 'severidad', 'areaAfectada', 'fechaDesde', 'fechaHasta', 'page']

export function NCListFilters() {
  const { t } = useTranslation('nonconformities')
  const [searchParams, setSearchParams] = useSearchParams()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const inputBase =
    'h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:placeholder:text-on-dark-soft'

  const selectBase =
    'h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {/* Search */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="nc-search">
          {t('filters.searchLabel')}
        </label>
        <input
          id="nc-search"
          type="search"
          className={`${inputBase} w-56`}
          placeholder={t('filters.searchPlaceholder')}
          defaultValue={searchParams.get('search') ?? ''}
          onChange={handleSearch}
          aria-label={t('filters.searchLabel')}
        />
      </div>

      {/* Dominio */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="nc-dominio">
          {t('filters.dominioLabel')}
        </label>
        <select
          id="nc-dominio"
          className={`${selectBase} w-32`}
          value={searchParams.get('dominio') ?? ''}
          onChange={(e) => setParam('dominio', e.target.value)}
        >
          <option value="">{t('filters.todos')}</option>
          {NC_DOMINIO_VALUES.map((d) => (
            <option key={d} value={d}>
              {t(`filters.dominio.${d}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Severidad */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="nc-severidad">
          {t('filters.severidadLabel')}
        </label>
        <select
          id="nc-severidad"
          className={`${selectBase} w-32`}
          value={searchParams.get('severidad') ?? ''}
          onChange={(e) => setParam('severidad', e.target.value)}
        >
          <option value="">{t('filters.todos')}</option>
          {NC_SEVERITY_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Estado */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="nc-estado">
          {t('filters.estadoLabel')}
        </label>
        <select
          id="nc-estado"
          className={`${selectBase} w-40`}
          value={searchParams.get('estado') ?? ''}
          onChange={(e) => setParam('estado', e.target.value)}
        >
          <option value="">{t('filters.todos')}</option>
          {NC_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Área Afectada */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="nc-area">
          {t('filters.areaAfectadaLabel')}
        </label>
        <input
          id="nc-area"
          type="text"
          className={`${inputBase} w-40`}
          placeholder={t('filters.areaAfectadaPlaceholder')}
          value={searchParams.get('areaAfectada') ?? ''}
          onChange={(e) => setParam('areaAfectada', e.target.value)}
        />
      </div>

      {/* Fecha Desde */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="nc-fecha-desde">
          {t('filters.fechaDesdeLabel')}
        </label>
        <input
          id="nc-fecha-desde"
          type="date"
          className={`${inputBase} w-36`}
          value={searchParams.get('fechaDesde') ?? ''}
          onChange={(e) => setParam('fechaDesde', e.target.value)}
        />
      </div>

      {/* Fecha Hasta */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="nc-fecha-hasta">
          {t('filters.fechaHastaLabel')}
        </label>
        <input
          id="nc-fecha-hasta"
          type="date"
          className={`${inputBase} w-36`}
          value={searchParams.get('fechaHasta') ?? ''}
          onChange={(e) => setParam('fechaHasta', e.target.value)}
        />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClear}
          className="h-9 self-end rounded-md border border-hairline bg-canvas px-3 text-sm text-muted transition-colors hover:border-error/40 hover:text-error dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:text-error"
        >
          {t('filters.limpiar')}
        </button>
      )}
    </div>
  )
}
