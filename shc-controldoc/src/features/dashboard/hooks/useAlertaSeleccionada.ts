import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// Tarjeta de "Requiere atención" seleccionada, en `?alerta=` para que sobreviva a F5 y se pueda
// compartir (dashboard-alertas-coherentes D1). Igual que usePeriodoKpi: `replace: true` y conserva
// los demás parámetros (p.ej. `periodo`).
export function useAlertaSeleccionada() {
  const [searchParams, setSearchParams] = useSearchParams()
  const alerta = searchParams.get('alerta')

  const escribir = useCallback(
    (valor: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (valor) next.set('alerta', valor)
          else next.delete('alerta')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const seleccionar = useCallback((id: string) => escribir(id), [escribir])
  const limpiar = useCallback(() => escribir(null), [escribir])
  const alternar = useCallback((id: string) => escribir(alerta === id ? null : id), [alerta, escribir])

  return { alerta, seleccionar, limpiar, alternar }
}

// Scroll suave al widget destino de una tarjeta; se llama desde el handler del clic, no desde un
// efecto (al recargar con `?alerta=` el filtro se aplica sin scroll — design.md D1).
export function scrollADestino(id: string): void {
  document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}
