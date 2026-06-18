import { useSearchParams } from 'react-router-dom'
import { useDocuments } from './useDocuments'
import type { DocStatus, DocType, Documento } from '../../../types/documents.types'
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

  const search = searchParams.get('search') ?? undefined
  const estado = (searchParams.get('estado') as DocStatus | null) ?? undefined
  const tipo = (searchParams.get('tipo') as DocType | null) ?? undefined
  const area = searchParams.get('area') ?? undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  const query = useDocuments({ search, estado, tipo, area, page, pageSize: 20 })

  return {
    documentos: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    pagination: query.data?.pagination,
    refetch: query.refetch,
  }
}
