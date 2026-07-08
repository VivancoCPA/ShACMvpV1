// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'
import { dashboardHandlers } from '../../../mocks/handlers/dashboard.handlers'
import { useDashboardKpis } from './useDashboardKpis'

const server = setupServer(...dashboardHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('useDashboardKpis', () => {
  it('retorna los 9 KpiResult', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useDashboardKpis(), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(9)
  })

  it('dispara una nueva petición cuando cambia el periodo', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result, rerender } = renderHook(({ periodo }) => useDashboardKpis(periodo), {
      wrapper: makeWrapper(qc),
      initialProps: { periodo: '2026-02' },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const firstFetchedAt = result.current.dataUpdatedAt

    rerender({ periodo: '2026-03' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.dataUpdatedAt).not.toBe(firstFetchedAt)
    })
    expect(result.current.data).toHaveLength(9)
  })
})
