import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { ACsPorVencerWidget } from './ACsPorVencerWidget'
import type { AccionCorrectivaResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

function ac(overrides: Partial<AccionCorrectivaResumen>): AccionCorrectivaResumen {
  return {
    id: 'ac-1',
    origenTipo: 'QE',
    origenId: 'origen-1',
    descripcion: 'AC de prueba',
    responsableId: 'user-operario-001',
    responsableNombre: 'Luis Quispe',
    plazoFecha: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    estado: 'EN_EJECUCION',
    ...overrides,
  }
}

function renderWidget(accionesCorrectivasPorVencer: AccionCorrectivaResumen[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={<ACsPorVencerWidget accionesCorrectivasPorVencer={accionesCorrectivasPorVencer} />}
          />
          <Route path="/quality-events/:id" element={<div data-testid="qe-detail">qe-detail</div>} />
          <Route path="/nonconformities/:id" element={<div data-testid="nc-detail">nc-detail</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('ACsPorVencerWidget', () => {
  it('shows overdue ACs inside the critical banner', () => {
    const vencidas = [
      ac({ id: 'ac-vencida-1', plazoFecha: new Date(Date.now() - 2 * 86_400_000).toISOString() }),
      ac({ id: 'ac-vencida-2', plazoFecha: new Date(Date.now() - 5 * 86_400_000).toISOString() }),
    ]
    renderWidget(vencidas)
    expect(screen.getByText(i18n.t('dashboard:semaforo.criticoBanner.title'))).toBeInTheDocument()
    expect(screen.getByText(/2 evento/)).toBeInTheDocument()
  })

  it('shows upcoming ACs (1-5 business days) as SemaforoRow outside the banner', () => {
    const proxima = ac({ id: 'ac-proxima', plazoFecha: new Date(Date.now() + 3 * 86_400_000).toISOString() })
    renderWidget([proxima])
    expect(screen.queryByText(i18n.t('dashboard:semaforo.criticoBanner.title'))).not.toBeInTheDocument()
    expect(screen.getByText('AC de prueba')).toBeInTheDocument()
  })

  it('navigates to the NC detail when clicking a row whose origenTipo is NC', async () => {
    const user = userEvent.setup()
    const proxima = ac({ id: 'ac-nc', origenTipo: 'NC', origenId: 'nc-005', plazoFecha: new Date(Date.now() + 3 * 86_400_000).toISOString() })
    renderWidget([proxima])
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('nc-detail')).toBeInTheDocument()
  })

  it('shows an empty state when there are no ACs due soon', () => {
    renderWidget([])
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.acsPorVencer.empty'))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('dashboard:semaforo.criticoBanner.title'))).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
