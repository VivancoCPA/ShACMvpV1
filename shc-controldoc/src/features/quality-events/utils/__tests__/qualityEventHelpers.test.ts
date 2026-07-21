import { describe, it, expect } from 'vitest'
import { requiereNotificacionUrgente, estaVencidaVerificacion } from '../qualityEventHelpers'
import type { QualityEvent } from '../../types/qualityEvent.types'

const baseQE: QualityEvent = {
  id: 'qe-1',
  numero: 'QE-2025-001',
  origen: 'O1_INCIDENTE_CAMPO',
  tipo: 'SST',
  severidad: 'ALTA',
  estado: 'EN_VERIFICACION',
  ciclo: 1,
  descripcion: 'Descripción del evento',
  areaId: 'area-001',
  turno: 'DIA',
  fechaHoraEvento: '2025-06-01T08:00:00Z',
  fechaHoraReporte: '2025-06-01T09:00:00Z',
  reportadoPorId: 'user-1',
  documentosVinculados: [],
  requiereEvaluacionRiesgos: false,
  solicitudesAC: 0,
  accionesCorrectivas: [],
  auditTrail: [],
  creadoEn: '2025-06-01T09:00:00Z',
  actualizadoEn: '2025-06-01T09:00:00Z',
}

describe('requiereNotificacionUrgente (RN-QE-005)', () => {
  it('returns true for severidad CRITICA', () => {
    expect(requiereNotificacionUrgente({ ...baseQE, severidad: 'CRITICA' })).toBe(true)
  })

  it('returns false for severidad ALTA', () => {
    expect(requiereNotificacionUrgente({ ...baseQE, severidad: 'ALTA' })).toBe(false)
  })

  it('returns false for severidad MEDIA', () => {
    expect(requiereNotificacionUrgente({ ...baseQE, severidad: 'MEDIA' })).toBe(false)
  })

  it('returns false for severidad BAJA', () => {
    expect(requiereNotificacionUrgente({ ...baseQE, severidad: 'BAJA' })).toBe(false)
  })
})

describe('estaVencidaVerificacion (RN-QE-008)', () => {
  it('returns true when 11+ business days have passed without realizacion', () => {
    // 2025-06-02 (Mon) to 2025-06-17 (Tue) = 11 business days
    const result = estaVencidaVerificacion(
      { ...baseQE, fechaVerificacionProgramada: '2025-06-02', fechaVerificacionRealizada: undefined },
      new Date('2025-06-17'),
    )
    expect(result).toBe(true)
  })

  it('returns false when fechaVerificacionRealizada is present', () => {
    const result = estaVencidaVerificacion(
      {
        ...baseQE,
        fechaVerificacionProgramada: '2025-06-02',
        fechaVerificacionRealizada: '2025-06-05',
      },
      new Date('2025-06-17'),
    )
    expect(result).toBe(false)
  })

  it('returns false when fechaVerificacionProgramada is absent', () => {
    const result = estaVencidaVerificacion(
      { ...baseQE, fechaVerificacionProgramada: undefined, fechaVerificacionRealizada: undefined },
      new Date('2025-06-17'),
    )
    expect(result).toBe(false)
  })

  it('returns false when fewer than 10 business days have passed', () => {
    // 2025-06-09 (Mon) to 2025-06-17 (Tue) = 6 business days
    const result = estaVencidaVerificacion(
      { ...baseQE, fechaVerificacionProgramada: '2025-06-09', fechaVerificacionRealizada: undefined },
      new Date('2025-06-17'),
    )
    expect(result).toBe(false)
  })
})
