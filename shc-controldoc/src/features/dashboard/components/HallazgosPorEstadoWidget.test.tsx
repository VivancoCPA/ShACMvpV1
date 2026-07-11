import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { HallazgosPorEstadoWidget } from './HallazgosPorEstadoWidget'
import type { QEStatus } from '../../quality-events/types/qualityEvent.types'

afterEach(() => cleanup())

const HALLAZGOS_POR_ESTADO: Record<QEStatus, number> = {
  ABIERTO: 2,
  EN_INVESTIGACION: 1,
  ANALISIS_COMPLETADO: 0,
  EN_EJECUCION: 0,
  PENDIENTE_CIERRE: 1,
  CERRADO: 1,
  EN_VERIFICACION: 0,
  VERIFICADO: 0,
  REABIERTO: 0,
}

function renderWidget(hallazgosPorEstado: Record<QEStatus, number> = HALLAZGOS_POR_ESTADO) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<HallazgosPorEstadoWidget hallazgosPorEstado={hallazgosPorEstado} />} />
          <Route path="/quality-events" element={<div data-testid="qe-list">qe-list</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('HallazgosPorEstadoWidget', () => {
  it('renders exactly 9 rows, all as buttons, showing 0 for states without findings', () => {
    renderWidget()
    expect(screen.getAllByRole('button')).toHaveLength(9)
    expect(screen.getAllByText('0')).toHaveLength(5)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('navigates with both estado and origen filters when a row is clicked', async () => {
    const user = userEvent.setup()
    renderWidget()
    await user.click(
      screen.getByRole('button', { name: i18n.t('dashboard:jefeCalidad.qePorEstado.estados.PENDIENTE_CIERRE') }),
    )
    expect(screen.getByTestId('qe-list')).toBeInTheDocument()
  })
})
