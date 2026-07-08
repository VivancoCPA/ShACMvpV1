import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { SemaforoRow } from './SemaforoRow'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
)

describe('SemaforoRow', () => {
  it('renders success-colored left border and neutral background for VERDE', () => {
    const { container } = render(
      <SemaforoRow estado="VERDE" codigo="QE-2026-001" descripcion="desc" diasHabilesRestantes={7} />,
      { wrapper },
    )
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain('border-l-success')
    expect(row.className).toContain('bg-surface-card')
    expect(row.className).not.toMatch(/\bbg-success/)
  })

  it('renders warning-colored left border and neutral background for AMARILLO', () => {
    const { container } = render(
      <SemaforoRow estado="AMARILLO" codigo="QE-2026-002" descripcion="desc" diasHabilesRestantes={3} />,
      { wrapper },
    )
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain('border-l-warning')
    expect(row.className).toContain('bg-surface-card')
    expect(row.className).not.toMatch(/\bbg-warning/)
  })

  it('renders error-colored left border and neutral background for ROJO', () => {
    const { container } = render(
      <SemaforoRow estado="ROJO" codigo="QE-2026-003" descripcion="desc" diasHabilesRestantes={-2} />,
      { wrapper },
    )
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain('border-l-error')
    expect(row.className).toContain('bg-surface-card')
    expect(row.className).not.toMatch(/\bbg-error/)
  })

  it('does not round the left edge', () => {
    const { container } = render(
      <SemaforoRow estado="VERDE" codigo="QE-2026-001" descripcion="desc" diasHabilesRestantes={7} />,
      { wrapper },
    )
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain('rounded-l-none')
  })

  it('renders "vence en" text for positive dias restantes', () => {
    const { container } = render(
      <SemaforoRow estado="VERDE" codigo="QE-2026-001" descripcion="desc" diasHabilesRestantes={7} />,
      { wrapper },
    )
    expect(within(container).getByText('Vence en 7d')).toBeInTheDocument()
  })

  it('renders "vence hoy" text for zero dias restantes', () => {
    const { container } = render(
      <SemaforoRow estado="ROJO" codigo="QE-2026-001" descripcion="desc" diasHabilesRestantes={0} />,
      { wrapper },
    )
    expect(within(container).getByText('Vence hoy')).toBeInTheDocument()
  })

  it('renders "vencido hace" text with absolute value for negative dias restantes', () => {
    const { container } = render(
      <SemaforoRow estado="ROJO" codigo="QE-2026-001" descripcion="desc" diasHabilesRestantes={-5} />,
      { wrapper },
    )
    expect(within(container).getByText('Vencido hace 5d')).toBeInTheDocument()
  })

  it('renders as a button and invokes onClick when provided', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { container } = render(
      <SemaforoRow estado="VERDE" codigo="QE-2026-001" descripcion="desc" diasHabilesRestantes={7} onClick={onClick} />,
      { wrapper },
    )
    const button = within(container).getByRole('button')
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not render as a button when onClick is omitted', () => {
    const { container } = render(
      <SemaforoRow estado="VERDE" codigo="QE-2026-001" descripcion="desc" diasHabilesRestantes={7} />,
      { wrapper },
    )
    expect(within(container).queryByRole('button')).not.toBeInTheDocument()
  })
})
