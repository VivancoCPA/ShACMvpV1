import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatCalendarDate, formatCalendarDateMedium, calendarDaysUntil } from './date.utils'

afterEach(() => {
  vi.useRealTimers()
})

// fix-fechas-utc: una fecha de calendario ("2026-09-29T00:00:00Z") NO debe desfasarse un día en
// una zona horaria de offset negativo como UTC-5 (Perú). Estos tests no dependen de la zona
// horaria real de la máquina que los corre: comparan explícitamente contra lo que un `new
// Date(iso)` + `Intl.DateTimeFormat` sin `timeZone` (el bug original) habría mostrado en
// UTC-5, usando `timeZone: 'America/Lima'` como una zona horaria "simulada" — sin tocar
// `process.env.TZ` ni el reloj real.
describe('formatCalendarDate — sin desfase de zona horaria', () => {
  it('muestra el día 29, no el 28, para "2026-09-29T00:00:00Z"', () => {
    expect(formatCalendarDate('2026-09-29T00:00:00Z', 'es-PE')).toContain('29')
    expect(formatCalendarDate('2026-09-29T00:00:00Z', 'es-PE')).not.toContain('28')
  })

  it('difiere del día que un formateo local en UTC-5 mostraría (reproduce el bug original)', () => {
    const diaConBugEnUtcMenos5 = new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      timeZone: 'America/Lima',
    }).format(new Date('2026-09-29T00:00:00Z'))

    // El bug original (new Date(iso) + Intl sin timeZone, en un navegador UTC-5) mostraría "28".
    expect(diaConBugEnUtcMenos5).toBe('28')
    expect(formatCalendarDate('2026-09-29T00:00:00Z', 'es-PE')).toContain('29')
  })
})

describe('formatCalendarDateMedium', () => {
  it('formatea sin desfase usando dateStyle medium', () => {
    const result = formatCalendarDateMedium('2026-09-29T00:00:00Z', 'es-PE')
    expect(result).toContain('29')
    expect(result).not.toContain('28')
  })
})

describe('calendarDaysUntil — sin desfase de zona horaria', () => {
  it('calcula 2 días cuando "hoy" es 2026-09-29 y el objetivo es 2026-10-01', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 29, 10, 0, 0)) // 29 sept 2026, hora local del runner

    expect(calendarDaysUntil('2026-10-01T00:00:00Z')).toBe(2)
  })

  it('calcula 0 el mismo día del vencimiento, sin importar la hora local', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 29, 23, 30, 0))

    expect(calendarDaysUntil('2026-09-29T00:00:00Z')).toBe(0)
  })

  it('da negativo para una fecha ya vencida', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 5, 8, 0, 0))

    expect(calendarDaysUntil('2026-10-01T00:00:00Z')).toBe(-4)
  })
})
