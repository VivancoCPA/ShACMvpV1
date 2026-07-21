import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDebounce } from '../../../hooks/useDebounce'
import { useAuthStore } from '../../../stores/authStore'
import { useDocumentosPendientesCount } from '../hooks/useDocumentosPendientesCount'
import { FilterBar } from '../../../components/shared/FilterBar'
import { Switch } from '../../../components/ui/Switch'
import { DOC_STATUSES, DOC_TYPES } from '../constants'
import { useAreas } from '../../areas/hooks/useAreas'
import type { UserRole } from '../../../types/auth.types'

const CAN_SEE_DELETED: Set<UserRole> = new Set(['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION'])
const CAN_SEE_PENDIENTES: Set<UserRole> = new Set(['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO'])

const SELECT_CLASSES =
  'h-10 rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/50 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'

export function DocumentListFilters() {
  const { t } = useTranslation('documents')
  const [searchParams, setSearchParams] = useSearchParams()
  const userRole = useAuthStore((s) => s.user?.rol) as UserRole | undefined
  const { data: areas = [] } = useAreas()
  const areasActivas = areas.filter((a) => a.activo)

  const currentSearch = searchParams.get('search') ?? ''
  const currentEstado = searchParams.get('estado') ?? ''
  const currentTipo = searchParams.get('tipo') ?? ''
  const currentArea = searchParams.get('areaId') ?? ''
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const pendientesActive = searchParams.get('pendientes') === 'true'

  const showDeletedToggle = userRole !== undefined && CAN_SEE_DELETED.has(userRole)
  const showPendientes = userRole !== undefined && CAN_SEE_PENDIENTES.has(userRole)

  const { data: pendientesData } = useDocumentosPendientesCount()
  const pendientesCount = pendientesData?.count ?? 0

  const [searchInput, setSearchInput] = useState(
    () => searchParams.get('search') ?? ''
  )
  const debouncedSearch = useDebounce(searchInput, 300)
  const prevDebouncedSearch = useRef(debouncedSearch)

  useEffect(() => {
    if (prevDebouncedSearch.current === debouncedSearch) return
    prevDebouncedSearch.current = debouncedSearch
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (debouncedSearch) {
        next.set('search', debouncedSearch)
      } else {
        next.delete('search')
      }
      next.delete('page')
      return next
    })
  }, [debouncedSearch, setSearchParams])

  const hasActiveFilters =
    currentSearch !== '' || currentEstado !== '' || currentTipo !== '' || currentArea !== '' || pendientesActive

  const handleTogglePendientes = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (pendientesActive) {
        next.delete('pendientes')
      } else {
        next.set('pendientes', 'true')
        // Mutually exclusive with estado filter
        next.delete('estado')
      }
      next.delete('page')
      return next
    })
  }

  const toggleIncludeDeleted = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (includeDeleted) {
        next.delete('includeDeleted')
      } else {
        next.set('includeDeleted', 'true')
        // Disable estado filter when showing deleted
        next.delete('estado')
      }
      next.delete('page')
      return next
    })
  }

  const updateSelectParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      next.delete('page')
      return next
    })
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('search')
      next.delete('estado')
      next.delete('tipo')
      next.delete('areaId')
      next.delete('page')
      next.delete('includeDeleted')
      next.delete('pendientes')
      return next
    })
  }

  return (
    <FilterBar>
      {showPendientes && (
        <button
          type="button"
          onClick={handleTogglePendientes}
          title={
            pendientesCount > 0
              ? t('pendientes.filtroCon', { count: pendientesCount })
              : t('pendientes.filtro')
          }
          className={`flex h-10 items-center gap-2 self-end rounded-md border px-4 text-sm font-medium transition-colors ${
            pendientesActive
              ? 'border-amber bg-amber/10 text-amber dark:border-amber dark:bg-amber/10 dark:text-amber'
              : 'border-hairline bg-canvas text-muted hover:border-amber/60 hover:text-amber dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:text-amber'
          }`}
        >
          <span aria-hidden="true">⏳</span>
          {pendientesCount > 0
            ? t('pendientes.filtroCon', { count: pendientesCount })
            : t('pendientes.filtro')}
        </button>
      )}
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <label
          htmlFor="doc-search"
          className="text-xs font-medium text-muted dark:text-on-dark-soft"
        >
          {t('list.filters.searchLabel')}
        </label>
        <input
          id="doc-search"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('list.filters.searchPlaceholder')}
          aria-label={t('list.filters.searchLabel')}
          className="h-10 rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral/50 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:placeholder:text-on-dark-soft"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="doc-estado"
          className="text-xs font-medium text-muted dark:text-on-dark-soft"
        >
          {t('list.filters.estadoLabel')}
        </label>
        <select
          id="doc-estado"
          value={includeDeleted || pendientesActive ? '' : currentEstado}
          onChange={(e) => updateSelectParam('estado', e.target.value)}
          disabled={includeDeleted || pendientesActive}
          title={includeDeleted ? t('deleted.toggle.disabledEstadoTooltip') : undefined}
          className={`${SELECT_CLASSES} ${includeDeleted || pendientesActive ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          <option value="">{t('list.filters.todos')}</option>
          {DOC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="doc-tipo"
          className="text-xs font-medium text-muted dark:text-on-dark-soft"
        >
          {t('list.filters.tipoLabel')}
        </label>
        <select
          id="doc-tipo"
          value={currentTipo}
          onChange={(e) => updateSelectParam('tipo', e.target.value)}
          className={SELECT_CLASSES}
        >
          <option value="">{t('list.filters.todos')}</option>
          {DOC_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="doc-area"
          className="text-xs font-medium text-muted dark:text-on-dark-soft"
        >
          {t('list.filters.areaLabel')}
        </label>
        <select
          id="doc-area"
          value={currentArea}
          onChange={(e) => updateSelectParam('areaId', e.target.value)}
          className={SELECT_CLASSES}
        >
          <option value="">{t('list.filters.todos')}</option>
          {areasActivas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && !includeDeleted && (
        <button
          type="button"
          onClick={handleClearFilters}
          className="h-10 rounded-md border border-hairline bg-canvas px-4 text-sm text-muted transition-colors hover:border-coral/50 hover:text-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:text-coral"
        >
          {t('list.filters.limpiar')}
        </button>
      )}

      {showDeletedToggle && (
        <div className="ml-auto self-end">
          <Switch
            id="toggle-eliminados"
            checked={includeDeleted}
            onChange={toggleIncludeDeleted}
            label={t('deleted.toggle.label')}
            danger
          />
        </div>
      )}
    </FilterBar>
  )
}
