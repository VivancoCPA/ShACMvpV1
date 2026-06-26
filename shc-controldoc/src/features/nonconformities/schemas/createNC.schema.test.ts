import { describe, it, expect } from 'vitest'
import { createNCSchema } from './createNC.schema'

const validPayload = {
  dominio: 'CALIDAD' as const,
  origen: 'INSPECCION_INTERNA' as const,
  tipo: 'PROCESO' as const,
  severidad: 'BAJA' as const,
  areaAfectada: 'Almacén de minerales',
  descripcion: 'Descripción válida con más de diez caracteres.',
  fechaDeteccion: '2025-01-15T08:00:00Z',
}

describe('createNCSchema', () => {
  it('accepts a valid payload', () => {
    const result = createNCSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('defaults documentosVinculados to []', () => {
    const result = createNCSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.documentosVinculados).toEqual([])
    }
  })

  it('rejects missing origen', () => {
    const { origen: _origen, ...withoutOrigen } = validPayload
    const result = createNCSchema.safeParse(withoutOrigen)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('origen')
    }
  })

  it('rejects descripcion shorter than 10 characters', () => {
    const result = createNCSchema.safeParse({ ...validPayload, descripcion: 'Corto' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('descripcion')
    }
  })

  it('accepts valid payload without optional fields', () => {
    const result = createNCSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mineralInvolucrado).toBeUndefined()
      expect(result.data.turno).toBeUndefined()
    }
  })
})
