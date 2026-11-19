import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { useCreateNonconformity, useUpdateNonconformity } from './useNonconformities'
import type { CreateNCInput } from '../schemas/createNC.schema'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

let nextError: unknown
vi.mock('../api/nonconformities.api', () => ({
  createNonconformity: () => Promise.reject(nextError),
  updateNonconformity: () => Promise.reject(nextError),
}))

afterEach(() => vi.clearAllMocks())

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const response: AxiosResponse = {
    status,
    statusText: '',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, response)
}

const input = { turno: 'XYZ' } as unknown as CreateNCInput

describe('useCreateNonconformity / useUpdateNonconformity — mensaje del servidor ante 400', () => {
  it('crear: muestra el message del servidor ante un 400', async () => {
    nextError = axiosErrorWith(400, { success: false, message: "Valor inválido en el campo 'turno'." })
    const { result } = renderHook(() => useCreateNonconformity(), { wrapper })

    act(() => result.current.mutate(input))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Valor inválido en el campo 'turno'."))
  })

  it('crear: muestra el mensaje genérico ante un 500', async () => {
    nextError = axiosErrorWith(500, { success: false, message: 'Error interno del servidor.' })
    const { result } = renderHook(() => useCreateNonconformity(), { wrapper })

    act(() => result.current.mutate(input))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('toasts.createError'))
  })

  it('editar: muestra el message del servidor ante un 400', async () => {
    nextError = axiosErrorWith(400, { success: false, message: "Valor inválido en el campo 'turno'." })
    const { result } = renderHook(() => useUpdateNonconformity(), { wrapper })

    act(() => result.current.mutate({ id: 'nc-001', data: { turno: 'XYZ' } as never }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Valor inválido en el campo 'turno'."))
  })
})
