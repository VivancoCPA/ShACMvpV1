import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../i18n/config'
import { Pagination } from './Pagination'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
)

describe('Pagination', () => {
  it('renders showing summary with correct range', () => {
    render(
      <Pagination currentPage={2} totalPages={5} totalItems={23} pageSize={5} onPageChange={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByText(/6.+10.+23/)).toBeInTheDocument()
  })

  it('previous button is disabled on first page', () => {
    render(
      <Pagination currentPage={1} totalPages={3} totalItems={15} pageSize={5} onPageChange={vi.fn()} />,
      { wrapper },
    )
    const prev = screen.getByText('←')
    expect(prev).toBeDisabled()
  })

  it('next button is disabled on last page', () => {
    render(
      <Pagination currentPage={3} totalPages={3} totalItems={15} pageSize={5} onPageChange={vi.fn()} />,
      { wrapper },
    )
    const next = screen.getByText('→')
    expect(next).toBeDisabled()
  })

  it('active page button has aria-current=page', () => {
    render(
      <Pagination currentPage={2} totalPages={5} totalItems={25} pageSize={5} onPageChange={vi.fn()} />,
      { wrapper },
    )
    const activePage = screen.getByRole('button', { name: '2' })
    expect(activePage).toHaveAttribute('aria-current', 'page')
  })

  it('calls onPageChange with correct page when button clicked', async () => {
    const onPageChange = vi.fn()
    render(
      <Pagination currentPage={1} totalPages={5} totalItems={25} pageSize={5} onPageChange={onPageChange} />,
      { wrapper },
    )
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('does not render when totalItems is zero', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} totalItems={0} pageSize={5} onPageChange={vi.fn()} />,
      { wrapper },
    )
    expect(container.firstChild).toBeNull()
  })
})
