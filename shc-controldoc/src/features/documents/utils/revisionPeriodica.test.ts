import { describe, it, expect } from 'vitest'
import { getRevisionPeriodicaNivel } from './revisionPeriodica'

// revision-periodica-trazabilidad: límites exactos de los 3 niveles — umbral único
// DOC_REVISION_ALERT_DAYS (30) para ok/proximo, 0 para proximo/vencido (design.md D6).
describe('getRevisionPeriodicaNivel', () => {
  it('devuelve "ok" para más de 30 días restantes', () => {
    expect(getRevisionPeriodicaNivel(31)).toBe('ok')
  })

  it('devuelve "proximo" en el límite exacto de 30 días', () => {
    expect(getRevisionPeriodicaNivel(30)).toBe('proximo')
  })

  it('devuelve "proximo" en el límite exacto de 1 día', () => {
    expect(getRevisionPeriodicaNivel(1)).toBe('proximo')
  })

  it('devuelve "vencido" en el límite exacto de 0 días', () => {
    expect(getRevisionPeriodicaNivel(0)).toBe('vencido')
  })

  it('devuelve "vencido" para días negativos', () => {
    expect(getRevisionPeriodicaNivel(-5)).toBe('vencido')
  })
})
