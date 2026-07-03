import { describe, it, expect } from 'vitest'
import { firmarCierreSchema } from '../firmarCierre.schema'

describe('firmarCierreSchema', () => {
  it('rejects an invalid rol', () => {
    const result = firmarCierreSchema.safeParse({ rol: 'OPERARIO', pin: '1234' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('rol'))).toBe(true)
    }
  })

  it('rejects a pin with fewer than 4 characters', () => {
    const result = firmarCierreSchema.safeParse({ rol: 'JEFE_CALIDAD_SYST', pin: '12' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('pin'))).toBe(true)
    }
  })

  it('accepts a valid payload', () => {
    const result = firmarCierreSchema.safeParse({ rol: 'SUPERVISOR', pin: '1234' })
    expect(result.success).toBe(true)
  })
})
