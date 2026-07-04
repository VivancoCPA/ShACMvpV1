import { describe, it, expect } from 'vitest'
import { qualityEventEditSeveridadSchema } from '../qualityEventEditSeveridad.schema'

describe('qualityEventEditSeveridadSchema', () => {
  it('accepts a valid severidad value', () => {
    expect(qualityEventEditSeveridadSchema.safeParse({ severidad: 'CRITICA' }).success).toBe(true)
  })

  it('rejects an invalid severidad value', () => {
    expect(qualityEventEditSeveridadSchema.safeParse({ severidad: 'URGENTE' }).success).toBe(false)
  })

  it('rejects an extra field', () => {
    const result = qualityEventEditSeveridadSchema.safeParse({
      severidad: 'ALTA',
      mineralInvolucrado: 'Cobre',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing severidad', () => {
    expect(qualityEventEditSeveridadSchema.safeParse({}).success).toBe(false)
  })
})
