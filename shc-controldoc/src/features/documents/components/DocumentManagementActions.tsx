import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDismissable, useRouteScopedOpen } from '../../../hooks/useDismissable'
import type { ManagementActionItem } from '../utils/documentManagementActions'

const VARIANT_CLASSES: Record<ManagementActionItem['variant'], string> = {
  primary: 'bg-coral text-white hover:bg-coral-dark',
  secondary:
    'border border-hairline bg-canvas text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated',
  danger: 'border border-error bg-error/10 text-error hover:bg-error/20 dark:border-error/30',
  success: 'bg-success text-white hover:opacity-90',
}

interface DocumentManagementActionsProps {
  /** Ya ordenados por prioridad (design.md D7) — este componente solo decide el corte inline/⋯. */
  items: ManagementActionItem[]
}

/**
 * Botones de gestión del encabezado fijo (detalle-documento-dos-columnas): como máximo las 2
 * primeras acciones de `items` se muestran inline; el resto va a un menú "⋯". Sin lógica de
 * permisos propia — `items` ya viene resuelto por `getManagementActionItems`.
 */
export function DocumentManagementActions({ items }: DocumentManagementActionsProps) {
  const { t } = useTranslation('documents')
  const { open: menuOpen, toggle: toggleMenu, close: closeMenu } = useRouteScopedOpen()
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  useDismissable(menuOpen, closeMenu, [menuRef, triggerRef])

  if (items.length === 0) return null

  const inline = items.slice(0, 2)
  const overflow = items.slice(2)

  return (
    <div className="flex items-center gap-2">
      {inline.map((item) => (
        <span key={item.id} title={item.disabledTitle}>
          <button
            type="button"
            disabled={item.disabled}
            onClick={item.onClick}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[item.variant]}`}
          >
            {item.label}
          </button>
        </span>
      ))}

      {overflow.length > 0 && (
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            aria-label={t('detail.menu.masAcciones')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={toggleMenu}
            className="rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            ⋯
          </button>

          {/* Clic afuera, Escape y navegación cierran el menú (useDismissable/useRouteScopedOpen,
              pendientes-qe-asignacion-y-menus) — reemplaza el overlay invisible anterior. */}
          {menuOpen && (
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-hairline bg-canvas py-1 shadow-lg dark:border-hairline/20 dark:bg-surface-dark-elevated"
            >
              {overflow.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  title={item.disabledTitle}
                  onClick={() => {
                    item.onClick()
                    closeMenu()
                  }}
                  className={`block w-full px-4 py-2 text-left text-sm hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-surface-dark-elevated ${
                    item.variant === 'danger' ? 'text-error' : 'text-ink dark:text-on-dark'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
