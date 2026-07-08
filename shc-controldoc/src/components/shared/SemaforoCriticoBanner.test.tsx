import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { SemaforoCriticoBanner } from './SemaforoCriticoBanner'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
)

const items = [
  { id: 'qe-1', codigo: 'QE-2026-001', descripcion: 'Derrame de mineral en zona A' },
  { id: 'qe-2', codigo: 'QE-2026-002', descripcion: 'Incidente en faja transportadora' },
]

describe('SemaforoCriticoBanner', () => {
  it('renders nothing when there are no critical items', () => {
    const { container } = render(<SemaforoCriticoBanner items={[]} />, { wrapper })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the banner with danger styling when critical items exist', () => {
    const { container } = render(<SemaforoCriticoBanner items={items} />, { wrapper })
    const banner = container.firstChild as HTMLElement
    expect(banner.className).toContain('bg-error/10')
    expect(banner.className).toContain('border-error')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('lists each critical item codigo and descripcion', () => {
    const { container } = render(<SemaforoCriticoBanner items={items} />, { wrapper })
    expect(within(container).getByText(/QE-2026-001/)).toBeInTheDocument()
    expect(within(container).getByText(/Derrame de mineral en zona A/)).toBeInTheDocument()
    expect(within(container).getByText(/QE-2026-002/)).toBeInTheDocument()
    expect(within(container).getByText(/Incidente en faja transportadora/)).toBeInTheDocument()
  })

  it('supports dark mode classes', () => {
    const { container } = render(<SemaforoCriticoBanner items={items} />, { wrapper })
    const banner = container.firstChild as HTMLElement
    expect(banner.className).toContain('dark:bg-error/15')
    expect(banner.className).toContain('dark:border-error')
  })

  it('invokes onItemClick with the item id when an item is activated', async () => {
    const user = userEvent.setup()
    const onItemClick = vi.fn()
    const { container } = render(<SemaforoCriticoBanner items={items} onItemClick={onItemClick} />, {
      wrapper,
    })
    const button = within(container).getByRole('button', { name: /QE-2026-002/ })
    await user.click(button)
    expect(onItemClick).toHaveBeenCalledWith('qe-2')
  })
})
