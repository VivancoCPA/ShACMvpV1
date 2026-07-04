import { describe, it, expect } from 'vitest'
import { qualityEventEditReporteInicialSchema } from '../qualityEventEditReporteInicial.schema'

describe('qualityEventEditReporteInicialSchema', () => {
  it('accepts a valid payload with only RN-QE-010 fields', () => {
    const result = qualityEventEditReporteInicialSchema.safeParse({
      descripcion: 'Descripción corregida del evento',
      areaAfectada: 'Almacén Norte',
      turno: 'TARDE',
      fechaHoraEvento: '2026-05-01T08:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a payload containing numero', () => {
    const result = qualityEventEditReporteInicialSchema.safeParse({
      descripcion: 'Descripción corregida del evento',
      areaAfectada: 'Almacén',
      turno: 'DIA',
      fechaHoraEvento: '2026-05-01T08:00:00Z',
      numero: 'QE-2026-010',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a payload containing severidad', () => {
    const result = qualityEventEditReporteInicialSchema.safeParse({
      descripcion: 'Descripción corregida del evento',
      areaAfectada: 'Almacén',
      turno: 'DIA',
      fechaHoraEvento: '2026-05-01T08:00:00Z',
      severidad: 'CRITICA',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a payload containing origen, tipo, fechaHoraReporte or reportadoPorId', () => {
    for (const extra of [
      { origen: 'O1_INCIDENTE_CAMPO' },
      { tipo: 'CALIDAD' },
      { fechaHoraReporte: '2026-05-01T08:00:00Z' },
      { reportadoPorId: 'user-001' },
    ]) {
      const result = qualityEventEditReporteInicialSchema.safeParse({
        descripcion: 'Descripción corregida del evento',
        areaAfectada: 'Almacén',
        turno: 'DIA',
        fechaHoraEvento: '2026-05-01T08:00:00Z',
        ...extra,
      })
      expect(result.success).toBe(false)
    }
  })

  it('rejects descripcion shorter than 10 characters', () => {
    const result = qualityEventEditReporteInicialSchema.safeParse({
      descripcion: 'Corto',
      areaAfectada: 'Almacén',
      turno: 'DIA',
      fechaHoraEvento: '2026-05-01T08:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('accepts an empty payload (all fields optional)', () => {
    expect(qualityEventEditReporteInicialSchema.safeParse({}).success).toBe(true)
  })
})
