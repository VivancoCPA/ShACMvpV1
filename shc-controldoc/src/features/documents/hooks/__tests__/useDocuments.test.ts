// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import React from 'react'
import { documentHandlers } from '../../../../mocks/handlers/documents.handlers'
import { documentFixtures } from '../../../../mocks/fixtures/documents.fixtures'
import {
  useDocuments,
  useDocument,
  useCreateDocument,
  useChangeDocumentStatus,
} from '../useDocuments'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const server = setupServer(...documentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
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

    expect(result.current.data?.items.length).toBeGreaterThan(0)
    expect(result.current.data?.pagination).toBeDefined()
    expect(result.current.data?.pagination.totalItems).toBe(documentFixtures.length)
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

// Test 5.4 — useCreateDocument invalidates cache on success
describe('useCreateDocument', () => {
  it('invalidates documents.all cache after successful mutation', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)

    const { result } = renderHook(() => useCreateDocument(), { wrapper })

    await act(async () => {
      result.current.mutate({
        titulo: 'Procedimiento de Prueba para Test',
        tipo: 'PRC',
        area: 'Calidad',
        revisorId: '11111111-1111-1111-1111-111111111111',
        aprobadorId: '22222222-2222-2222-2222-222222222222',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['documents'] }),
    )
  })
})

// Test 5.5 — useChangeDocumentStatus shows error toast on 422
describe('useChangeDocumentStatus', () => {
  it('calls toast.error with statusChangeError key when transition is invalid', async () => {
    server.use(
      http.post('/api/documents/:id/status', () =>
        HttpResponse.json({ success: false, data: null, message: 'Invalid transition' }, { status: 422 }),
      ),
    )

    const { result } = renderHook(() => useChangeDocumentStatus(), { wrapper: makeWrapper() })

    await act(async () => {
      result.current.mutate({
        id: 'doc-001',
        payload: { nuevoEstado: 'PUBLICADO', firma: '1234' },
      })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('toasts.statusChangeError')
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
