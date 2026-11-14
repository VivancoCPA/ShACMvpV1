import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useAlertaSeleccionada } from './useAlertaSeleccionada'

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  return renderHook(() => ({ hook: useAlertaSeleccionada(), location: useLocation() }), { wrapper })
}

describe('useAlertaSeleccionada', () => {
  it('reads ?alerta= from the URL', () => {
    const { result } = setup('/dashboard?alerta=aprobaciones')
    expect(result.current.hook.alerta).toBe('aprobaciones')
  })

  it('seleccionar keeps the other params', () => {
    const { result } = setup('/dashboard?periodo=anio')
    act(() => result.current.hook.seleccionar('aprobaciones'))
    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('periodo')).toBe('anio')
    expect(params.get('alerta')).toBe('aprobaciones')
  })

  it('alternar on the active alert clears it', () => {
    const { result } = setup('/dashboard?alerta=aprobaciones&periodo=mes')
    act(() => result.current.hook.alternar('aprobaciones'))
    const params = new URLSearchParams(result.current.location.search)
    expect(params.has('alerta')).toBe(false)
    expect(params.get('periodo')).toBe('mes')
  })

  it('alternar on another alert selects it', () => {
    const { result } = setup('/dashboard?alerta=aprobaciones')
    act(() => result.current.hook.alternar('acVencidas'))
    expect(result.current.hook.alerta).toBe('acVencidas')
  })

  it('limpiar removes the param', () => {
    const { result } = setup('/dashboard?alerta=x')
    act(() => result.current.hook.limpiar())
    expect(result.current.hook.alerta).toBeNull()
  })
})
