import { describe, it, expect } from 'vitest'
import { getIncidentPermissions } from './incidentPermissions'
import type { Incidente } from '../types/incident.types'

function makeIncidente(overrides: Partial<Incidente> = {}): Incidente {
  return {
    id: 'inc-003',
    numero: 'INC-2026-003',
    tipo: 'INCIDENTE',
    estado: 'EN_INVESTIGACION',
    severidad: 'MEDIA',
    descripcion: 'Descripción de prueba para el incidente',
    areaId: 'SyST',
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

describe('getIncidentPermissions — canCrearQE', () => {
  it('is true for SUPERVISOR on an active incident without a linked QE', () => {
    const incidente = makeIncidente({ estado: 'EN_INVESTIGACION', deletedAt: undefined, qeId: undefined })
    expect(getIncidentPermissions(incidente, 'SUPERVISOR').canCrearQE).toBe(true)
  })

  it('is true for JEFE_CALIDAD_SYST on an active incident without a linked QE', () => {
    const incidente = makeIncidente({ estado: 'ABIERTO', deletedAt: undefined, qeId: undefined })
    expect(getIncidentPermissions(incidente, 'JEFE_CALIDAD_SYST').canCrearQE).toBe(true)
  })

  it('is false when the incident already has a linked QE', () => {
    const incidente = makeIncidente({ qeId: 'qe-2026-005' })
    expect(getIncidentPermissions(incidente, 'SUPERVISOR').canCrearQE).toBe(false)
  })

  it('is false for a CERRADO incident', () => {
    const incidente = makeIncidente({ estado: 'CERRADO', qeId: undefined })
    expect(getIncidentPermissions(incidente, 'JEFE_CALIDAD_SYST').canCrearQE).toBe(false)
  })

  it('is false when the incident is soft-deleted', () => {
    const incidente = makeIncidente({
      estado: 'ABIERTO',
      deletedAt: '2025-01-01T00:00:00Z',
      qeId: undefined,
    })
    expect(getIncidentPermissions(incidente, 'JEFE_CALIDAD_SYST').canCrearQE).toBe(false)
  })

  it('is false for OPERARIO regardless of state or link', () => {
    const incidente = makeIncidente({ estado: 'ABIERTO', qeId: undefined })
    expect(getIncidentPermissions(incidente, 'OPERARIO').canCrearQE).toBe(false)
  })
})
