import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach, vi } from 'vitest'
import i18n from '../../../../i18n'
import { AlertaCard } from './AlertaCard'

function renderCard(props: Parameters<typeof AlertaCard>[0]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <AlertaCard {...props} />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

afterEach(() => cleanup())

describe('AlertaCard', () => {
  it('with value 0 it is neutral and says "Todo en orden"', () => {
    renderCard({ valor: 0, titulo: 'AC vencidas', subtitulo: 'ver →', nivel: 'error', to: '/x' })
    const link = screen.getByRole('link', { name: '0 AC vencidas' })
    expect(link).toHaveClass('bg-surface-soft')
    expect(link).not.toHaveClass('bg-error/10')
    expect(link).toHaveTextContent(i18n.t('dashboard:layout.todoEnOrden'))
    expect(link).not.toHaveTextContent('ver →')
  })

  it('with a value above 0 it uses the level color', () => {
    renderCard({ valor: 5, titulo: 'AC vencidas', nivel: 'error', to: '/x' })
    const link = screen.getByRole('link', { name: '5 AC vencidas' })
    expect(link).toHaveClass('bg-error/10')
    expect(link).toHaveTextContent('5')
  })

  // modulo-acciones-correctivas D13.
  it('supports the success level', () => {
    renderCard({ valor: 4, titulo: 'Cerradas este mes', nivel: 'success', onSelect: vi.fn(), activa: true })
    const button = screen.getByRole('button', { name: '4 Cerradas este mes' })
    expect(button).toHaveClass('bg-success/10')
    expect(button).toHaveClass('ring-success')
    expect(button).toHaveAttribute('data-nivel', 'success')
  })

  it('links to a list route', () => {
    renderCard({ valor: 2, titulo: 'QE críticos', nivel: 'info', to: '/quality-events?severidad=CRITICA' })
    expect(screen.getByRole('link', { name: '2 QE críticos' })).toHaveAttribute('href', '/quality-events?severidad=CRITICA')
  })

  it('renders a native anchor for an in-page hash target', () => {
    renderCard({ valor: 3, titulo: 'Firmas', nivel: 'warning', to: '#acciones-requeridas' })
    expect(screen.getByRole('link', { name: '3 Firmas' })).toHaveAttribute('href', '#acciones-requeridas')
  })

  it('has a visible focus style', () => {
    renderCard({ valor: 1, titulo: 'X', nivel: 'warning', to: '/x' })
    expect(screen.getByRole('link').className).toContain('focus-visible:ring-2')
  })

  it('as a selector renders a pressed button with the level ring and calls onSelect', () => {
    const onSelect = vi.fn()
    renderCard({ valor: 4, titulo: 'Aprobaciones', nivel: 'warning', onSelect, activa: true })
    const button = screen.getByRole('button', { name: '4 Aprobaciones' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.className).toContain('ring-amber')
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('an inactive selector is not pressed and has no ring', () => {
    renderCard({ valor: 4, titulo: 'Aprobaciones', nivel: 'warning', onSelect: () => {} })
    const button = screen.getByRole('button', { name: '4 Aprobaciones' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.className).not.toContain('ring-amber')
  })
})
