import { describe, it, expect } from 'vitest'
import { getDefaultRouteForRole } from './getDefaultRoute'

describe('getDefaultRouteForRole', () => {
  it('retorna /usuarios para ADMINISTRADOR_SISTEMA', () => {
    expect(getDefaultRouteForRole('ADMINISTRADOR_SISTEMA')).toBe('/usuarios')
  })

  it('retorna /dashboard para roles operativos', () => {
    expect(getDefaultRouteForRole('JEFE_CALIDAD_SYST')).toBe('/dashboard')
  })
})
