import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNCList } from './useNCList'

// Mock useSearchParams and useNonconformities
const mockSearchParams = new URLSearchParams()
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
}))

const mockUseNonconformities = vi.fn()
vi.mock('./useNonconformities', () => ({
  useNonconformities: (filters: unknown) => mockUseNonconformities(filters),
}))

describe('useNCList', () => {
  beforeEach(() => {
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key))
    mockUseNonconformities.mockReturnValue({
      data: { items: [], pagination: { page: 1, pageSize: 5, totalItems: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it('calls useNonconformities with pageSize 5 by default', () => {
    renderHook(() => useNCList())
    expect(mockUseNonconformities).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 5 }),
    )
  })

  it('maps page param from URL', () => {
    mockSearchParams.set('page', '3')
    renderHook(() => useNCList())
    expect(mockUseNonconformities).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3 }),
    )
  })

  it('maps dominio param from URL', () => {
    mockSearchParams.set('dominio', 'SST')
    renderHook(() => useNCList())
    expect(mockUseNonconformities).toHaveBeenCalledWith(
      expect.objectContaining({ dominio: 'SST' }),
    )
  })

  it('maps severidad param from URL', () => {
    mockSearchParams.set('severidad', 'CRITICA')
    renderHook(() => useNCList())
    expect(mockUseNonconformities).toHaveBeenCalledWith(
      expect.objectContaining({ severidad: 'CRITICA' }),
    )
  })

  it('maps estado param from URL', () => {
    mockSearchParams.set('estado', 'EN_INVESTIGACION')
    renderHook(() => useNCList())
    expect(mockUseNonconformities).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'EN_INVESTIGACION' }),
    )
  })

  it('maps search param from URL', () => {
    mockSearchParams.set('search', 'NC-CAL')
    renderHook(() => useNCList())
    expect(mockUseNonconformities).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'NC-CAL' }),
    )
  })

  it('returns nonconformidades from query data', () => {
    const items = [{ id: 'nc-001' }]
    mockUseNonconformities.mockReturnValue({
      data: { items, pagination: null },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    const { result } = renderHook(() => useNCList())
    expect(result.current.nonconformidades).toEqual(items)
  })

  it('returns isLoading true when query is pending', () => {
    mockUseNonconformities.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    })
    const { result } = renderHook(() => useNCList())
    expect(result.current.isLoading).toBe(true)
  })

  it('returns isError true when query fails', () => {
    mockUseNonconformities.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    })
    const { result } = renderHook(() => useNCList())
    expect(result.current.isError).toBe(true)
  })

  it('defaults page to 1 when param absent', () => {
    renderHook(() => useNCList())
    expect(mockUseNonconformities).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    )
  })
})
