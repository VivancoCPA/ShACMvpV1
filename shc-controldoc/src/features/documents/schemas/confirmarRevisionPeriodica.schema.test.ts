import { describe, it, expect } from 'vitest'
import { confirmarRevisionPeriodicaSchema } from './confirmarRevisionPeriodica.schema'
import { todayCalendarDateIso, addCalendarDays } from '../../../utils/date.utils'

describe('confirmarRevisionPeriodicaSchema', () => {
  it('acepta un valor vacío (REG/INF opcional)', () => {
    const result = confirmarRevisionPeriodicaSchema.safeParse({ fechaRevisionProxima: '' })
    expect(result.success).toBe(true)
  })

  it('acepta cuando el campo está ausente', () => {
    const result = confirmarRevisionPeriodicaSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rechaza una fecha por debajo del mínimo de 30 días', () => {
    const fechaCorta = addCalendarDays(todayCalendarDateIso(), 10)
    const result = confirmarRevisionPeriodicaSchema.safeParse({ fechaRevisionProxima: fechaCorta })
    expect(result.success).toBe(false)
  })

  it('acepta una fecha válida (hoy + 30 días exacto)', () => {
    const fechaValida = addCalendarDays(todayCalendarDateIso(), 30)
    const result = confirmarRevisionPeriodicaSchema.safeParse({ fechaRevisionProxima: fechaValida })
    expect(result.success).toBe(true)
  })

  it('acepta una fecha muy posterior', () => {
    const fechaValida = addCalendarDays(todayCalendarDateIso(), 400)
    const result = confirmarRevisionPeriodicaSchema.safeParse({ fechaRevisionProxima: fechaValida })
    expect(result.success).toBe(true)
  })
})
