import { describe, it, expect } from 'vitest'
import { updateUserSchema } from './updateUser.schema'

describe('updateUserSchema', () => {
  it('no expone ningún campo relacionado a contraseña', () => {
    expect(Object.keys(updateUserSchema.shape)).not.toEqual(
      expect.arrayContaining(['password', 'contraseña', 'temporaryPassword']),
    )
  })

  it('rechaza edición de SUPERVISOR con areaIds vacío', () => {
    const result = updateUserSchema.safeParse({
      nombre: 'Carla',
      apellido: 'Rojas',
      email: 'carla.rojas@shac.pe',
      rol: 'SUPERVISOR',
      areaId: 'Operaciones',
      areaIds: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('areaIds'))).toBe(true)
    }
  })

  it('acepta edición de rol distinto de SUPERVISOR', () => {
    const result = updateUserSchema.safeParse({
      nombre: 'Jorge',
      apellido: 'Lima',
      email: 'jorge.lima@shac.pe',
      rol: 'OPERARIO',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza edición sin nombre ni apellido', () => {
    const result = updateUserSchema.safeParse({
      email: 'jorge.lima@shac.pe',
      rol: 'OPERARIO',
    })
    expect(result.success).toBe(false)
  })
})
