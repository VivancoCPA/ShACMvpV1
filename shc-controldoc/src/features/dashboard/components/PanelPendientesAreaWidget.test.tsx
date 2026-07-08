import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { PanelPendientesAreaWidget } from './PanelPendientesAreaWidget'
import type { QEResumen, AccionCorrectivaResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

const baseQE: QEResumen = {
  id: 'qe-2026-100',
  numero: 'QE-2026-100',
  estado: 'EN_VERIFICACION',
  severidad: 'MEDIA',
  tipo: 'CALIDAD',
  origen: 'O1_INCIDENTE_CAMPO',
  areaAfectada: 'Almacén Norte',
  fechaHoraReporte: '2026-06-01T00:00:00Z',
  fechaVerificacionProgramada: new Date(Date.now() + 3 * 86_400_000).toISOString(),
}

function ac(overrides: Partial<AccionCorrectivaResumen>): AccionCorrectivaResumen {
  return {
    id: 'ac-1',
    origenTipo: 'QE',
    origenId: 'origen-1',
    descripcion: 'Acción correctiva de prueba',
    responsableId: 'user-operario-001',
    responsableNombre: 'Luis Quispe',
    plazoFecha: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    estado: 'PENDIENTE',
    ...overrides,
  }
}

function renderWidget(qesEnVerificacionArea: QEResumen[], accionesCorrectivasPendientesArea: AccionCorrectivaResumen[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <PanelPendientesAreaWidget
                qesEnVerificacionArea={qesEnVerificacionArea}
                accionesCorrectivasPendientesArea={accionesCorrectivasPendientesArea}
              />
            }
          />
          <Route path="/quality-events/:id" element={<div data-testid="qe-detail">qe-detail</div>} />
          <Route path="/nonconformities/:id" element={<div data-testid="nc-detail">nc-detail</div>} />
          <Route path="/incidents/:id" element={<div data-testid="incidente-detail">incidente-detail</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('PanelPendientesAreaWidget', () => {
  it('renders a SemaforoRow for a QE in verification', () => {
    const { container } = renderWidget([baseQE], [])
    expect(container.querySelector('.border-l-success, .border-l-warning, .border-l-error')).toBeInTheDocument()
    expect(screen.getByText('QE-2026-100')).toBeInTheDocument()
  })

  it('renders a SemaforoRow for a pending AC', () => {
    renderWidget([], [ac({ descripcion: 'AC de prueba' })])
    expect(screen.getByText('AC de prueba')).toBeInTheDocument()
  })

  it('navigates to /quality-events/:id when a QE row is clicked', async () => {
    const user = userEvent.setup()
    renderWidget([baseQE], [])
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('qe-detail')).toBeInTheDocument()
  })

  it.each([
    ['QE', '/quality-events'],
    ['NC', '/nonconformities'],
    ['INCIDENTE', '/incidents'],
  ] as const)('navigates to %s route when an AC row is clicked', async (origenTipo) => {
    const user = userEvent.setup()
    renderWidget([], [ac({ origenTipo, origenId: 'origen-99' })])
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId(origenTipo === 'QE' ? 'qe-detail' : origenTipo === 'NC' ? 'nc-detail' : 'incidente-detail')).toBeInTheDocument()
  })

  it('shows a single empty-state message when both lists are empty', () => {
    renderWidget([], [])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:supervisor.panelPendientes.empty'))).toBeInTheDocument()
  })
})
