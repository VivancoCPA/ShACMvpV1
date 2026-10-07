import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { useConfirmarRevisionPeriodica } from './useDocumentActions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const apiPatchMock = vi.fn()
vi.mock('../../../lib/axios', () => ({
  default: {
    patch: (...args: unknown[]) => apiPatchMock(...args),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// revision-periodica-fecha-editable: el toast debe usar formatCalendarDateMedium (UTC), no un
// formateador de timestamp en la zona local — en UTC-5 (Lima) ese bug mostraba el día anterior.
describe('useConfirmarRevisionPeriodica — toast sin desfase de zona horaria', () => {
  it('muestra la fecha correcta (día 1, no el 28 anterior) para una medianoche UTC', async () => {
    apiPatchMock.mockResolvedValueOnce({ data: { id: 'doc-1', fechaRevisionProxima: '2026-03-01T00:00:00.000Z' } })

    const { result } = renderHook(() => useConfirmarRevisionPeriodica('doc-1'), { wrapper })

    act(() => {
      result.current.mutate({ fechaRevisionProxima: '2026-03-01' })
    })

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    const [message] = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(message).toContain('1 mar')
    expect(message).not.toContain('28 feb')
  })

  it('envía el payload con fechaRevisionProxima al endpoint', async () => {
    apiPatchMock.mockResolvedValueOnce({ data: { id: 'doc-1', fechaRevisionProxima: '2026-06-01T00:00:00.000Z' } })
    const { result } = renderHook(() => useConfirmarRevisionPeriodica('doc-1'), { wrapper })

    act(() => {
      result.current.mutate({ fechaRevisionProxima: '2026-06-01' })
    })

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalled())
    expect(apiPatchMock).toHaveBeenCalledWith(
      '/api/documents/doc-1/confirmar-revision',
      { fechaRevisionProxima: '2026-06-01' },
    )
  })
})
