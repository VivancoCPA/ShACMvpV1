import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../i18n'
import { RevisionSemaforo } from './RevisionSemaforo'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('RevisionSemaforo — fix-fechas-utc: sin desfase de zona horaria', () => {
  it('con 1 día de calendario restante, no lo muestra como vencido (el bug original lo hacía)', () => {
    // Hoy = 29 set 2026 (local), fechaRevisionProxima = 30 set 2026 (calendario) → falta 1 día.
    // El bug original (differenceInCalendarDays(parseISO(iso), new Date()), ambos comparados en
    // la zona local del navegador) interpretaba "2026-09-30T00:00:00Z" como 29 sept 19:00 en
    // UTC-5 — el mismo día que "hoy" — y daba 0 días restantes (vencido) en vez de 1.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 29, 9, 0, 0)) // hoy = 29 set 2026, hora local

    render(<RevisionSemaforo fechaRevisionProxima="2026-09-30T00:00:00Z" />, { wrapper })

    expect(screen.queryByText(/vencid/i)).not.toBeInTheDocument()
    expect(screen.getByText(/próximo/i)).toBeInTheDocument()
  })

  it('muestra verde cuando faltan más días de calendario que el umbral de alerta', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0)) // 1 set 2026

    const { container } = render(
      <RevisionSemaforo fechaRevisionProxima="2026-10-15T00:00:00Z" />, // 44 días de calendario
      { wrapper },
    )

    expect(container.querySelector('.bg-success')).toBeInTheDocument()
  })

  it('no lanza y muestra un guion cuando fechaRevisionProxima es null (no undefined)', () => {
    // Regresión: el backend real serializa un DateTime? vacío como JSON null (no como clave
    // ausente), y este componente solo comprobaba === undefined; con null seguía de largo y
    // calendarDaysUntil(null) lanzaba un TypeError que tumbaba toda la lista (fix-fechas-utc).
    expect(() =>
      render(<RevisionSemaforo fechaRevisionProxima={null} />, { wrapper }),
    ).not.toThrow()

    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('RevisionSemaforo — la fecha y el texto relativo son visibles sin hover (semaforo-revision-con-fecha)', () => {
  it('verde: muestra la fecha, sin badge ni texto relativo', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0)) // 1 set 2026

    render(<RevisionSemaforo fechaRevisionProxima="2026-10-15T00:00:00Z" />, { wrapper }) // 44 días

    expect(screen.getByText('15 oct 2026')).toBeInTheDocument()
    expect(screen.queryByText(/próximo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/vencid/i)).not.toBeInTheDocument()
  })

  it('ámbar: muestra la fecha y "en N días" en plural, sin necesidad de hover', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0)) // 1 set 2026

    render(<RevisionSemaforo fechaRevisionProxima="2026-09-16T00:00:00Z" />, { wrapper }) // 15 días

    expect(screen.getByText('16 set 2026')).toBeInTheDocument()
    expect(screen.getByText('en 15 días')).toBeInTheDocument()
  })

  it('rojo próximo: muestra la fecha, el badge y "en N días"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0)) // 1 set 2026

    render(<RevisionSemaforo fechaRevisionProxima="2026-09-04T00:00:00Z" />, { wrapper }) // 3 días

    expect(screen.getByText('4 set 2026')).toBeInTheDocument()
    expect(screen.getByText(/próximo/i)).toBeInTheDocument()
    expect(screen.getByText('en 3 días')).toBeInTheDocument()
  })

  it('singular: "en 1 día", no "en 1 días"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0))

    render(<RevisionSemaforo fechaRevisionProxima="2026-09-02T00:00:00Z" />, { wrapper }) // 1 día

    expect(screen.getByText('en 1 día')).toBeInTheDocument()
    expect(screen.queryByText('en 1 días')).not.toBeInTheDocument()
  })

  it('hoy: diasRestantes === 0 muestra "Hoy", no "en 0 días" ni "hace 0 días"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0))

    render(<RevisionSemaforo fechaRevisionProxima="2026-09-01T00:00:00Z" />, { wrapper })

    expect(screen.getByText('Hoy')).toBeInTheDocument()
    expect(screen.queryByText(/en 0/)).not.toBeInTheDocument()
    expect(screen.queryByText(/hace 0/)).not.toBeInTheDocument()
  })

  it('vencido: muestra la fecha, el badge y "hace N días" en plural', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 9, 0, 0)) // 11 set 2026

    render(<RevisionSemaforo fechaRevisionProxima="2026-09-01T00:00:00Z" />, { wrapper }) // -10 días

    expect(screen.getByText('1 set 2026')).toBeInTheDocument()
    expect(screen.getByText(/vencid/i)).toBeInTheDocument()
    expect(screen.getByText('hace 10 días')).toBeInTheDocument()
  })

  it('vencido singular: "hace 1 día", no "hace 1 días"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 2, 9, 0, 0))

    render(<RevisionSemaforo fechaRevisionProxima="2026-09-01T00:00:00Z" />, { wrapper }) // -1 día

    expect(screen.getByText('hace 1 día')).toBeInTheDocument()
  })

  it('sin fecha: guion, sin fecha ni texto relativo', () => {
    render(<RevisionSemaforo fechaRevisionProxima={undefined} />, { wrapper })

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('ya no depende de un tooltip: no hay role="tooltip" en ningún estado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0))

    render(<RevisionSemaforo fechaRevisionProxima="2026-09-16T00:00:00Z" />, { wrapper })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('UTC-5: la fecha visible y el texto relativo no se corren un día', () => {
    // Hoy = 29 set 2026 (local), objetivo = 1 oct 2026 (calendario) → 2 días, no 1 ni 3.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 29, 9, 0, 0))

    render(<RevisionSemaforo fechaRevisionProxima="2026-10-01T00:00:00Z" />, { wrapper })

    expect(screen.getByText('1 oct 2026')).toBeInTheDocument()
    expect(screen.getByText('en 2 días')).toBeInTheDocument()
  })
})
