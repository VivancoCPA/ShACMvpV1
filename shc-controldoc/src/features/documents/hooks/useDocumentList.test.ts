import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDocumentList } from './useDocumentList'

// Regression test for M1-fix-edit-guard-y-paginacion: DocumentList used to
// default to pageSize 5 while QEList/IncidentList default to 10, so /documents
// showed fewer rows per page than the rest of the system for no functional reason.

const mockSearchParams = new URLSearchParams()
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
}))

const mockUseDocuments = vi.fn()
vi.mock('./useDocuments', () => ({
  useDocuments: (filters: unknown) => mockUseDocuments(filters),
}))

describe('useDocumentList', () => {
  beforeEach(() => {
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key))
    mockUseDocuments.mockReturnValue({
      data: { items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it('calls useDocuments with pageSize 10 by default', () => {
    renderHook(() => useDocumentList())
    expect(mockUseDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 10 }),
    )
  })

  it('maps page param from URL', () => {
    mockSearchParams.set('page', '3')
    renderHook(() => useDocumentList())
    expect(mockUseDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3 }),
    )
  })

  it('returns documentos from query data', () => {
    const items = [{ id: 'doc-001' }]
    mockUseDocuments.mockReturnValue({
      data: { items, pagination: undefined },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    const { result } = renderHook(() => useDocumentList())
    expect(result.current.documentos).toEqual(items)
  })

  it('returns isLoading true when query is pending', () => {
    mockUseDocuments.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    })
    const { result } = renderHook(() => useDocumentList())
    expect(result.current.isLoading).toBe(true)
  })
})
