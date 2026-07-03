import { describe, it, expect } from 'vitest'
import { verificacionEficaciaSchema } from '../verificacionEficacia.schema'

describe('verificacionEficaciaSchema', () => {
  it('rejects empty evidencia', () => {
    const result = verificacionEficaciaSchema.safeParse({ resultado: 'EFECTIVO', evidencia: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('evidencia'))).toBe(true)
    }
  })

  it('rejects an invalid resultado', () => {
    const result = verificacionEficaciaSchema.safeParse({ resultado: 'PARCIAL', evidencia: 'Texto' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('resultado'))).toBe(true)
    }
  })

  it('accepts a valid NO_EFECTIVO payload', () => {
    const result = verificacionEficaciaSchema.safeParse({
      resultado: 'NO_EFECTIVO',
      evidencia: 'Se detectó recurrencia del defecto',
    })
    expect(result.success).toBe(true)
  })
})
