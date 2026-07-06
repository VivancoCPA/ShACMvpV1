import { describe, it, expect } from 'vitest'
import { getDefaultRouteForRole } from './getDefaultRoute'

describe('getDefaultRouteForRole', () => {
  it('retorna /admin/locales para ADMINISTRADOR_SISTEMA', () => {
    expect(getDefaultRouteForRole('ADMINISTRADOR_SISTEMA')).toBe('/admin/locales')
  })

  it('retorna /documentos para roles operativos', () => {
    expect(getDefaultRouteForRole('JEFE_CALIDAD_SYST')).toBe('/documentos')
  })
})
