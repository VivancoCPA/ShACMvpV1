// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'
import { localesHandlers } from '../../../mocks/handlers/locales.handlers'
import { useZonasByLocal } from './useZonasByLocal'

// onUnhandledRequest: 'error' hace fallar el test si la URL pedida por el hook
// no matchea ningún handler registrado — así se detecta un mismatch de ruta
// (como el que causaba `zonas.map is not a function` en producción) en vez de
// quedar enmascarado por un mock manual del hook.
const server = setupServer(...localesHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('useZonasByLocal', () => {
  it('devuelve las zonas del local vía el endpoint real GET /api/zonas?localId=', async () => {
    const { result } = renderHook(() => useZonasByLocal('loc-001'), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data!.length).toBeGreaterThan(0)
    expect(result.current.data!.every((z) => z.localId === 'loc-001')).toBe(true)
  })

  it('no dispara la query cuando localId está vacío', () => {
    const { result } = renderHook(() => useZonasByLocal(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})
