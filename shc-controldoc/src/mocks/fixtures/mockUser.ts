import type { User } from '../../types/auth.types'

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-mock-001',
    nombre: 'Ana',
    apellido: 'Ramírez',
    email: 'ana.ramirez@shac.pe',
    rol: 'OPERARIO',
    createdAt: '2025-01-01T00:00:00.000Z',
    activo: true,
    ...overrides,
  }
}
