import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { HallazgosPorNormaWidget } from './HallazgosPorNormaWidget'
import type { NormaISO } from '../../quality-events/types/qualityEvent.types'

afterEach(() => cleanup())

function renderWidget(hallazgosPorNorma: { norma: NormaISO; total: number }[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <HallazgosPorNormaWidget hallazgosPorNorma={hallazgosPorNorma} />
    </I18nextProvider>,
  )
}

describe('HallazgosPorNormaWidget', () => {
  it('renders each norma with a readable label and its count, respecting the received order, without clickable rows', () => {
    renderWidget([
      { norma: 'ISO_9001_2015', total: 3 },
      { norma: 'ISO_45001_2018', total: 1 },
      { norma: 'OTRA', total: 2 },
    ])
    expect(screen.getByText('ISO 9001:2015')).toBeInTheDocument()
    expect(screen.getByText('ISO 45001:2018')).toBeInTheDocument()
    expect(screen.getByText('Otra normativa')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an empty-state message when there are no findings', () => {
    renderWidget([])
    expect(screen.getByText(i18n.t('dashboard:auditor.hallazgosPorNorma.empty'))).toBeInTheDocument()
  })
})
