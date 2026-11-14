import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Cierra un panel desplegable no modal con clic/touch afuera y con Escape (devolviendo el foco
 * al botón disparador). Convención de `refs`: `[panelRef, triggerRef]` — el botón DEBE estar
 * incluido, si no el `mousedown` sobre él cerraría el panel y su `onClick` lo volvería a abrir.
 * Solo registra listeners mientras `open` es true (pendientes-qe-asignacion-y-menus D5).
 */
export function useDismissable(
  open: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement | null>[],
): void {
  // En una ref para no re-suscribir los listeners en cada render (los callers pasan arrows inline).
  const onCloseRef = useRef(onClose)
  const refsRef = useRef(refs)
  useEffect(() => {
    onCloseRef.current = onClose
    refsRef.current = refs
  })

  useEffect(() => {
    if (!open) return

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      const inside = refsRef.current.some((ref) => !!target && !!ref.current?.contains(target))
      if (!inside) onCloseRef.current()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onCloseRef.current()
      const trigger = refsRef.current[1]?.current ?? refsRef.current[0]?.current
      trigger?.focus()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])
}

/**
 * Cuál de varios paneles mutuamente excluyentes está abierto (o `null`), atado a la ruta en la
 * que se abrió: al cambiar `location.pathname` todos quedan cerrados sin un `useEffect` que llame
 * a setState (pendientes-qe-asignacion-y-menus D4).
 */
export function useRouteScopedMenu<K extends string>(): {
  openKey: K | null
  toggle: (key: K) => void
  close: () => void
} {
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState<{ key: K; pathname: string } | null>(null)
  const openKey = abierto && abierto.pathname === pathname ? abierto.key : null

  const toggle = useCallback(
    (key: K) =>
      setAbierto((current) =>
        current && current.key === key && current.pathname === pathname ? null : { key, pathname },
      ),
    [pathname],
  )
  const close = useCallback(() => setAbierto(null), [])

  return { openKey, toggle, close }
}

/** Variante de un solo panel de `useRouteScopedMenu`. */
export function useRouteScopedOpen(): { open: boolean; toggle: () => void; close: () => void } {
  const { openKey, toggle, close } = useRouteScopedMenu<'panel'>()
  return { open: openKey === 'panel', toggle: useCallback(() => toggle('panel'), [toggle]), close }
}
