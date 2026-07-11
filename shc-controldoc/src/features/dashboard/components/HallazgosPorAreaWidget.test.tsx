import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { HallazgosPorAreaWidget } from './HallazgosPorAreaWidget'

afterEach(() => cleanup())

function renderWidget(hallazgosPorArea: { area: string; total: number }[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <HallazgosPorAreaWidget hallazgosPorArea={hallazgosPorArea} />
    </I18nextProvider>,
  )
}

describe('HallazgosPorAreaWidget', () => {
  it('renders each area with its count, respecting the received order, without clickable rows', () => {
    renderWidget([
      { area: 'Zona de Pesaje', total: 3 },
      { area: 'Almacén Norte', total: 1 },
    ])
    expect(screen.getByText('Zona de Pesaje')).toBeInTheDocument()
    expect(screen.getByText('Almacén Norte')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an empty-state message when there are no findings', () => {
    renderWidget([])
    expect(screen.getByText(i18n.t('dashboard:auditor.hallazgosPorArea.empty'))).toBeInTheDocument()
  })
})
