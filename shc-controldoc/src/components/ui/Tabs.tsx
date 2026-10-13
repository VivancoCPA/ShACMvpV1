import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

export interface TabItem {
  id: string
  label: ReactNode
  /** Badge numérico junto a la etiqueta (p.ej. cantidad de items del panel). Omitido si `undefined`. */
  count?: number
  panel: ReactNode
}

interface TabsProps {
  tabs: TabItem[]
  activeId: string
  onChange: (id: string) => void
  /** Identificador para componer ids de DOM únicos cuando hay más de un `Tabs` en la página. */
  idPrefix?: string
}

/**
 * Componente mínimo de pestañas (detalle-documento-dos-columnas, D8) — no existía uno
 * reutilizable en el design system. Modelo de "activación automática": las flechas mueven el
 * foco Y activan la pestaña en el mismo paso (patrón común de `role="tablist"`, evita un
 * segundo Enter/Space). Solo el panel activo se monta en el DOM.
 */
export function Tabs({ tabs, activeId, onChange, idPrefix = 'tabs' }: TabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const activeIndex = tabs.findIndex((t) => t.id === activeId)
  const activeTab = tabs[activeIndex] ?? tabs[0]

  function focusAndActivate(index: number) {
    const target = tabs[(index + tabs.length) % tabs.length]
    if (!target) return
    onChange(target.id)
    tabRefs.current[target.id]?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        focusAndActivate(activeIndex + 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        focusAndActivate(activeIndex - 1)
        break
      case 'Home':
        e.preventDefault()
        focusAndActivate(0)
        break
      case 'End':
        e.preventDefault()
        focusAndActivate(tabs.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div>
      <div
        role="tablist"
        onKeyDown={handleKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-hairline px-2 dark:border-hairline/20"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab?.id
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm ${
                isActive
                  ? 'border-coral font-semibold text-ink dark:text-on-dark'
                  : 'border-transparent text-muted hover:text-body dark:text-on-dark-soft dark:hover:text-on-dark'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-surface-card px-1.5 text-xs text-muted dark:bg-surface-dark-elevated dark:text-on-dark-soft">
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeTab && (
        <div
          role="tabpanel"
          id={`${idPrefix}-panel-${activeTab.id}`}
          aria-labelledby={`${idPrefix}-tab-${activeTab.id}`}
        >
          {activeTab.panel}
        </div>
      )}
    </div>
  )
}
