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

function loginAs(rol: 'OPERARIO' | 'SUPERVISOR' | 'JEFE_CALIDAD_SYST' | 'JEFE_CONTROL_DOCUMENTARIO' | 'AUDITOR_INTERNO') {
  useAuthStore.setState({
    user: {
      id: 'user-1',
      nombre: 'Test',
      apellido: 'User',
      email: 't@shac.pe',
      rol,
      area: 'Operaciones',
      areasAsignadas: rol === 'SUPERVISOR' ? ['Operaciones'] : undefined,
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

  it('renders JefeCalidadDashboard for rol JEFE_CONTROL_DOCUMENTARIO', () => {
    loginAs('JEFE_CONTROL_DOCUMENTARIO')
    renderPage()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.title'))).toBeInTheDocument()
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
  })

  it('renders ComingSoon for any other rol (e.g. AUDITOR_INTERNO)', () => {
    loginAs('AUDITOR_INTERNO')
    renderPage()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('dashboard:operario.title'))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('dashboard:supervisor.title'))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('dashboard:jefeCalidad.title'))).not.toBeInTheDocument()
  })
})
