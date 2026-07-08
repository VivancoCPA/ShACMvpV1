import { describe, expect, it } from 'vitest'
import { calcularDiasHabilesRestantes, contarDiasHabiles } from './businessDays'
import { estaVencidaVerificacion } from '../features/quality-events/utils/qualityEventHelpers'

describe('contarDiasHabiles', () => {
  it('counts only weekdays between two dates with no holidays', () => {
    const desde = new Date(2026, 6, 6) // Monday
    const hasta = new Date(2026, 6, 10) // Friday
    expect(contarDiasHabiles(desde, hasta)).toBe(4)
  })

  it('excludes weekend days from the count', () => {
    const desde = new Date(2026, 6, 10) // Friday
    const hasta = new Date(2026, 6, 13) // Monday
    expect(contarDiasHabiles(desde, hasta)).toBe(1)
  })

  it('excludes a configured holiday that falls on a weekday', () => {
    const desde = new Date(2026, 6, 6) // Monday
    const hasta = new Date(2026, 6, 13) // next Monday (5 weekdays: Tue-Fri + Mon)
    expect(contarDiasHabiles(desde, hasta, ['2026-07-08'])).toBe(4)
  })

  it('returns zero when desde equals hasta', () => {
    const dia = new Date(2026, 6, 6)
    expect(contarDiasHabiles(dia, dia)).toBe(0)
  })

  it('quality-events callers get an identical result to the pre-existing weekday-only implementation', () => {
    const qe = {
      fechaVerificacionProgramada: '2026-06-01T00:00:00.000Z',
      fechaVerificacionRealizada: undefined,
    } as never
    const hoy = new Date(2026, 6, 6)
    expect(estaVencidaVerificacion(qe, hoy)).toBe(true)
  })
})

describe('calcularDiasHabilesRestantes', () => {
  it('returns positive count for a future due date', () => {
    const hoy = new Date(2026, 6, 6) // Monday
    const fechaVencimiento = new Date(2026, 6, 10) // Friday
    expect(calcularDiasHabilesRestantes(hoy, fechaVencimiento)).toBe(4)
  })

  it('returns negative count for a past due date', () => {
    const hoy = new Date(2026, 6, 10) // Friday
    const fechaVencimiento = new Date(2026, 6, 6) // Monday
    expect(calcularDiasHabilesRestantes(hoy, fechaVencimiento)).toBe(-4)
  })

  it('returns zero when the due date is today', () => {
    const dia = new Date(2026, 6, 6)
    expect(calcularDiasHabilesRestantes(dia, dia)).toBe(0)
  })

  it('respects configured holidays when computing the signed distance', () => {
    const hoy = new Date(2026, 6, 6) // Monday
    const fechaVencimiento = new Date(2026, 6, 13) // next Monday
    expect(calcularDiasHabilesRestantes(hoy, fechaVencimiento, ['2026-07-08'])).toBe(4)
  })
})
