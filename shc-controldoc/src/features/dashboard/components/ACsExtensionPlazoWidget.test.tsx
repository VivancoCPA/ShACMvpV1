import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { ACsExtensionPlazoWidget } from './ACsExtensionPlazoWidget'
import type { ACSolicitudAjustePlazoResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

const acConSolicitud: ACSolicitudAjustePlazoResumen = {
  qeId: 'qe-2026-005',
  qeNumero: 'QE-2026-005',
  qeSeveridad: 'ALTA',
  acId: 'ac-qe-005-2',
  acDescripcion: 'Auditoría sorpresa de uso de EPP',
  plazoFechaActual: '2026-03-15',
  solicitudAjustePlazo: {
    fechaSolicitada: '2026-04-15',
    justificacion: 'Rotación de personal.',
    estado: 'PENDIENTE',
    solicitadoPorId: 'user-operario-001',
    solicitadoEn: '2026-03-05T09:00:00Z',
  },
}

function renderWidget(acs: ACSolicitudAjustePlazoResumen[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ACsExtensionPlazoWidget acs={acs} />} />
          <Route path="/quality-events/:id" element={<div data-testid="detail-page">detail-page</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('ACsExtensionPlazoWidget', () => {
  it('renders the AC and navigates to the parent QE detail on click, with no approve/reject buttons', async () => {
    const user = userEvent.setup()
    renderWidget([acConSolicitud])
    expect(screen.getByText('QE-2026-005')).toBeInTheDocument()
    expect(screen.queryByText(/aprobar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/rechazar/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('detail-page')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no pending requests', () => {
    renderWidget([])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.acsExtensionPlazo.empty'))).toBeInTheDocument()
  })
})
