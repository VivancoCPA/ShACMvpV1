import { describe, it, expect } from 'vitest'
import { qualityEventEditMineralSchema } from '../qualityEventEditMineral.schema'

describe('qualityEventEditMineralSchema', () => {
  it('accepts a valid mineralInvolucrado value', () => {
    expect(qualityEventEditMineralSchema.safeParse({ mineralInvolucrado: 'Cobre' }).success).toBe(true)
  })

  it('rejects an empty mineralInvolucrado', () => {
    expect(qualityEventEditMineralSchema.safeParse({ mineralInvolucrado: '' }).success).toBe(false)
  })

  it('rejects an extra field', () => {
    const result = qualityEventEditMineralSchema.safeParse({
      mineralInvolucrado: 'Cobre',
      severidad: 'ALTA',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing mineralInvolucrado', () => {
    expect(qualityEventEditMineralSchema.safeParse({}).success).toBe(false)
  })
})
