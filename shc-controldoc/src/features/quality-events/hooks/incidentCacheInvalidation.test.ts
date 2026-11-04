import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import { useCreateQualityEvent } from './useCreateQualityEvent'
import { useDeleteQualityEvent } from './useDeleteQualityEvent'
import type { QualityEventCreateInput } from '../schemas/qualityEventCreate.schema'

// incidentes-qe-estado-alertas (quality-event-form): las mutaciones de QE que cambian el estado o
// el vínculo del incidente de origen invalidan INCIDENT_QUERY_KEYS.all, para que su detalle y el
// listado reflejen la sincronización hecha en el backend.

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const createQualityEventMock = vi.fn()
const deleteQualityEventMock = vi.fn()
vi.mock('../api/quality-events.api', () => ({
  createQualityEvent: (...args: unknown[]) => createQualityEventMock(...args),
  deleteQualityEvent: (...args: unknown[]) => deleteQualityEventMock(...args),
}))

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  createQualityEventMock.mockReset()
  deleteQualityEventMock.mockReset()
})

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

function invalidatedIncidents(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.some(([filters]: unknown[]) => JSON.stringify((filters as { queryKey?: unknown }).queryKey) === JSON.stringify(INCIDENT_QUERY_KEYS.all))
}

describe('invalidación de la caché de incidentes desde mutaciones de QE', () => {
  it('crear un QE O1 invalida la caché de incidentes', async () => {
    createQualityEventMock.mockResolvedValue({ id: 'qe-1', numero: 'QE-2026-001' })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useCreateQualityEvent(), { wrapper })

    result.current.mutate({ origen: 'O1_INCIDENTE_CAMPO', incidenteId: 'inc-003' } as QualityEventCreateInput)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidatedIncidents(spy)).toBe(true)
  })

  it('eliminar un QE con incidenteId invalida la caché de incidentes', async () => {
    deleteQualityEventMock.mockResolvedValue({ id: 'qe-1', incidenteId: 'inc-003' })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteQualityEvent(), { wrapper })

    result.current.mutate('qe-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidatedIncidents(spy)).toBe(true)
  })

  it('eliminar un QE sin incidente no toca la caché de incidentes', async () => {
    deleteQualityEventMock.mockResolvedValue({ id: 'qe-2' })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteQualityEvent(), { wrapper })

    result.current.mutate('qe-2')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidatedIncidents(spy)).toBe(false)
  })
})
