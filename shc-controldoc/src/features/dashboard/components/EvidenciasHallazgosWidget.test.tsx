import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { EvidenciasHallazgosWidget } from './EvidenciasHallazgosWidget'

afterEach(() => cleanup())

function renderWidget(evidenciasHallazgos: { conEvidencia: number; sinEvidencia: number }) {
  return render(
    <I18nextProvider i18n={i18n}>
      <EvidenciasHallazgosWidget evidenciasHallazgos={evidenciasHallazgos} />
    </I18nextProvider>,
  )
}

describe('EvidenciasHallazgosWidget', () => {
  it('renders both counts without any individual QE element or navigation', () => {
    renderWidget({ conEvidencia: 2, sinEvidencia: 3 })
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:auditor.evidenciasHallazgos.conEvidencia'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:auditor.evidenciasHallazgos.sinEvidencia'))).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
