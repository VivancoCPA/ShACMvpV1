import { describe, expect, it, vi } from 'vitest'
import { resolveUserDisplayName } from './userIdentity.fixtures'

vi.mock('./auth.fixtures', () => ({
  getUsersStore: () => [
    { id: 'user-supervisor-002', nombre: 'Diego', apellido: 'Salazar' },
    { id: 'user-001', nombre: 'Nombre En AuthFixtures', apellido: 'Gana' },
  ],
}))

describe('resolveUserDisplayName', () => {
  it('resolves a real authFixtures account', () => {
    expect(resolveUserDisplayName('user-supervisor-002')).toBe('Diego Salazar')
  })

  it('falls back to seedLegacyNames for a login-less legacy id', () => {
    expect(resolveUserDisplayName('user-002')).toBe('Carlos Mendoza')
  })

  it('prefers authFixtures over seedLegacyNames when an id exists in both', () => {
    expect(resolveUserDisplayName('user-001')).toBe('Nombre En AuthFixtures Gana')
  })

  it('falls back to the raw id when unmapped in both sources', () => {
    expect(resolveUserDisplayName('user-does-not-exist')).toBe('user-does-not-exist')
  })
})
