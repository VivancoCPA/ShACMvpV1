import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface SearchableOption {
  id: string
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  options: SearchableOption[]
  value: string | undefined
  onChange: (id: string | undefined) => void
  placeholder?: string
  ariaLabel: string
  id?: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  id,
  disabled = false,
}: SearchableSelectProps) {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.id === value)

  // When value is cleared externally, reset query
  useEffect(() => {
    if (!value) setQuery('')
  }, [value])

  const filtered = options.filter((o) => {
    const q = query.toLowerCase()
    return (
      o.label.toLowerCase().includes(q) ||
      (o.sublabel?.toLowerCase().includes(q) ?? false)
    )
  })

  const handleSelect = (opt: SearchableOption) => {
    onChange(opt.id)
    setQuery('')
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(undefined)
    setQuery('')
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    if (!open) setOpen(true)
    // Clear current selection when user starts typing
    if (value) onChange(undefined)
  }

  const handleFocus = () => {
    if (!disabled) setOpen(true)
  }

  // Close on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const displayValue = selectedOption ? selectedOption.label : query

  const inputClass = [
    'w-full rounded-md border border-hairline bg-canvas pl-9 py-2.5 text-sm text-ink h-10',
    'focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral',
    'dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark',
    value ? 'pr-8' : 'pr-3.5',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-on-dark-soft"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder ?? t('searchableSelect.searching')}
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleInputChange}
          className={inputClass}
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label={t('clear')}
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-hairline bg-canvas shadow-md dark:border-hairline/20 dark:bg-surface-dark-elevated"
        >
          {filtered.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-muted dark:text-on-dark-soft">
              {t('searchableSelect.noResults', { query })}
            </li>
          ) : (
            filtered.map((opt) => {
              const sub = opt.sublabel
                ? opt.sublabel.length > 60
                  ? opt.sublabel.slice(0, 60) + '…'
                  : opt.sublabel
                : undefined
              return (
                <li
                  key={opt.id}
                  role="option"
                  aria-selected={opt.id === value}
                  onMouseDown={() => handleSelect(opt)}
                  className="flex cursor-pointer flex-col gap-0.5 px-3.5 py-2 text-sm hover:bg-surface-soft dark:hover:bg-surface-dark-soft"
                >
                  <span className="font-semibold text-ink dark:text-on-dark">{opt.label}</span>
                  {sub && (
                    <span className="text-xs text-muted dark:text-on-dark-soft">{sub}</span>
                  )}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
