import { useSearchParams } from 'react-router-dom'
import { useDocuments } from './useDocuments'
import type { DocFilters, Documento } from '../../../types/documents.types'
import type { PaginationMeta } from '../../../types/api.types'

interface UseDocumentListResult {
  documentos: Documento[]
  isLoading: boolean
  isError: boolean
  pagination: PaginationMeta | undefined
  refetch: () => void
}

export function useDocumentList(): UseDocumentListResult {
  const [searchParams] = useSearchParams()

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const pendientes = searchParams.get('pendientes') === 'true'

  const filters = {
    search: searchParams.get('search') ?? '',
    estado: (!includeDeleted && !pendientes ? searchParams.get('estado') : null) ?? '',
    tipo: searchParams.get('tipo') ?? '',
    area: searchParams.get('area') ?? '',
    page,
    pageSize: 5,
    includeDeleted,
    pendientes,
  }

  const query = useDocuments(filters as unknown as DocFilters)

  return {
    documentos: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    pagination: query.data?.pagination,
    refetch: query.refetch,
  }
}
