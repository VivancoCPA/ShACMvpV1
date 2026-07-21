import { describe, it, expect } from 'vitest'
import { puedeDesactivarArea } from './areaBusinessRules'
import type { Area } from '../types/area.types'
import type { QualityEvent } from '../../quality-events/types/qualityEvent.types'
import type { NoConformidad } from '../../nonconformities/types/nonconformity.types'
import type { Incidente } from '../../incidents/types/incident.types'

function buildArea(overrides: Partial<Area> = {}): Area {
  return { id: 'area-001', nombre: 'Almacén Norte', activo: true, creadoEn: '2026-01-01T00:00:00Z', ...overrides }
}

function buildQe(overrides: Partial<QualityEvent> = {}): QualityEvent {
  return {
    id: 'qe-001',
    numero: 'QE-2026-001',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'CALIDAD',
    severidad: 'BAJA',
    estado: 'ABIERTO',
    ciclo: 1,
    descripcion: 'QE de prueba',
    areaId: 'area-001',
    turno: 'DIA',
    fechaHoraEvento: '2026-01-01T00:00:00Z',
    fechaHoraReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-1',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  } as QualityEvent
}

function buildNc(overrides: Partial<NoConformidad> = {}): NoConformidad {
  return {
    id: 'nc-001',
    numero: 'NC-CAL-2026-001',
    dominio: 'CALIDAD',
    titulo: 'NC de prueba',
    origen: 'INSPECCION_INTERNA',
    tipo: 'PROCESO',
    severidad: 'BAJA',
    estado: 'ABIERTA',
    descripcion: 'NC de prueba',
    areaId: 'area-001',
    reportadoPorId: 'user-1',
    fechaDeteccion: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    requiereIPER: false,
    accionesCorrectivas: [],
    documentosVinculados: [],
    adjuntos: [],
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  } as NoConformidad
}

function buildIncidente(overrides: Partial<Incidente> = {}): Incidente {
  return {
    id: 'inc-001',
    numero: 'INC-2026-001',
    tipo: 'INCIDENTE',
    estado: 'ABIERTO',
    severidad: 'BAJA',
    descripcion: 'Incidente de prueba',
    areaId: 'area-001',
    turno: 'DIA',
    fechaEvento: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-1',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Incidente
}

describe('puedeDesactivarArea (RN-ARE-001)', () => {
  it('área sin referencias activas en ningún módulo puede desactivarse', () => {
    const area = buildArea()
    expect(puedeDesactivarArea(area, [], [], [])).toEqual({
      permitido: true,
      conteo: { qe: 0, nc: 0, incidentes: 0, total: 0 },
    })
  })

  it('área con un QE en EN_EJECUCION no puede desactivarse', () => {
    const area = buildArea()
    const qes = [buildQe({ estado: 'EN_EJECUCION' })]
    expect(puedeDesactivarArea(area, qes, [], [])).toEqual({
      permitido: false,
      conteo: { qe: 1, nc: 0, incidentes: 0, total: 1 },
    })
  })

  it('área con referencias bloqueantes en los tres módulos simultáneamente', () => {
    const area = buildArea()
    const qes = [buildQe({ id: 'qe-1', estado: 'ABIERTO' }), buildQe({ id: 'qe-2', estado: 'EN_INVESTIGACION' })]
    const ncs = [buildNc({ id: 'nc-1', estado: 'EN_EJECUCION' })]
    const incidentes = [
      buildIncidente({ id: 'inc-1', estado: 'ABIERTO' }),
      buildIncidente({ id: 'inc-2', estado: 'EN_INVESTIGACION' }),
      buildIncidente({ id: 'inc-3', estado: 'PENDIENTE_CIERRE' }),
    ]
    expect(puedeDesactivarArea(area, qes, ncs, incidentes)).toEqual({
      permitido: false,
      conteo: { qe: 2, nc: 1, incidentes: 3, total: 6 },
    })
  })

  it('NC en estado EN_EJECUCION (no-terminal) cuenta como bloqueante', () => {
    const area = buildArea()
    const ncs = [buildNc({ estado: 'EN_EJECUCION' })]
    const result = puedeDesactivarArea(area, [], ncs, [])
    expect(result.conteo.nc).toBe(1)
    expect(result.permitido).toBe(false)
  })

  it('QE en estado CERRADO, VERIFICADO o REABIERTO no bloquea', () => {
    const area = buildArea()
    const qes = [
      buildQe({ id: 'qe-1', estado: 'CERRADO' }),
      buildQe({ id: 'qe-2', estado: 'VERIFICADO' }),
      buildQe({ id: 'qe-3', estado: 'REABIERTO' }),
    ]
    expect(puedeDesactivarArea(area, qes, [], []).conteo.qe).toBe(0)
  })

  it('NC en estado CERRADA o ANULADA no bloquea', () => {
    const area = buildArea()
    const ncs = [buildNc({ id: 'nc-1', estado: 'CERRADA' }), buildNc({ id: 'nc-2', estado: 'ANULADA' })]
    expect(puedeDesactivarArea(area, [], ncs, []).conteo.nc).toBe(0)
  })

  it('Incidente en estado CERRADO o ANULADO no bloquea', () => {
    const area = buildArea()
    const incidentes = [
      buildIncidente({ id: 'inc-1', estado: 'CERRADO' }),
      buildIncidente({ id: 'inc-2', estado: 'ANULADO' }),
    ]
    expect(puedeDesactivarArea(area, [], [], incidentes).conteo.incidentes).toBe(0)
  })

  it('referencias de otra Área no cuentan', () => {
    const area = buildArea({ id: 'area-001' })
    const qes = [buildQe({ areaId: 'area-999', estado: 'ABIERTO' })]
    const ncs = [buildNc({ areaId: 'area-999', estado: 'ABIERTA' })]
    const incidentes = [buildIncidente({ areaId: 'area-999', estado: 'ABIERTO' })]
    expect(puedeDesactivarArea(area, qes, ncs, incidentes)).toEqual({
      permitido: true,
      conteo: { qe: 0, nc: 0, incidentes: 0, total: 0 },
    })
  })

  it('QE, NC e Incidente en ABIERTO cuentan como bloqueantes', () => {
    const area = buildArea()
    const qes = [buildQe({ estado: 'ABIERTO' })]
    const ncs = [buildNc({ estado: 'ABIERTA' })]
    const incidentes = [buildIncidente({ estado: 'ABIERTO' })]
    expect(puedeDesactivarArea(area, qes, ncs, incidentes)).toEqual({
      permitido: false,
      conteo: { qe: 1, nc: 1, incidentes: 1, total: 3 },
    })
  })
})
