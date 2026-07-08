import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { MisQEsWidget } from './MisQEsWidget'
import type { QEResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

const baseQE: QEResumen = {
  id: 'qe-2026-100',
  numero: 'QE-2026-100',
  estado: 'ABIERTO',
  severidad: 'MEDIA',
  tipo: 'CALIDAD',
  origen: 'O1_INCIDENTE_CAMPO',
  areaAfectada: 'Almacén Norte',
  fechaHoraReporte: '2026-06-01T00:00:00Z',
}

function renderWidget(misQEReportados: QEResumen[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<MisQEsWidget misQEReportados={misQEReportados} />} />
          <Route path="/quality-events/:id" element={<div data-testid="detail-page">detail-page</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('MisQEsWidget', () => {
  it('renders a SemaforoRow for a QE en EN_VERIFICACION with fechaVerificacionProgramada', () => {
    const qe: QEResumen = {
      ...baseQE,
      estado: 'EN_VERIFICACION',
      fechaVerificacionProgramada: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    }
    const { container } = renderWidget([qe])
    expect(container.querySelector('.border-l-success, .border-l-warning, .border-l-error')).toBeInTheDocument()
  })

  it('renders a simple row with QEStatusBadge for any other estado', () => {
    const qe: QEResumen = { ...baseQE, estado: 'ABIERTO' }
    const { container } = renderWidget([qe])
    expect(container.querySelector('.border-l-success, .border-l-warning, .border-l-error')).not.toBeInTheDocument()
    expect(screen.getByText('QE-2026-100')).toBeInTheDocument()
  })

  it('navigates to the QE detail on row click', async () => {
    const user = userEvent.setup()
    renderWidget([baseQE])
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('detail-page')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no reported QEs', () => {
    renderWidget([])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:operario.misQEs.empty'))).toBeInTheDocument()
  })
})
