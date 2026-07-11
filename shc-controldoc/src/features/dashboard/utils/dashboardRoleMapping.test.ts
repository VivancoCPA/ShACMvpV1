import { describe, it, expect } from 'vitest'
import { getDashboardDataTypeForRole } from './dashboardRoleMapping'

describe('getDashboardDataTypeForRole', () => {
  it('maps OPERARIO to OPERARIO', () => {
    expect(getDashboardDataTypeForRole('OPERARIO')).toBe('OPERARIO')
  })

  it('maps SUPERVISOR to SUPERVISOR', () => {
    expect(getDashboardDataTypeForRole('SUPERVISOR')).toBe('SUPERVISOR')
  })

  it('maps JEFE_CALIDAD_SYST to JEFE_CALIDAD', () => {
    expect(getDashboardDataTypeForRole('JEFE_CALIDAD_SYST')).toBe('JEFE_CALIDAD')
  })

  it('maps JEFE_CONTROL_DOCUMENTARIO to its own JEFE_CONTROL_DOC dashboard', () => {
    expect(getDashboardDataTypeForRole('JEFE_CONTROL_DOCUMENTARIO')).toBe('JEFE_CONTROL_DOC')
  })

  it('maps AUDITOR_INTERNO to AUDITOR', () => {
    expect(getDashboardDataTypeForRole('AUDITOR_INTERNO')).toBe('AUDITOR')
  })

  it('maps ALTA_DIRECCION to ALTA_DIRECCION', () => {
    expect(getDashboardDataTypeForRole('ALTA_DIRECCION')).toBe('ALTA_DIRECCION')
  })

  it('returns undefined for ADMINISTRADOR_SISTEMA (sin acceso a /dashboard)', () => {
    expect(getDashboardDataTypeForRole('ADMINISTRADOR_SISTEMA')).toBeUndefined()
  })
})
