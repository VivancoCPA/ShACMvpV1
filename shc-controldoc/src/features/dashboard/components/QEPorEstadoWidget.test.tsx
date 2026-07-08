import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { QEPorEstadoWidget } from './QEPorEstadoWidget'
import type { QEStatus } from '../../quality-events/types/qualityEvent.types'

afterEach(() => cleanup())

const QE_POR_ESTADO: Record<QEStatus, number> = {
  ABIERTO: 3,
  EN_INVESTIGACION: 1,
  ANALISIS_COMPLETADO: 0,
  EN_EJECUCION: 2,
  PENDIENTE_CIERRE: 1,
  CERRADO: 5,
  EN_VERIFICACION: 2,
  VERIFICADO: 4,
  REABIERTO: 0,
}

function renderWidget(qePorEstado: Record<QEStatus, number> = QE_POR_ESTADO, initialEntries = ['/dashboard']) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/dashboard" element={<QEPorEstadoWidget qePorEstado={qePorEstado} />} />
          <Route path="/quality-events" element={<div data-testid="qe-list">qe-list</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('QEPorEstadoWidget', () => {
  it('renders all 9 status rows with their exact count, including zeros', () => {
    renderWidget()
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(2)
  })

  it('navigates to the filtered list when clicking the ANALISIS_COMPLETADO row', async () => {
    const user = userEvent.setup()
    renderWidget()
    await user.click(screen.getByRole('button', { name: i18n.t('dashboard:jefeCalidad.qePorEstado.estados.ANALISIS_COMPLETADO') }))
    expect(screen.getByTestId('qe-list')).toBeInTheDocument()
  })

  it('navigates to the filtered list when clicking the PENDIENTE_CIERRE row', async () => {
    const user = userEvent.setup()
    renderWidget()
    await user.click(screen.getByRole('button', { name: i18n.t('dashboard:jefeCalidad.qePorEstado.estados.PENDIENTE_CIERRE') }))
    expect(screen.getByTestId('qe-list')).toBeInTheDocument()
  })

  it('does not expose the ABIERTO row as a button', () => {
    renderWidget()
    expect(
      screen.queryByRole('button', { name: i18n.t('dashboard:jefeCalidad.qePorEstado.estados.ABIERTO') }),
    ).not.toBeInTheDocument()
  })
})
