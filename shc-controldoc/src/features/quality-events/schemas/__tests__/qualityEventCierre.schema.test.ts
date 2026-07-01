import { describe, it, expect } from 'vitest'
import { qualityEventCierreSchema } from '../qualityEventCierre.schema'

const LONG_RESULT = 'Resultado de cierre con descripción suficientemente larga para superar el mínimo de cien caracteres requerido por el schema'

describe('qualityEventCierreSchema', () => {
  it('rejects resultadoCierre shorter than 100 characters', () => {
    const result = qualityEventCierreSchema.safeParse({
      resultadoCierre: 'Muy corto',
      cerradoPorId: 'jc-1',
      cierreFirmaSupervisorId: 'sup-1',
      plazoVerificacionDias: 60,
    })
    expect(result.success).toBe(false)
  })

  it('rejects when cerradoPorId is absent', () => {
    const result = qualityEventCierreSchema.safeParse({
      resultadoCierre: LONG_RESULT,
      cierreFirmaSupervisorId: 'sup-1',
      plazoVerificacionDias: 60,
    })
    expect(result.success).toBe(false)
  })

  it('rejects when cierreFirmaSupervisorId is absent', () => {
    const result = qualityEventCierreSchema.safeParse({
      resultadoCierre: LONG_RESULT,
      cerradoPorId: 'jc-1',
      plazoVerificacionDias: 60,
    })
    expect(result.success).toBe(false)
  })

  it('applies default plazoVerificacionDias of 60 when not provided', () => {
    const result = qualityEventCierreSchema.parse({
      resultadoCierre: LONG_RESULT,
      cerradoPorId: 'jc-1',
      cierreFirmaSupervisorId: 'sup-1',
    })
    expect(result.plazoVerificacionDias).toBe(60)
  })

  it('accepts valid full payload', () => {
    const result = qualityEventCierreSchema.safeParse({
      resultadoCierre: LONG_RESULT,
      cerradoPorId: 'jc-1',
      cierreFirmaSupervisorId: 'sup-1',
      plazoVerificacionDias: 30,
    })
    expect(result.success).toBe(true)
  })
})
