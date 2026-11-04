import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { IncidentSinQEBadge } from './IncidentSinQEBadge'

// Mock de t que interpola {{var}} sobre plantillas fijas, para verificar el texto final.
const TEMPLATES: Record<string, string> = {
  'list.sinQEBadge.tooltip.AMARILLO': 'Plazo para vincular un QE: {{plazo}} h · vence en {{restante}}',
  'list.sinQEBadge.tooltip.ROJO': 'Plazo para vincular un QE: {{plazo}} h · vencido hace {{vencido}}',
  'list.sinQEBadge.duracion.horas': '{{h}} h',
  'list.sinQEBadge.duracion.diasHoras': '{{d}} d {{h}} h',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      (TEMPLATES[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(opts?.[k] ?? '')),
  }),
}))

afterEach(() => cleanup())

const NOW = new Date('2026-01-03T00:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString()

describe('IncidentSinQEBadge — RN-INC-006', () => {
  it('renders nothing when nivel is NONE', () => {
    const { container } = render(
      <IncidentSinQEBadge nivel="NONE" incidente={{ tipo: 'INCIDENTE', fechaEvento: hoursAgo(1) }} now={NOW} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('AMARILLO: amber treatment and "vence en" tooltip', () => {
    render(
      <IncidentSinQEBadge nivel="AMARILLO" incidente={{ tipo: 'INCIDENTE', fechaEvento: hoursAgo(40) }} now={NOW} />,
    )
    const badge = screen.getByText('list.sinQEBadge.label')
    expect(badge.className).toContain('text-amber')
    expect(badge.title).toBe('Plazo para vincular un QE: 48 h · vence en 8 h')
    expect(badge).toHaveAttribute('aria-label', badge.title)
  })

  it('ROJO: error treatment and "vencido hace" tooltip, in days when ≥ 48 h', () => {
    render(
      <IncidentSinQEBadge nivel="ROJO" incidente={{ tipo: 'ACCIDENTE', fechaEvento: hoursAgo(74) }} now={NOW} />,
    )
    const badge = screen.getByText('list.sinQEBadge.label')
    expect(badge.className).toContain('text-error')
    expect(badge.title).toBe('Plazo para vincular un QE: 24 h · vencido hace 2 d 2 h')
    expect(badge).toHaveAttribute('aria-label', badge.title)
  })

  it('ROJO under 48 h overdue uses hours only', () => {
    render(
      <IncidentSinQEBadge nivel="ROJO" incidente={{ tipo: 'ACCIDENTE', fechaEvento: hoursAgo(30) }} now={NOW} />,
    )
    expect(screen.getByText('list.sinQEBadge.label').title).toBe(
      'Plazo para vincular un QE: 24 h · vencido hace 6 h',
    )
  })
})
