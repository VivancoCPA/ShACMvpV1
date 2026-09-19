// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'
import { documentHandlers } from '../../../../mocks/handlers/documents.handlers'
import { documentFixtures } from '../../../../mocks/fixtures/documents.fixtures'
import { useAuthStore } from '../../../../stores/authStore'
import { useDocuments, useDocument } from '../useDocuments'

const server = setupServer(...documentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
// Los handlers de Documentos filtran/asignan por empresa activa de sesión
// (me-f3-scoping-modulos) — todos los fixtures usados en este archivo
// (doc-001, doc-002, etc.) pertenecen a empresa-001.
beforeEach(() => {
  useAuthStore.setState({ empresaActivaId: 'empresa-001' })
})
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

// Test 5.2 — useDocuments returns list on mount
describe('useDocuments', () => {
  it('returns fixture list on mount', async () => {
    const { result } = renderHook(() => useDocuments({}), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const activeFixtures = documentFixtures.filter((d) => !d.deletedAt && d.empresaId === 'empresa-001')
    expect(result.current.data?.items.length).toBeGreaterThan(0)
    expect(result.current.data?.pagination).toBeDefined()
    expect(result.current.data?.pagination.totalItems).toBe(activeFixtures.length)
  })
})

// Test 5.3 — useDocument returns correct detail
describe('useDocument', () => {
  it('returns correct detail for doc-001', async () => {
    const { result } = renderHook(() => useDocument('doc-001'), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.id).toBe('doc-001')
    expect(result.current.data?.codigo).toBe('POL-CD-001')
  })

  it('is disabled when id is empty string', () => {
    const { result } = renderHook(() => useDocument(''), { wrapper: makeWrapper() })

    expect(result.current.status).toBe('pending')
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// Test 5.6 — MSW intercepts all endpoints without unhandled request warnings
describe('MSW endpoint coverage', () => {
  it('intercepts all six /api/documents endpoints without unhandled requests', async () => {
    const unhandled: string[] = []
    server.events.on('request:unhandled', ({ request }) => {
      unhandled.push(`${request.method} ${request.url}`)
    })

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)

    // GET list
    const { result: list } = renderHook(() => useDocuments({}), { wrapper })
    await waitFor(() => expect(list.current.isSuccess).toBe(true))

    // GET detail
    const { result: detail } = renderHook(() => useDocument('doc-002'), { wrapper })
    await waitFor(() => expect(detail.current.isSuccess).toBe(true))

    server.events.removeAllListeners()
    expect(unhandled).toHaveLength(0)
  })
})
