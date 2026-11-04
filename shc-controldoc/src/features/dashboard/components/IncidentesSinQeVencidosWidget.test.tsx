import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { IncidentesSinQeVencidosWidget } from './IncidentesSinQeVencidosWidget'
import type { IncidenteResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

const NOW = new Date('2026-10-21T12:00:00Z')

function incidente(overrides: Partial<IncidenteResumen>): IncidenteResumen {
  return {
    id: 'inc-201',
    numero: 'INC-2026-201',
    tipo: 'ACCIDENTE',
    estado: 'ABIERTO',
    severidad: 'ALTA',
    // ACCIDENTE (24 h) con 30 h transcurridas → vencido hace 6 h.
    fechaEvento: '2026-10-20T06:00:00Z',
    areaId: 'Almacén Norte',
    ...overrides,
  }
}

function renderWidget(items: IncidenteResumen[], total = items.length) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={<IncidentesSinQeVencidosWidget incidentesSinQeVencidos={items} incidentesSinQeVencidosTotal={total} now={NOW} />}
          />
          <Route path="/incidents/:id" element={<div data-testid="incidente-detail" />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('IncidentesSinQeVencidosWidget', () => {
  it('muestra número, tipo y "Vencido hace …" de cada incidente, y el total', async () => {
    await i18n.changeLanguage('es-PE')
    renderWidget(
      [
        incidente({}),
        // INCIDENTE (48 h) con 4 d 2 h transcurridos → vencido hace 2 d 2 h.
        incidente({ id: 'inc-202', numero: 'INC-2026-202', tipo: 'INCIDENTE', fechaEvento: '2026-10-17T10:00:00Z' }),
      ],
      12,
    )

    expect(screen.getByText('INC-2026-201')).toBeInTheDocument()
    expect(screen.getByText('INC-2026-202')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByText(/Vencido hace 6 h/)).toBeInTheDocument()
    expect(screen.getByText(/Vencido hace 2 d 2 h/)).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('muestra el estado vacío sin elementos', async () => {
    await i18n.changeLanguage('es-PE')
    renderWidget([])

    expect(screen.getByText('No hay incidentes con el plazo vencido.')).toBeInTheDocument()
  })

  it('cada fila enlaza al detalle del incidente', async () => {
    renderWidget([incidente({})])

    await userEvent.click(screen.getByText('INC-2026-201'))

    expect(screen.getByTestId('incidente-detail')).toBeInTheDocument()
  })
})
