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
  solicitudesAjustePlazo: [
    {
      id: 'sol-1',
      fechaSolicitada: '2026-04-15',
      justificacion: 'Rotación de personal.',
      estado: 'PENDIENTE',
      solicitadoPorId: 'user-operario-001',
      solicitadoEn: '2026-03-05T09:00:00Z',
      requiereAprobacionGerencia: true,
    },
  ],
}

const acConSolicitudJefeCalidad: ACSolicitudAjustePlazoResumen = {
  qeId: 'qe-2026-013',
  qeNumero: 'QE-2026-013',
  qeSeveridad: 'ALTA',
  acId: 'ac-qe-013-2',
  acDescripcion: 'Auditoría de duplicidad de registros',
  plazoFechaActual: '2026-03-01',
  solicitudesAjustePlazo: [
    {
      id: 'sol-2',
      fechaSolicitada: '2026-03-10',
      justificacion: 'Solicitud que solo requiere aprobación de Jefe de Calidad.',
      estado: 'PENDIENTE',
      solicitadoPorId: 'user-005',
      solicitadoEn: '2026-02-20T09:00:00Z',
      requiereAprobacionGerencia: false,
    },
  ],
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

  it('hides an AC whose only pending request only needs Jefe de Calidad approval', () => {
    renderWidget([acConSolicitudJefeCalidad])
    expect(screen.queryByText('QE-2026-013')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.acsExtensionPlazo.empty'))).toBeInTheDocument()
  })
})
