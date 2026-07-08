import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { QEPorTipoWidget } from './QEPorTipoWidget'

afterEach(() => cleanup())

function renderWidget(qeAbiertosPorTipo: Record<'CALIDAD' | 'SST' | 'ADUANERO' | 'OPERACIONAL', number>) {
  return render(
    <I18nextProvider i18n={i18n}>
      <QEPorTipoWidget qeAbiertosPorTipo={qeAbiertosPorTipo} />
    </I18nextProvider>,
  )
}

describe('QEPorTipoWidget', () => {
  it('renders all 4 QEType rows, including counts of 0', () => {
    renderWidget({ CALIDAD: 3, SST: 0, ADUANERO: 1, OPERACIONAL: 0 })
    expect(screen.getByText(i18n.t('dashboard:supervisor.qePorTipo.tipos.CALIDAD'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:supervisor.qePorTipo.tipos.SST'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:supervisor.qePorTipo.tipos.ADUANERO'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:supervisor.qePorTipo.tipos.OPERACIONAL'))).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(2)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
