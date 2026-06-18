import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDebounce } from '../../../hooks/useDebounce'
import { AREAS_SHAC, DOC_STATUSES, DOC_TYPES } from '../constants'

const SELECT_CLASSES =
  'h-10 rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/50 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'

export function DocumentListFilters() {
  const { t } = useTranslation('documents')
  const [searchParams, setSearchParams] = useSearchParams()

  const currentSearch = searchParams.get('search') ?? ''
  const currentEstado = searchParams.get('estado') ?? ''
  const currentTipo = searchParams.get('tipo') ?? ''
  const currentArea = searchParams.get('area') ?? ''

  const [searchInput, setSearchInput] = useState(currentSearch)
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
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
    currentSearch !== '' || currentEstado !== '' || currentTipo !== '' || currentArea !== ''

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
      next.delete('area')
      next.delete('page')
      return next
    })
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-hairline bg-canvas p-4 dark:border-hairline/20 dark:bg-surface-dark-elevated">
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
          value={currentEstado}
          onChange={(e) => updateSelectParam('estado', e.target.value)}
          className={SELECT_CLASSES}
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
          onChange={(e) => updateSelectParam('area', e.target.value)}
          className={SELECT_CLASSES}
        >
          <option value="">{t('list.filters.todos')}</option>
          {AREAS_SHAC.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearFilters}
          className="h-10 rounded-md border border-hairline bg-canvas px-4 text-sm text-muted transition-colors hover:border-coral/50 hover:text-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:text-coral"
        >
          {t('list.filters.limpiar')}
        </button>
      )}
    </div>
  )
}
