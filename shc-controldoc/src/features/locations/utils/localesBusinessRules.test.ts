import { describe, it, expect } from 'vitest'
import {
  puedeCrearLocalActivo,
  puedeDesactivarLocal,
  puedeDesactivarZona,
} from './localesBusinessRules'
import type { Local, Zona, Incidente, IncidentStatus } from '../../incidents/types/incident.types'

function buildLocal(overrides: Partial<Local> = {}): Local {
  return {
    id: 'loc-001',
    nombre: 'Almacén Central',
    codigo: 'LOC-001',
    activo: true,
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildZona(overrides: Partial<Zona> = {}): Zona {
  return {
    id: 'zona-001',
    localId: 'loc-001',
    nombre: 'Zona de Carga',
    codigo: 'ZON-001',
    activo: true,
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildIncidente(overrides: Partial<Incidente> = {}): Incidente {
  return {
    id: 'inc-001',
    numero: 'INC-2026-001',
    tipo: 'INCIDENTE',
    estado: 'ABIERTO',
    severidad: 'BAJA',
    descripcion: 'Incidente de prueba',
    areaId: 'area-1',
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

describe('puedeCrearLocalActivo (RN-LOC-001)', () => {
  it('con 4 locales activos permite crear el quinto', () => {
    const locales = Array.from({ length: 4 }, (_, i) => buildLocal({ id: `loc-${i}`, activo: true }))
    expect(puedeCrearLocalActivo(locales)).toBe(true)
  })

  it('con 5 locales activos bloquea la creación', () => {
    const locales = Array.from({ length: 5 }, (_, i) => buildLocal({ id: `loc-${i}`, activo: true }))
    expect(puedeCrearLocalActivo(locales)).toBe(false)
  })

  it('locales inactivos no cuentan para el límite', () => {
    const locales = Array.from({ length: 5 }, (_, i) => buildLocal({ id: `loc-${i}`, activo: false }))
    expect(puedeCrearLocalActivo(locales)).toBe(true)
  })

  it('lista vacía permite crear', () => {
    expect(puedeCrearLocalActivo([])).toBe(true)
  })
})

describe('puedeDesactivarLocal (RN-LOC-002)', () => {
  const local = buildLocal({ id: 'loc-001' })

  it('local sin incidentes bloqueantes puede desactivarse', () => {
    const incidentes = [
      buildIncidente({ localId: 'loc-001', estado: 'CERRADO' }),
      buildIncidente({ localId: 'loc-001', estado: 'ANULADO' }),
    ]
    expect(puedeDesactivarLocal(local, incidentes)).toEqual({ permitido: true, incidentesBloqueantes: 0 })
  })

  it('local con un incidente ABIERTO no puede desactivarse', () => {
    const incidentes = [buildIncidente({ localId: 'loc-001', estado: 'ABIERTO' })]
    expect(puedeDesactivarLocal(local, incidentes)).toEqual({ permitido: false, incidentesBloqueantes: 1 })
  })

  it('incidentes en otros estados no bloquean la desactivación', () => {
    const estadosNoBloqueantes: IncidentStatus[] = [
      'ANALISIS_COMPLETADO',
      'EN_EJECUCION',
      'PENDIENTE_CIERRE',
      'CERRADO',
      'ANULADO',
    ]
    const incidentes = estadosNoBloqueantes.map((estado) =>
      buildIncidente({ localId: 'loc-001', estado }),
    )
    expect(puedeDesactivarLocal(local, incidentes)).toEqual({ permitido: true, incidentesBloqueantes: 0 })
  })

  it('incidentes de otro local no cuentan', () => {
    const incidentes = [
      buildIncidente({ localId: 'loc-999', estado: 'ABIERTO' }),
      buildIncidente({ localId: 'loc-999', estado: 'EN_INVESTIGACION' }),
    ]
    expect(puedeDesactivarLocal(local, incidentes)).toEqual({ permitido: true, incidentesBloqueantes: 0 })
  })
})

describe('puedeDesactivarZona (RN-ZON-002)', () => {
  const zona = buildZona({ id: 'zona-001' })

  it('zona sin incidentes bloqueantes puede desactivarse', () => {
    const incidentes = [buildIncidente({ zonaId: 'zona-001', estado: 'CERRADO' })]
    expect(puedeDesactivarZona(zona, incidentes)).toEqual({ permitido: true, incidentesBloqueantes: 0 })
  })

  it('zona con un incidente EN_EJECUCION no puede desactivarse', () => {
    const incidentes = [buildIncidente({ zonaId: 'zona-001', estado: 'EN_EJECUCION' })]
    expect(puedeDesactivarZona(zona, incidentes)).toEqual({ permitido: false, incidentesBloqueantes: 1 })
  })

  it('incidentes en ANALISIS_COMPLETADO, PENDIENTE_CIERRE, CERRADO o ANULADO no bloquean la desactivación', () => {
    const estadosNoBloqueantes: IncidentStatus[] = [
      'ANALISIS_COMPLETADO',
      'PENDIENTE_CIERRE',
      'CERRADO',
      'ANULADO',
    ]
    const incidentes = estadosNoBloqueantes.map((estado) =>
      buildIncidente({ zonaId: 'zona-001', estado }),
    )
    expect(puedeDesactivarZona(zona, incidentes)).toEqual({ permitido: true, incidentesBloqueantes: 0 })
  })

  it('múltiples incidentes bloqueantes se cuentan todos', () => {
    const incidentes = [
      buildIncidente({ zonaId: 'zona-001', estado: 'ABIERTO' }),
      buildIncidente({ zonaId: 'zona-001', estado: 'EN_INVESTIGACION' }),
    ]
    expect(puedeDesactivarZona(zona, incidentes)).toEqual({ permitido: false, incidentesBloqueantes: 2 })
  })
})
