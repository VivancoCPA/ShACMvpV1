import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { TendenciaMensualWidget } from './TendenciaMensualWidget'
import type {
  JefeCalidadDashboardData,
  TendenciaMensualVolumenEntry,
} from '../types/dashboardData.types'

afterEach(() => cleanup())

const VOLUMEN: TendenciaMensualVolumenEntry[] = Array.from({ length: 12 }, (_, i) => {
  const mes = String(i + 1).padStart(2, '0')
  return { periodo: `2026-${mes}`, abiertos: i + 1, cerrados: i }
})

const KPIS: JefeCalidadDashboardData['tendenciaMensualKpis'] = {
  'KPI-01': VOLUMEN.map((v) => ({ periodo: v.periodo, valor: 50 + v.abiertos })),
  'KPI-04': VOLUMEN.map((v) => ({ periodo: v.periodo, valor: v.abiertos })),
  'KPI-05': VOLUMEN.map((v) => ({ periodo: v.periodo, valor: 100 - v.abiertos })),
}

function renderWidget() {
  return render(
    <I18nextProvider i18n={i18n}>
      <TendenciaMensualWidget tendenciaMensualVolumen={VOLUMEN} tendenciaMensualKpis={KPIS} />
    </I18nextProvider>,
  )
}

describe('TendenciaMensualWidget', () => {
  it('renders both chart titles and the range selector with 6 as the default', () => {
    renderWidget()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.tendencia.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.tendencia.volumen.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.tendencia.kpis.title'))).toBeInTheDocument()

    const boton6 = screen.getByRole('button', { name: i18n.t('dashboard:jefeCalidad.tendencia.rango.opciones.6') })
    expect(boton6).toHaveAttribute('aria-pressed', 'true')
    const boton3 = screen.getByRole('button', { name: i18n.t('dashboard:jefeCalidad.tendencia.rango.opciones.3') })
    expect(boton3).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the active range button when a different range is clicked', async () => {
    const user = userEvent.setup()
    renderWidget()
    const boton12 = screen.getByRole('button', { name: i18n.t('dashboard:jefeCalidad.tendencia.rango.opciones.12') })
    const boton6 = screen.getByRole('button', { name: i18n.t('dashboard:jefeCalidad.tendencia.rango.opciones.6') })

    expect(boton6).toHaveAttribute('aria-pressed', 'true')
    await user.click(boton12)
    expect(boton12).toHaveAttribute('aria-pressed', 'true')
    expect(boton6).toHaveAttribute('aria-pressed', 'false')
  })
})
