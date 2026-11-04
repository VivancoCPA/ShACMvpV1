import { describe, it, expect } from 'vitest'
import { getIncidentQEAlertLevel, getIncidentQEPlazoInfo, PLAZO_QE_HORAS } from './incidentQEAlert'
import type { Incidente } from '../types/incident.types'

function makeIncidente(overrides: Partial<Incidente> = {}): Incidente {
  return {
    id: 'inc-003',
    numero: 'INC-2026-003',
    tipo: 'INCIDENTE',
    estado: 'ABIERTO',
    severidad: 'MEDIA',
    descripcion: 'Descripción de prueba para el incidente',
    areaId: 'area-001',
    empresaId: 'empresa-001',
    turno: 'DIA',
    fechaEvento: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-1',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function hoursAgo(hours: number, from = new Date('2026-01-03T00:00:00Z')): string {
  return new Date(from.getTime() - hours * 60 * 60 * 1000).toISOString()
}

const NOW = new Date('2026-01-03T00:00:00Z')

describe('getIncidentQEAlertLevel — RN-INC-006', () => {
  it('is NONE when the incident already has a qeId, no matter how overdue', () => {
    const incidente = makeIncidente({ tipo: 'ACCIDENTE', fechaEvento: hoursAgo(999), qeId: 'qe-2026-005' })
    expect(getIncidentQEAlertLevel(incidente, NOW)).toBe('NONE')
  })

  it('is NONE for a deleted incident, no matter how overdue', () => {
    const incidente = makeIncidente({
      tipo: 'ACCIDENTE',
      fechaEvento: hoursAgo(999),
      qeId: undefined,
      deletedAt: '2026-01-02T00:00:00Z',
    })
    expect(getIncidentQEAlertLevel(incidente, NOW)).toBe('NONE')
  })

  it('is NONE for a CERRADO incident, no matter how overdue (mirrors canCrearQE)', () => {
    const incidente = makeIncidente({ tipo: 'ACCIDENTE', estado: 'CERRADO', fechaEvento: hoursAgo(999) })
    expect(getIncidentQEAlertLevel(incidente, NOW)).toBe('NONE')
  })

  it('is NONE for an ANULADO incident, no matter how overdue', () => {
    const incidente = makeIncidente({ tipo: 'ACCIDENTE', estado: 'ANULADO', fechaEvento: hoursAgo(999) })
    expect(getIncidentQEAlertLevel(incidente, NOW)).toBe('NONE')
  })

  it('is NONE well within the ACCIDENTE (24h) plazo', () => {
    const incidente = makeIncidente({ tipo: 'ACCIDENTE', fechaEvento: hoursAgo(2) })
    expect(getIncidentQEAlertLevel(incidente, NOW)).toBe('NONE')
  })

  it('is AMARILLO once past 75% of the ACCIDENTE (24h) plazo', () => {
    const incidente = makeIncidente({ tipo: 'ACCIDENTE', fechaEvento: hoursAgo(19) })
    expect(getIncidentQEAlertLevel(incidente, NOW)).toBe('AMARILLO')
  })

  it('is ROJO once the ACCIDENTE (24h) plazo is exceeded', () => {
    const incidente = makeIncidente({ tipo: 'ACCIDENTE', fechaEvento: hoursAgo(25) })
    expect(getIncidentQEAlertLevel(incidente, NOW)).toBe('ROJO')
  })

  it.each([
    ['ACCIDENTE', 24],
    ['INCIDENTE', 48],
    ['CUASI_ACCIDENTE', 72],
    ['CONDICION_INSEGURA', 48],
  ] as const)('uses the %s plazo of %dh from the PRD table', (tipo, horas) => {
    expect(PLAZO_QE_HORAS[tipo]).toBe(horas)
    const justUnder = makeIncidente({ tipo, fechaEvento: hoursAgo(horas - 1) })
    const justOver = makeIncidente({ tipo, fechaEvento: hoursAgo(horas + 1) })
    expect(getIncidentQEAlertLevel(justUnder, NOW)).not.toBe('ROJO')
    expect(getIncidentQEAlertLevel(justOver, NOW)).toBe('ROJO')
  })
})

describe('getIncidentQEPlazoInfo — tooltip RN-INC-006 (incidentes-ajustes-ui)', () => {
  it('devuelve el plazo correcto por tipo', () => {
    expect(getIncidentQEPlazoInfo(makeIncidente({ tipo: 'ACCIDENTE' }), NOW).plazoHoras).toBe(24)
    expect(getIncidentQEPlazoInfo(makeIncidente({ tipo: 'INCIDENTE' }), NOW).plazoHoras).toBe(48)
    expect(getIncidentQEPlazoInfo(makeIncidente({ tipo: 'CUASI_ACCIDENTE' }), NOW).plazoHoras).toBe(72)
    expect(getIncidentQEPlazoInfo(makeIncidente({ tipo: 'CONDICION_INSEGURA' }), NOW).plazoHoras).toBe(48)
  })

  it('horasRestantes es positivo antes del vencimiento', () => {
    const inc = makeIncidente({ tipo: 'INCIDENTE', fechaEvento: hoursAgo(40) })
    expect(getIncidentQEPlazoInfo(inc, NOW).horasRestantes).toBe(8)
  })

  it('horasRestantes es negativo después del vencimiento', () => {
    const inc = makeIncidente({ tipo: 'INCIDENTE', fechaEvento: hoursAgo(50) })
    expect(getIncidentQEPlazoInfo(inc, NOW).horasRestantes).toBe(-2)
  })

  it('redondea hacia abajo', () => {
    const inc = makeIncidente({ tipo: 'INCIDENTE', fechaEvento: hoursAgo(40.5) })
    expect(getIncidentQEPlazoInfo(inc, NOW).horasRestantes).toBe(7)
  })
})
