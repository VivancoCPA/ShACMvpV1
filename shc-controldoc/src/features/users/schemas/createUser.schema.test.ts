import { describe, it, expect } from 'vitest'
import { createUserSchema } from './createUser.schema'

describe('createUserSchema', () => {
  it('rechaza alta de SUPERVISOR sin areaIds', () => {
    const result = createUserSchema.safeParse({
      nombre: 'Carla',
      apellido: 'Rojas',
      email: 'carla.rojas@shac.pe',
      rol: 'SUPERVISOR',
      areaId: 'Operaciones',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('areaIds'))).toBe(true)
    }
  })

  it('acepta alta de rol distinto de SUPERVISOR sin area ni areaIds', () => {
    const result = createUserSchema.safeParse({
      nombre: 'Jorge',
      apellido: 'Lima',
      email: 'jorge.lima@shac.pe',
      rol: 'OPERARIO',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza email con formato inválido', () => {
    const result = createUserSchema.safeParse({
      nombre: 'Jorge',
      apellido: 'Lima',
      email: 'no-es-un-email',
      rol: 'OPERARIO',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('email'))).toBe(true)
    }
  })

  it('acepta alta de SUPERVISOR con area y areaIds', () => {
    const result = createUserSchema.safeParse({
      nombre: 'Carla',
      apellido: 'Rojas',
      email: 'carla.rojas@shac.pe',
      rol: 'SUPERVISOR',
      areaId: 'Operaciones',
      areaIds: ['Galpón B'],
    })
    expect(result.success).toBe(true)
  })
})
