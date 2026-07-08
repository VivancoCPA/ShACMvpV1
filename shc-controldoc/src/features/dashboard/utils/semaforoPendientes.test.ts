import { describe, expect, it } from 'vitest'
import { calcularEstadoSemaforoDesdeFecha, calcularEstadoSemaforoFila } from './semaforoPendientes'

describe('calcularEstadoSemaforoFila', () => {
  it('more than 5 business days remaining is VERDE', () => {
    expect(calcularEstadoSemaforoFila(6)).toBe('VERDE')
  })

  it('exactly 5 business days remaining is AMARILLO', () => {
    expect(calcularEstadoSemaforoFila(5)).toBe('AMARILLO')
  })

  it('exactly 1 business day remaining is AMARILLO', () => {
    expect(calcularEstadoSemaforoFila(1)).toBe('AMARILLO')
  })

  it('zero business days remaining (due today) is ROJO', () => {
    expect(calcularEstadoSemaforoFila(0)).toBe('ROJO')
  })

  it('negative business days remaining (past due) is ROJO', () => {
    expect(calcularEstadoSemaforoFila(-3)).toBe('ROJO')
  })
})

describe('calcularEstadoSemaforoDesdeFecha', () => {
  it('combines day calculation and state mapping for a future date', () => {
    const hoy = new Date(2026, 6, 6) // Monday
    const fechaVencimiento = new Date(2026, 6, 20) // 10 business days later
    const result = calcularEstadoSemaforoDesdeFecha(fechaVencimiento, hoy)
    expect(result).toEqual({ estado: 'VERDE', diasHabilesRestantes: 10 })
  })

  it('accepts an explicit hoy for deterministic testing', () => {
    const hoy = new Date(2026, 6, 6) // Monday
    const fechaVencimiento = new Date(2026, 6, 9) // Thursday, 3 business days later
    const result = calcularEstadoSemaforoDesdeFecha(fechaVencimiento, hoy)
    expect(result).toEqual({ estado: 'AMARILLO', diasHabilesRestantes: 3 })
  })
})
