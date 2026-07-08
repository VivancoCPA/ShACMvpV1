import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { ACsVencidasWidget } from './ACsVencidasWidget'
import type { AccionCorrectivaResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

function ac(overrides: Partial<AccionCorrectivaResumen>): AccionCorrectivaResumen {
  return {
    id: 'ac-1',
    origenTipo: 'QE',
    origenId: 'origen-1',
    descripcion: 'AC vencida de prueba',
    responsableId: 'user-operario-001',
    responsableNombre: 'Luis Quispe',
    plazoFecha: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    estado: 'EN_EJECUCION',
    ...overrides,
  }
}

function renderWidget(accionesCorrectivasVencidas: AccionCorrectivaResumen[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ACsVencidasWidget accionesCorrectivasVencidas={accionesCorrectivasVencidas} />} />
          <Route path="/quality-events/:id" element={<div data-testid="qe-detail">qe-detail</div>} />
          <Route path="/nonconformities/:id" element={<div data-testid="nc-detail">nc-detail</div>} />
          <Route path="/incidents/:id" element={<div data-testid="incidente-detail">incidente-detail</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('ACsVencidasWidget', () => {
  it.each([
    ['QE', 'qe-detail'],
    ['NC', 'nc-detail'],
    ['INCIDENTE', 'incidente-detail'],
  ] as const)('navigates to the %s origin detail on row click', async (origenTipo, testId) => {
    const user = userEvent.setup()
    renderWidget([ac({ origenTipo, origenId: 'origen-99' })])
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId(testId)).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no overdue ACs', () => {
    renderWidget([])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:supervisor.acsVencidas.empty'))).toBeInTheDocument()
  })
})
