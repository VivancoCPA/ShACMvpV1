import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { QEsCriticosWidget } from './QEsCriticosWidget'
import type { QEResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

const qeCritico: QEResumen = {
  id: 'qe-2026-010',
  numero: 'QE-2026-010',
  estado: 'EN_INVESTIGACION',
  severidad: 'CRITICA',
  tipo: 'SST',
  origen: 'O1_INCIDENTE_CAMPO',
  areaAfectada: 'Almacén Sur',
  fechaHoraReporte: '2026-07-01T00:00:00Z',
}

function renderWidget(alertasCriticas: QEResumen[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<QEsCriticosWidget alertasCriticas={alertasCriticas} />} />
          <Route path="/quality-events/:id" element={<div data-testid="detail-page">detail-page</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('QEsCriticosWidget', () => {
  it('renders a row per critical QE and navigates to its detail on click', async () => {
    const user = userEvent.setup()
    renderWidget([qeCritico])
    expect(screen.getByText('QE-2026-010')).toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('detail-page')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no critical QEs', () => {
    renderWidget([])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.qesCriticos.empty'))).toBeInTheDocument()
  })
})
