import { act, render, renderHook, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import { useAuthStore } from '../../../stores/authStore'
import { createMockUser } from '../../../mocks/fixtures/mockUser'
import { invalidarDashboard } from './invalidarDashboard'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { AlertaCard } from '../components/layout/AlertaCard'
import { useAprobarCausaRaiz } from '../../quality-events/hooks/useAprobarCausaRaiz'
import { useFirmarCierre } from '../../quality-events/hooks/useFirmarCierre'
import type { DashboardSummaryData } from '../types/dashboardData.types'

const getDashboardSummaryMock = vi.fn()
vi.mock('../api/dashboard.api', () => ({
  getDashboardSummary: () => getDashboardSummaryMock(),
  getDashboardKpis: vi.fn(),
}))

vi.mock('../../quality-events/api/quality-events.api', () => ({
  aprobarCausaRaiz: vi.fn(async () => ({ id: 'qe-1' })),
  firmarCierre: vi.fn(async () => ({ id: 'qe-1' })),
}))

afterEach(() => cleanup())

let qc: QueryClient
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthStore.setState({ user: createMockUser({ id: 'user-jca', rol: 'JEFE_CALIDAD_SYST' }) })
})

function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

describe('invalidarDashboard', () => {
  it('invalidates the dashboard root key (summary and KPIs of every period)', () => {
    const spy = vi.spyOn(qc, 'invalidateQueries')
    invalidarDashboard(qc)
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('useAprobarCausaRaiz invalidates the dashboard on success', async () => {
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useAprobarCausaRaiz(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'qe-1', pin: '1234' })
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('useFirmarCierre invalidates the dashboard on success', async () => {
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useFirmarCierre(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'qe-1', data: { rol: 'SUPERVISOR', pin: '1234' } })
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('the alert card changes without reloading once the dashboard is invalidated', async () => {
    const summary = (n: number) =>
      ({ rol: 'JEFE_CALIDAD', data: { accionesCorrectivasVencidas: Array.from({ length: n }, (_, i) => ({ id: `ac-${i}` })) } }) as unknown as DashboardSummaryData
    getDashboardSummaryMock.mockResolvedValueOnce(summary(2)).mockResolvedValueOnce(summary(1))

    function Tarjeta() {
      const { data } = useDashboardSummary()
      if (data?.rol !== 'JEFE_CALIDAD') return null
      return <AlertaCard valor={data.data.accionesCorrectivasVencidas.length} titulo="AC vencidas" nivel="error" onSelect={() => {}} />
    }

    render(<Tarjeta />, { wrapper })
    expect(await screen.findByRole('button', { name: '2 AC vencidas' })).toBeInTheDocument()

    await act(async () => invalidarDashboard(qc))

    expect(await screen.findByRole('button', { name: '1 AC vencidas' })).toBeInTheDocument()
  })
})
