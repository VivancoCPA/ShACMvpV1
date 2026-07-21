import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach, vi } from 'vitest'
import i18n from '../../../i18n'
import { TasaCierrePorAreaWidget } from './TasaCierrePorAreaWidget'

vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: undefined }),
}))

afterEach(() => cleanup())

function renderWidget(tasaCierreEnPlazoPorArea: { areaId: string; tasaCierreEnPlazo: number; totalCerrados: number }[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TasaCierrePorAreaWidget tasaCierreEnPlazoPorArea={tasaCierreEnPlazoPorArea} />
    </I18nextProvider>,
  )
}

describe('TasaCierrePorAreaWidget', () => {
  it('renders each area with its percentage and total, respecting the received order, without clickable rows', () => {
    renderWidget([
      { areaId: 'Zona de Pesaje', tasaCierreEnPlazo: 45, totalCerrados: 2 },
      { areaId: 'Almacén Norte', tasaCierreEnPlazo: 100, totalCerrados: 5 },
    ])
    expect(screen.getByText('Zona de Pesaje')).toBeInTheDocument()
    expect(screen.getByText('Almacén Norte')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:auditor.tasaCierrePorArea.porcentaje', { valor: 45 }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:auditor.tasaCierrePorArea.porcentaje', { valor: 100 }))).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an empty-state message when no area has closed Quality Events in the period', () => {
    renderWidget([])
    expect(screen.getByText(i18n.t('dashboard:auditor.tasaCierrePorArea.empty'))).toBeInTheDocument()
  })
})
