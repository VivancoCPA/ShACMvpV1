import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IncidentListPage } from './IncidentListPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: null }) => unknown) => sel({ user: null }),
}))

vi.mock('../components/IncidentList', () => ({
  IncidentList: () => <div data-testid="incident-list">Lista</div>,
}))

vi.mock('./IncidentMapView', () => ({
  IncidentMapView: () => <div data-testid="incident-map">Mapa</div>,
}))

vi.mock('../../../components/layout/PageWrapper', () => ({
  PageWrapper: ({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) => (
    <div>
      <div data-testid="page-actions">{actions}</div>
      {children}
    </div>
  ),
}))

vi.mock('../../../components/shared/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/incidents${search}`]}>
      <Routes>
        <Route path="/incidents" element={<IncidentListPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('IncidentListPage — tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders Lista tab as active by default when no view param', () => {
    const { container } = renderPage()
    expect(within(container).getByTestId('incident-list')).toBeInTheDocument()
    expect(within(container).queryByTestId('incident-map')).not.toBeInTheDocument()
  })

  it('renders IncidentMapView when view=map', () => {
    const { container } = renderPage('?view=map')
    expect(within(container).getByTestId('incident-map')).toBeInTheDocument()
    expect(within(container).queryByTestId('incident-list')).not.toBeInTheDocument()
  })

  // Task 10.3: clicking Mapa tab preserves active filters
  it('clicking Mapa tab preserves active filter params (tipo=ACCIDENTE)', async () => {
    const user = userEvent.setup()
    const { container } = renderPage('?tipo=ACCIDENTE&view=list')

    const mapaBtn = within(container).getByRole('button', { name: /list\.tabs\.map/i })
    await user.click(mapaBtn)

    expect(within(container).getByTestId('incident-map')).toBeInTheDocument()
    expect(within(container).queryByTestId('incident-list')).not.toBeInTheDocument()
  })

  it('clicking Lista tab after Mapa returns to list view', async () => {
    const user = userEvent.setup()
    const { container } = renderPage('?view=map')

    const listaBtn = within(container).getByRole('button', { name: /list\.tabs\.list/i })
    await user.click(listaBtn)

    expect(within(container).getByTestId('incident-list')).toBeInTheDocument()
    expect(within(container).queryByTestId('incident-map')).not.toBeInTheDocument()
  })
})
