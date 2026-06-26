import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NCStatusBadge } from './NCStatusBadge'
import type { NCStatus } from '../../features/nonconformities/types/nonconformity.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

const ALL_STATUSES: NCStatus[] = [
  'ABIERTA',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
  'CERRADA',
  'ANULADA',
]

describe('NCStatusBadge', () => {
  it.each(ALL_STATUSES)('renders without error for status %s', (status) => {
    expect(() => render(<NCStatusBadge status={status} />)).not.toThrow()
  })

  it('renders ABIERTA with teal color classes', () => {
    const { container } = render(<NCStatusBadge status="ABIERTA" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-teal/20')
    expect(badge?.className).toContain('text-teal')
  })

  it('renders EN_INVESTIGACION with amber color classes', () => {
    const { container } = render(<NCStatusBadge status="EN_INVESTIGACION" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-amber/20')
    expect(badge?.className).toContain('text-amber')
  })

  it('renders ANALISIS_COMPLETADO with stronger amber color classes', () => {
    const { container } = render(<NCStatusBadge status="ANALISIS_COMPLETADO" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-amber/30')
  })

  it('renders EN_EJECUCION with coral color classes', () => {
    const { container } = render(<NCStatusBadge status="EN_EJECUCION" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-coral/20')
    expect(badge?.className).toContain('text-coral')
  })

  it('renders PENDIENTE_CIERRE with warning color classes', () => {
    const { container } = render(<NCStatusBadge status="PENDIENTE_CIERRE" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-warning/20')
    expect(badge?.className).toContain('text-warning')
  })

  it('renders CERRADA with success color classes', () => {
    const { container } = render(<NCStatusBadge status="CERRADA" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-success/20')
    expect(badge?.className).toContain('text-success')
  })

  it('renders ANULADA with muted color and line-through', () => {
    const { container } = render(<NCStatusBadge status="ANULADA" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-muted-soft/20')
    expect(badge?.className).toContain('text-muted')
    const inner = badge?.querySelector('span')
    expect(inner?.className).toContain('line-through')
  })

  it('applies extra className when provided', () => {
    const { container } = render(<NCStatusBadge status="ABIERTA" className="test-class" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('test-class')
  })
})
