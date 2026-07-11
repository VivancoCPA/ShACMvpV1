import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { ReaperturasWidget } from './ReaperturasWidget'
import type { QEReaperturaResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

const reapertura: QEReaperturaResumen = {
  id: 'qe-2026-005',
  numero: 'QE-2026-005',
  estado: 'REABIERTO',
  severidad: 'ALTA',
  tipo: 'SST',
  origen: 'O1_INCIDENTE_CAMPO',
  areaAfectada: 'Almacén Norte',
  fechaHoraReporte: '2026-01-10T09:30:00Z',
  ciclo: 2,
  fechaReapertura: '2026-05-01T09:00:00Z',
}

function renderWidget(reaperturas: QEReaperturaResumen[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ReaperturasWidget reaperturas={reaperturas} />} />
          <Route path="/quality-events/:id" element={<div data-testid="detail-page">detail-page</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('ReaperturasWidget', () => {
  it('renders the ciclo and navigates to the QE detail on click', async () => {
    const user = userEvent.setup()
    renderWidget([reapertura])
    expect(screen.getByText('QE-2026-005')).toBeInTheDocument()
    expect(screen.getByRole('button').textContent).toContain('2')
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('detail-page')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no reaperturas', () => {
    renderWidget([])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.reaperturas.empty'))).toBeInTheDocument()
  })
})
