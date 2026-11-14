import { describe, expect, it } from 'vitest'
import {
  clasificarAcsVencidasYPorVencer,
  contarHallazgosAbiertos,
  contarIncidentesRecientes,
  contarReaperturasEnRango,
  filtrarAcsNoVencidas,
  filtrarSolicitudesGerenciaPendientes,
} from './alertasDashboard.utils'
import type {
  ACSolicitudAjustePlazoResumen,
  AccionCorrectivaResumen,
  IncidenteResumen,
  QEReaperturaResumen,
} from '../types/dashboardSummary.types'

const AHORA = Date.UTC(2026, 10, 6, 12)
const DIA = 86_400_000

function ac(estado: string, plazoMs: number): AccionCorrectivaResumen {
  return {
    id: `${estado}-${plazoMs}`,
    origenTipo: 'QE',
    origenId: 'qe-1',
    descripcion: 'AC',
    responsableId: 'u',
    responsableNombre: 'U',
    plazoFecha: new Date(plazoMs).toISOString(),
    estado,
  } as AccionCorrectivaResumen
}

describe('clasificarAcsVencidasYPorVencer', () => {
  it('returns the overdue and due-within-5-days non-terminal CAs', () => {
    const acs = [
      ac('EN_EJECUCION', AHORA - DIA),
      ac('PENDIENTE', AHORA + 3 * DIA),
      ac('CERRADA', AHORA - DIA),
      ac('PENDIENTE', AHORA + 10 * DIA),
    ]
    const { vencidas, porVencer } = clasificarAcsVencidasYPorVencer(acs, 5, AHORA)
    expect(vencidas).toEqual([acs[0]])
    expect(porVencer).toEqual([acs[1]])
  })
})

describe('filtrarAcsNoVencidas', () => {
  it('drops CAs whose deadline already passed', () => {
    const acs = [ac('EN_EJECUCION', AHORA - DIA), ac('PENDIENTE', AHORA + DIA)]
    expect(filtrarAcsNoVencidas(acs, AHORA)).toEqual([acs[1]])
  })
})

describe('filtrarSolicitudesGerenciaPendientes', () => {
  it('keeps only CAs with a PENDIENTE request that needs management approval', () => {
    const conSolicitud = (acId: string, estado: string, requiereAprobacionGerencia: boolean) =>
      ({ acId, solicitudesAjustePlazo: [{ estado, requiereAprobacionGerencia }] }) as unknown as ACSolicitudAjustePlazoResumen
    const acs = [conSolicitud('a', 'PENDIENTE', true), conSolicitud('b', 'PENDIENTE', false), conSolicitud('c', 'APROBADA', true)]
    expect(filtrarSolicitudesGerenciaPendientes(acs).map((a) => a.acId)).toEqual(['a'])
  })
})

describe('contarIncidentesRecientes', () => {
  it('counts the last 7 days and returns the filter date', () => {
    const inc = (ms: number) => ({ id: String(ms), fechaEvento: new Date(ms).toISOString() }) as IncidenteResumen
    const resultado = contarIncidentesRecientes([inc(AHORA - 2 * DIA), inc(AHORA - 20 * DIA)], 7, AHORA)
    expect(resultado).toEqual({ total: 1, fechaDesde: '2026-10-30' })
  })
})

describe('contarReaperturasEnRango', () => {
  it('counts reopenings inside [desde, hasta)', () => {
    const r = (iso: string) => ({ id: iso, fechaReapertura: iso }) as QEReaperturaResumen
    const rango = { desde: new Date('2026-11-01T00:00:00Z'), hasta: new Date('2026-12-01T00:00:00Z') }
    expect(contarReaperturasEnRango([r('2026-11-03T00:00:00Z'), r('2026-10-20T00:00:00Z'), r('2026-12-01T00:00:00Z')], rango)).toBe(1)
  })
})

describe('contarHallazgosAbiertos', () => {
  it('excludes CERRADO and VERIFICADO', () => {
    expect(contarHallazgosAbiertos({ ABIERTO: 2, EN_EJECUCION: 1, CERRADO: 4, VERIFICADO: 3 })).toBe(3)
  })
})
