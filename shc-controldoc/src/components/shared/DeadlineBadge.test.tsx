import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../i18n/config'
import { DeadlineBadge } from './DeadlineBadge'

function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
)

describe('DeadlineBadge', () => {
  it('renders green badge when more than 14 days remain', () => {
    const { container } = render(
      <DeadlineBadge fechaCierre={addDays(20)} estado="ABIERTA" />,
      { wrapper },
    )
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-success/15')
    expect(badge?.className).toContain('text-success')
  })

  it('renders amber badge when 0–14 days remain', () => {
    const { container } = render(
      <DeadlineBadge fechaCierre={addDays(7)} estado="EN_INVESTIGACION" />,
      { wrapper },
    )
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-amber/15')
    expect(badge?.className).toContain('text-amber')
  })

  it('renders red badge when date is past due', () => {
    const { container } = render(
      <DeadlineBadge fechaCierre={addDays(-3)} estado="EN_EJECUCION" />,
      { wrapper },
    )
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('bg-error/15')
    expect(badge?.className).toContain('text-error')
  })

  it('renders plain date without badge when estado is CERRADA', () => {
    const { container } = render(
      <DeadlineBadge fechaCierre={addDays(5)} estado="CERRADA" />,
      { wrapper },
    )
    const badge = container.querySelector('span')
    expect(badge?.className).not.toContain('bg-success')
    expect(badge?.className).not.toContain('bg-amber')
    expect(badge?.className).not.toContain('bg-error')
  })

  it('renders plain date without badge when estado is ANULADA', () => {
    const { container } = render(
      <DeadlineBadge fechaCierre={addDays(5)} estado="ANULADA" />,
      { wrapper },
    )
    const badge = container.querySelector('span')
    expect(badge?.className).not.toContain('bg-success')
    expect(badge?.className).not.toContain('bg-amber')
    expect(badge?.className).not.toContain('bg-error')
  })

  it('renders dash when fechaCierre is null', () => {
    render(<DeadlineBadge fechaCierre={null} estado="ABIERTA" />, { wrapper })
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
