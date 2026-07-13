import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { CLAUSULAS_ISO } from '../../../constants/clausulasISO.constants'
import type { NormaISO, NormativaVinculada } from '../types/qualityEvent.types'

interface NormativaVinculadaComboboxProps {
  value: NormativaVinculada | undefined
  onChange: (value: NormativaVinculada | undefined) => void
  ariaLabel: string
}

interface ClausulaOption {
  codigo: string
  titulo: string
}

type NormaCatalogada = 'ISO_9001_2015' | 'ISO_45001_2018'

function isNormaCatalogada(norma: NormaISO | undefined): norma is NormaCatalogada {
  return norma === 'ISO_9001_2015' || norma === 'ISO_45001_2018'
}

function flattenClausulas(norma: NormaCatalogada): ClausulaOption[] {
  const options: ClausulaOption[] = []
  for (const clausula of CLAUSULAS_ISO[norma]) {
    options.push({ codigo: clausula.codigo, titulo: clausula.titulo })
    for (const sub of clausula.subclausulas ?? []) {
      options.push({ codigo: sub.codigo, titulo: sub.titulo })
    }
  }
  return options
}

export function NormativaVinculadaCombobox({ value, onChange, ariaLabel }: NormativaVinculadaComboboxProps) {
  const { t } = useTranslation('qualityEvents')
  const [query, setQuery] = useState(value?.clausula ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const norma = value?.norma
  const catalogNorma = isNormaCatalogada(norma) ? norma : undefined

  // Reset the filter text when the norma changes, so a previous ISO's clause doesn't leak into the new catalog's filter
  useEffect(() => {
    setQuery(value?.clausula ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [norma])

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const clausulaOptions = useMemo(
    () => (catalogNorma ? flattenClausulas(catalogNorma) : []),
    [catalogNorma],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clausulaOptions
    return clausulaOptions.filter(
      (opt) => opt.codigo.toLowerCase().includes(q) || opt.titulo.toLowerCase().includes(q),
    )
  }, [clausulaOptions, query])

  const hasExactMatch = clausulaOptions.some((opt) => opt.codigo.toLowerCase() === query.trim().toLowerCase())

  const handleNormaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextNorma = e.target.value as NormaISO | ''
    setQuery('')
    if (!nextNorma) {
      onChange(undefined)
      return
    }
    onChange(
      nextNorma === 'OTRA'
        ? { norma: nextNorma, clausula: '', normaOtraDetalle: undefined }
        : { norma: nextNorma, clausula: '' },
    )
  }

  const handleSelectClausula = (opt: ClausulaOption) => {
    if (!catalogNorma) return
    onChange({ norma: catalogNorma, clausula: opt.codigo })
    setQuery(opt.codigo)
    setOpen(false)
  }

  const handleUseFreeText = () => {
    if (!catalogNorma) return
    const clausula = query.trim()
    onChange({ norma: catalogNorma, clausula })
    setOpen(false)
  }

  const handleClausulaLibreChange = (clausula: string) => {
    if (norma !== 'OTRA') return
    onChange({ norma, clausula, normaOtraDetalle: value?.normaOtraDetalle ?? undefined })
  }

  const handleNormaOtraDetalleChange = (normaOtraDetalle: string) => {
    if (norma !== 'OTRA') return
    onChange({ norma, clausula: value?.clausula ?? '', normaOtraDetalle: normaOtraDetalle || undefined })
  }

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'block text-sm font-medium text-body dark:text-on-dark-soft mb-1'

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass} htmlFor="normativaVinculada-norma">
          {t('form.fields.normaVinculada')}
        </label>
        <select
          id="normativaVinculada-norma"
          className={inputClass}
          value={norma ?? ''}
          onChange={handleNormaChange}
        >
          <option value="">{t('form.placeholders.select')}</option>
          <option value="ISO_9001_2015">ISO 9001:2015</option>
          <option value="ISO_45001_2018">ISO 45001:2018</option>
          <option value="OTRA">{t('form.normaOtra')}</option>
        </select>
      </div>

      {catalogNorma && (
        <div ref={containerRef} className="relative">
          <label className={labelClass} htmlFor="normativaVinculada-clausula">
            {t('form.fields.clausula')}
          </label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-on-dark-soft"
            />
            <input
              id="normativaVinculada-clausula"
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-label={ariaLabel}
              autoComplete="off"
              placeholder={t('form.placeholders.search')}
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              className={`${inputClass} pl-9`}
            />
          </div>
          {open && (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-hairline bg-canvas shadow-md dark:border-hairline/20 dark:bg-surface-dark-elevated"
            >
              {filtered.map((opt) => (
                <li
                  key={opt.codigo}
                  role="option"
                  aria-selected={opt.codigo === value?.clausula}
                  onMouseDown={() => handleSelectClausula(opt)}
                  className="flex cursor-pointer flex-col gap-0.5 px-3.5 py-2 text-sm hover:bg-surface-soft dark:hover:bg-surface-dark-soft"
                >
                  <span className="font-semibold text-ink dark:text-on-dark">§{opt.codigo}</span>
                  <span className="text-xs text-muted dark:text-on-dark-soft">{opt.titulo}</span>
                </li>
              ))}
              {query.trim() && !hasExactMatch && (
                <li
                  role="option"
                  aria-selected={false}
                  onMouseDown={handleUseFreeText}
                  className="cursor-pointer px-3.5 py-2 text-sm text-coral hover:bg-surface-soft dark:hover:bg-surface-dark-soft"
                >
                  {t('form.usarTextoLibre', { texto: query.trim() })}
                </li>
              )}
              {filtered.length === 0 && !query.trim() && (
                <li className="px-3.5 py-2.5 text-sm text-muted dark:text-on-dark-soft">
                  {t('form.placeholders.search')}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {norma === 'OTRA' && (
        <>
          <div>
            <label className={labelClass} htmlFor="normativaVinculada-clausula-libre">
              {t('form.fields.clausula')}
            </label>
            <input
              id="normativaVinculada-clausula-libre"
              type="text"
              className={inputClass}
              value={value?.clausula ?? ''}
              onChange={(e) => handleClausulaLibreChange(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="normativaVinculada-otraDetalle">
              {t('form.fields.normaOtraDetalle')} <span className="text-error">*</span>
            </label>
            <input
              id="normativaVinculada-otraDetalle"
              type="text"
              className={inputClass}
              placeholder={t('form.placeholders.normaOtraDetalle')}
              value={value?.normaOtraDetalle ?? ''}
              onChange={(e) => handleNormaOtraDetalleChange(e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  )
}
