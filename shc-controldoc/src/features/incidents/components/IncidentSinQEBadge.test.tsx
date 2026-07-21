import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { IncidentSinQEBadge } from './IncidentSinQEBadge'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

afterEach(() => cleanup())

describe('IncidentSinQEBadge — RN-INC-006', () => {
  it('renders nothing when nivel is NONE', () => {
    const { container } = render(<IncidentSinQEBadge nivel="NONE" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the label with the amber treatment for AMARILLO', () => {
    render(<IncidentSinQEBadge nivel="AMARILLO" />)
    const badge = screen.getByText('list.sinQEBadge.label')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-amber')
    expect(badge.title).toBe('list.sinQEBadge.tooltip.AMARILLO')
  })

  it('renders the label with the error/red treatment for ROJO', () => {
    render(<IncidentSinQEBadge nivel="ROJO" />)
    const badge = screen.getByText('list.sinQEBadge.label')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-error')
    expect(badge.title).toBe('list.sinQEBadge.tooltip.ROJO')
  })
})
