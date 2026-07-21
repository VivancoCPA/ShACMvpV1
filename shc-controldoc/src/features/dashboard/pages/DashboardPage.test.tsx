import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { DashboardPage } from './DashboardPage'
import { useAuthStore } from '../../../stores/authStore'

afterEach(() => {
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

function loginAs(rol: 'OPERARIO' | 'SUPERVISOR' | 'JEFE_CALIDAD_SYST' | 'JEFE_CONTROL_DOCUMENTARIO' | 'AUDITOR_INTERNO' | 'ALTA_DIRECCION') {
  useAuthStore.setState({
    user: {
      id: 'user-1',
      nombre: 'Test',
      apellido: 'User',
      email: 't@shac.pe',
      rol,
      areaId: 'area-016',
      areaIds: rol === 'SUPERVISOR' ? ['area-016'] : undefined,
    },
    accessToken: 'token',
    isAuthenticated: true,
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

describe('DashboardPage', () => {
  it('renders OperarioDashboard for rol OPERARIO', () => {
    loginAs('OPERARIO')
    renderPage()
    expect(screen.getByText(i18n.t('dashboard:operario.title'))).toBeInTheDocument()
  })

  it('renders SupervisorDashboard for rol SUPERVISOR', () => {
    loginAs('SUPERVISOR')
    renderPage()
    expect(screen.getByText(i18n.t('dashboard:supervisor.title'))).toBeInTheDocument()
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
  })

  it('renders JefeCalidadDashboard for rol JEFE_CALIDAD_SYST', () => {
    loginAs('JEFE_CALIDAD_SYST')
    renderPage()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.title'))).toBeInTheDocument()
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
  })

  it('renders JefeControlDocumentarioDashboard for rol JEFE_CONTROL_DOCUMENTARIO', () => {
    loginAs('JEFE_CONTROL_DOCUMENTARIO')
    renderPage()
    expect(screen.getByText(i18n.t('dashboard:jefeControlDoc.title'))).toBeInTheDocument()
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
  })

  it('renders AltaDireccionDashboard for rol ALTA_DIRECCION', () => {
    loginAs('ALTA_DIRECCION')
    renderPage()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.title'))).toBeInTheDocument()
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
  })

  it('renders AuditorDashboard for rol AUDITOR_INTERNO', () => {
    loginAs('AUDITOR_INTERNO')
    renderPage()
    expect(screen.getByText(i18n.t('dashboard:auditor.title'))).toBeInTheDocument()
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
  })
})
