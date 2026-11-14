import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach, vi } from 'vitest'
import i18n from '../../../i18n'
import { ACsVencidasPorVencerWidget, type PestanaAcs } from './ACsVencidasPorVencerWidget'
import type { AccionCorrectivaResumen } from '../types/dashboardSummary.types'

afterEach(() => cleanup())

const DIA = 86_400_000

function ac(id: string, plazoMs: number): AccionCorrectivaResumen {
  return {
    id,
    origenTipo: 'QE',
    origenId: 'qe-1',
    descripcion: `AC ${id}`,
    responsableId: 'u',
    responsableNombre: 'U',
    tipo: 'CORRECTIVA',
    plazoFecha: new Date(Date.now() + plazoMs).toISOString(),
    estado: 'EN_EJECUCION',
  }
}

const vencidas = [ac('v1', -2 * DIA), ac('v2', -DIA)]
const porVencer = [ac('p1', DIA), ac('p2', 2 * DIA), ac('p3', 3 * DIA)]

function renderWidget(pestana: PestanaAcs, onCambiarPestana = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ACsVencidasPorVencerWidget vencidas={vencidas} porVencer={porVencer} pestana={pestana} onCambiarPestana={onCambiarPestana} />
      </MemoryRouter>
    </I18nextProvider>,
  )
  return onCambiarPestana
}

describe('ACsVencidasPorVencerWidget', () => {
  it('tab counters match the rows of the active tab', () => {
    renderWidget('vencidas')
    const tabVencidas = screen.getByRole('tab', { name: i18n.t('dashboard:acs.tabs.vencidas', { n: 2 }) })
    expect(tabVencidas).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: i18n.t('dashboard:acs.tabs.porVencer', { n: 3 }) })).toHaveAttribute('aria-selected', 'false')
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button')).toHaveLength(2)
  })

  it('renders the due-soon rows in the other tab', () => {
    renderWidget('porVencer')
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button')).toHaveLength(3)
  })

  it('clicking a tab asks to change it', async () => {
    const onCambiar = renderWidget('vencidas')
    await userEvent.setup().click(screen.getByRole('tab', { name: i18n.t('dashboard:acs.tabs.porVencer', { n: 3 }) }))
    expect(onCambiar).toHaveBeenCalledWith('porVencer')
  })
})
