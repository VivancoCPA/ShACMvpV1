import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { MisACsWidget } from './MisACsWidget'
import type { AccionCorrectivaResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

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

function renderWidget(accionesCorrectivasAsignadas: AccionCorrectivaResumen[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={<MisACsWidget accionesCorrectivasAsignadas={accionesCorrectivasAsignadas} />}
          />
          <Route path="/quality-events/:id" element={<div data-testid="qe-detail">qe-detail</div>} />
          <Route path="/nonconformities/:id" element={<div data-testid="nc-detail">nc-detail</div>} />
          <Route path="/incidents/:id" element={<div data-testid="incidente-detail">incidente-detail</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('MisACsWidget', () => {
  it('navigates to /quality-events/:origenId for origenTipo QE', async () => {
    const user = userEvent.setup()
    renderWidget([ac({ origenTipo: 'QE', origenId: 'qe-2026-002' })])
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('qe-detail')).toBeInTheDocument()
  })

  it('navigates to /nonconformities/:origenId for origenTipo NC', async () => {
    const user = userEvent.setup()
    renderWidget([ac({ origenTipo: 'NC', origenId: 'nc-2026-010' })])
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('nc-detail')).toBeInTheDocument()
  })

  it('navigates to /incidents/:origenId for origenTipo INCIDENTE', async () => {
    const user = userEvent.setup()
    renderWidget([ac({ origenTipo: 'INCIDENTE', origenId: 'inc-2026-003' })])
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('incidente-detail')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no assigned ACs', () => {
    renderWidget([])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:operario.misACs.empty'))).toBeInTheDocument()
  })
})
