import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useDebounce } from '../../hooks/useDebounce'
import { useDocuments } from '../../features/documents/hooks/useDocuments'
import { useNonconformities } from '../../features/nonconformities/hooks/useNonconformities'

interface DocumentoNCComboboxProps {
  mode: 'document-search-nc' | 'nc-search-document'
  linkedIds: string[]
  onSelect: (id: string) => void
  ariaLabel: string
}

interface ResultOption {
  id: string
  primary: string
  secondary: string
}

const inputClass =
  'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 pl-9 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'

export function DocumentoNCCombobox({ mode, linkedIds, onSelect, ariaLabel }: DocumentoNCComboboxProps) {
  const { t } = useTranslation(mode === 'document-search-nc' ? 'documents' : 'nonconformities')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 300)
  const searchActive = open && debouncedQuery.trim().length > 0

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Both hooks are always called (rules of hooks) — only the one matching `mode`, while the
  // search is active, actually fetches; the other stays idle via TanStack Query's `enabled: false`.
  const ncQuery = useNonconformities(
    { search: debouncedQuery, page: 1, pageSize: 10 },
    searchActive && mode === 'document-search-nc',
  )
  const documentsQuery = useDocuments(
    { search: debouncedQuery, pageSize: 10 },
    searchActive && mode === 'nc-search-document',
  )

  const isSearching = mode === 'document-search-nc' ? ncQuery.isFetching : documentsQuery.isFetching

  const results: ResultOption[] =
    mode === 'document-search-nc'
      ? (ncQuery.data?.items ?? [])
          .filter((nc) => !linkedIds.includes(nc.id))
          .map((nc) => ({ id: nc.id, primary: nc.numero, secondary: `${nc.tipo} · ${nc.severidad} · ${nc.estado}` }))
      : (documentsQuery.data?.items ?? [])
          .filter((doc) => !linkedIds.includes(doc.id))
          .map((doc) => ({ id: doc.id, primary: doc.codigo, secondary: doc.titulo }))

  const handleSelect = (id: string) => {
    onSelect(id)
    setQuery('')
    setOpen(false)
  }

  const placeholder =
    mode === 'document-search-nc'
      ? t('ncVinculados.combobox.placeholder')
      : t('documentosVinculados.combobox.placeholder')

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-on-dark-soft"
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          className={inputClass}
        />
      </div>

      {searchActive && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-hairline bg-canvas shadow-md dark:border-hairline/20 dark:bg-surface-dark-elevated"
        >
          {isSearching && (
            <li className="px-3.5 py-2.5 text-sm text-muted dark:text-on-dark-soft">
              {t('common:searchableSelect.searching')}
            </li>
          )}

          {!isSearching &&
            results.map((opt) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={false}
                onMouseDown={() => handleSelect(opt.id)}
                className="flex cursor-pointer flex-col gap-0.5 px-3.5 py-2 text-sm hover:bg-surface-soft dark:hover:bg-surface-dark-soft"
              >
                <span className="font-mono font-semibold text-ink dark:text-on-dark">{opt.primary}</span>
                <span className="text-xs text-muted dark:text-on-dark-soft">{opt.secondary}</span>
              </li>
            ))}

          {!isSearching && results.length === 0 && (
            <li className="px-3.5 py-2.5 text-sm text-muted dark:text-on-dark-soft">
              {t('common:searchableSelect.noResults', { query: debouncedQuery })}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
