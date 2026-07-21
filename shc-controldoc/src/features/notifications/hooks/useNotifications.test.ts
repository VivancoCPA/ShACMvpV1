// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'
import { notificationHandlers, resetStore } from '../../../mocks/handlers/notifications.handlers'
import { authFixtures } from '../../../mocks/fixtures/auth.fixtures'
import { useAuthStore } from '../../../stores/authStore'
import { useNotifications } from './useNotifications'
import { useMarkNotificationRead } from './useMarkNotificationRead'
import { useMarkAllNotificationsRead } from './useMarkAllNotificationsRead'

const server = setupServer(...notificationHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetStore()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})
afterAll(() => server.close())

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

function loginAs(email: string) {
  const mockUser = authFixtures.find((u) => u.email === email)
  if (!mockUser) throw new Error(`Fixture no encontrado: ${email}`)
  const { password: _password, ...user } = mockUser
  useAuthStore.getState().login({ user, accessToken: `mock-access-token-${user.id}-${Date.now()}` })
}

describe('useNotifications', () => {
  it('exposes the fetched notifications for the logged-in user', async () => {
    loginAs('operario@shac.pe')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useNotifications(), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.every((n) => n.usuarioId === 'user-operario-001')).toBe(true)
  })
})

describe('useMarkNotificationRead', () => {
  it('invalidates and refetches the notifications query on success', async () => {
    loginAs('operario@shac.pe')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const list = renderHook(() => useNotifications(), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const unread = list.result.current.data!.find((n) => !n.leida)!

    const mutation = renderHook(() => useMarkNotificationRead(), { wrapper: makeWrapper(qc) })
    mutation.result.current.mutate(unread.id)
    await waitFor(() => expect(mutation.result.current.isSuccess).toBe(true))

    await waitFor(() => {
      const updated = list.result.current.data!.find((n) => n.id === unread.id)
      expect(updated?.leida).toBe(true)
    })
  })
})

describe('useMarkAllNotificationsRead', () => {
  it('invalidates and refetches the notifications query on success', async () => {
    loginAs('operario@shac.pe')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const list = renderHook(() => useNotifications(), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))

    const mutation = renderHook(() => useMarkAllNotificationsRead(), { wrapper: makeWrapper(qc) })
    mutation.result.current.mutate()
    await waitFor(() => expect(mutation.result.current.isSuccess).toBe(true))

    await waitFor(() => {
      expect(list.result.current.data!.every((n) => n.leida)).toBe(true)
    })
  })
})
