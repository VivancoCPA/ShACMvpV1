import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { SeverityBadge } from './SeverityBadge'
import type { NCSeveridad } from '../../features/nonconformities/types/nonconformity.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

const ALL_SEVERITIES: NCSeveridad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']

describe('SeverityBadge', () => {
  it.each(ALL_SEVERITIES)('renders without error for severity %s', (severity) => {
    expect(() => render(<SeverityBadge severity={severity} />)).not.toThrow()
  })

  it('renders BAJA with muted-soft color classes', () => {
    const { container } = render(<SeverityBadge severity="BAJA" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-muted-soft/20')
    expect(badge?.className).toContain('text-muted')
  })

  it('renders MEDIA with amber color classes', () => {
    const { container } = render(<SeverityBadge severity="MEDIA" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-amber/20')
    expect(badge?.className).toContain('text-amber')
  })

  it('renders ALTA with error/10 color classes', () => {
    const { container } = render(<SeverityBadge severity="ALTA" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-error/10')
    expect(badge?.className).toContain('text-error')
  })

  it('renders CRITICA with error/20 color classes and font-semibold', () => {
    const { container } = render(<SeverityBadge severity="CRITICA" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-error/20')
    expect(badge?.className).toContain('text-error')
    expect(badge?.className).toContain('font-semibold')
  })

  it('applies extra className when provided', () => {
    const { container } = render(<SeverityBadge severity="ALTA" className="custom" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('custom')
  })
})
