import { describe, it, expect } from 'vitest'
import { puedeAdministrarLocales, puedeConsultarLocales } from './localesPermissions'
import type { User, UserRole } from '../../../types/auth.types'

function buildUser(rol: UserRole): User {
  return {
    id: 'user-1',
    nombre: 'Test',
    apellido: 'User',
    email: 'test@shac.pe',
    rol,
  }
}

describe('puedeAdministrarLocales', () => {
  it('retorna true para ADMINISTRADOR_SISTEMA', () => {
    expect(puedeAdministrarLocales(buildUser('ADMINISTRADOR_SISTEMA'))).toBe(true)
  })

  it('retorna false para JEFE_CALIDAD_SYST', () => {
    expect(puedeAdministrarLocales(buildUser('JEFE_CALIDAD_SYST'))).toBe(false)
  })

  const otrosRoles: UserRole[] = [
    'OPERARIO',
    'SUPERVISOR',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
    'ALTA_DIRECCION',
  ]

  it.each(otrosRoles)('retorna false para %s', (rol) => {
    expect(puedeAdministrarLocales(buildUser(rol))).toBe(false)
  })
})

describe('puedeConsultarLocales', () => {
  it('retorna true para ADMINISTRADOR_SISTEMA', () => {
    expect(puedeConsultarLocales(buildUser('ADMINISTRADOR_SISTEMA'))).toBe(true)
  })

  it('retorna true para JEFE_CALIDAD_SYST pero puedeAdministrarLocales retorna false (RN-ZON-004)', () => {
    const usuario = buildUser('JEFE_CALIDAD_SYST')
    expect(puedeConsultarLocales(usuario)).toBe(true)
    expect(puedeAdministrarLocales(usuario)).toBe(false)
  })

  const otrosRoles: UserRole[] = [
    'OPERARIO',
    'SUPERVISOR',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
  ]

  it.each(otrosRoles)('retorna false para %s', (rol) => {
    expect(puedeConsultarLocales(buildUser(rol))).toBe(false)
  })

  it('retorna false para ALTA_DIRECCION', () => {
    expect(puedeConsultarLocales(buildUser('ALTA_DIRECCION'))).toBe(false)
  })
})
