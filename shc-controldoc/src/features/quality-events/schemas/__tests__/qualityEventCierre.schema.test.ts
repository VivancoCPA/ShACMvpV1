import { describe, it, expect } from 'vitest'
import { qualityEventCierreFormSchema } from '../qualityEventCierre.schema'

const LONG_RESULT = 'Resultado de cierre con descripción suficientemente larga para superar el mínimo de cien caracteres requerido por el schema'

describe('qualityEventCierreFormSchema', () => {
  it('rejects resultadoCierre shorter than 100 characters', () => {
    const result = qualityEventCierreFormSchema.safeParse({
      resultadoCierre: 'Muy corto',
      plazoVerificacionDias: 60,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('resultadoCierre'))).toBe(true)
    }
  })

  it('applies default plazoVerificacionDias of 60 when not provided', () => {
    const result = qualityEventCierreFormSchema.parse({
      resultadoCierre: LONG_RESULT,
    })
    expect(result.plazoVerificacionDias).toBe(60)
  })

  it('accepts a valid full payload', () => {
    const result = qualityEventCierreFormSchema.safeParse({
      resultadoCierre: LONG_RESULT,
      plazoVerificacionDias: 90,
    })
    expect(result.success).toBe(true)
  })

  it('rejects resultadoCierre over 500 characters', () => {
    const result = qualityEventCierreFormSchema.safeParse({
      resultadoCierre: 'x'.repeat(501),
      plazoVerificacionDias: 60,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('resultadoCierre'))).toBe(true)
    }
  })
})
