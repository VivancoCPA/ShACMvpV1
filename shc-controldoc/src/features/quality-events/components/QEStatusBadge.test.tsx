import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { QEStatusBadge } from './QEStatusBadge'
import type { QEStatus } from '../types/qualityEvent.types'

const ALL_STATUSES: QEStatus[] = [
  'ABIERTO',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
  'CERRADO',
  'EN_VERIFICACION',
  'VERIFICADO',
  'REABIERTO',
]

describe('QEStatusBadge', () => {
  it.each(ALL_STATUSES)('renders without error for status %s', (status) => {
    expect(() => render(<QEStatusBadge status={status} />)).not.toThrow()
  })

  it('renders VERIFICADO with success green color and correct label', () => {
    const { container } = render(<QEStatusBadge status="VERIFICADO" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-success/15')
    expect(badge?.className).toContain('text-success')
    expect(badge?.textContent).toBe('Verificado')
  })

  it('renders REABIERTO with error red color', () => {
    const { container } = render(<QEStatusBadge status="REABIERTO" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-error/15')
    expect(badge?.className).toContain('text-error')
    expect(badge?.textContent).toBe('Reabierto')
  })

  it('renders ABIERTO with amber color', () => {
    const { container } = render(<QEStatusBadge status="ABIERTO" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-amber/15')
    expect(badge?.className).toContain('text-amber')
    expect(badge?.textContent).toBe('Abierto')
  })

  it('renders EN_VERIFICACION with yellow color distinct from teal', () => {
    const { container } = render(<QEStatusBadge status="EN_VERIFICACION" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('yellow')
    expect(badge?.className).not.toContain('teal')
  })

  it('applies extra className when provided', () => {
    const { container } = render(<QEStatusBadge status="CERRADO" className="test-class" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('test-class')
  })
})
