import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { IncidentesRecientesWidget } from './IncidentesRecientesWidget'
import type { IncidenteResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

const baseIncidente: IncidenteResumen = {
  id: 'inc-102',
  numero: 'INC-2026-102',
  tipo: 'ACCIDENTE',
  estado: 'ABIERTO',
  severidad: 'ALTA',
  fechaEvento: '2026-06-01T00:00:00Z',
  areaId: 'Almacén Norte',
}

function renderWidget(incidentesRecientes: IncidenteResumen[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<IncidentesRecientesWidget incidentesRecientes={incidentesRecientes} />} />
          <Route path="/incidents/:id" element={<div data-testid="incidente-detail">incidente-detail</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('IncidentesRecientesWidget', () => {
  it('renders numero, tipo and severidad for each incident', () => {
    renderWidget([baseIncidente])
    expect(screen.getByText('INC-2026-102')).toBeInTheDocument()
  })

  it('navigates to /incidents/:id on row click', async () => {
    const user = userEvent.setup()
    renderWidget([baseIncidente])
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('incidente-detail')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no recent incidents', () => {
    renderWidget([])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:supervisor.incidentesRecientes.empty'))).toBeInTheDocument()
  })
})
