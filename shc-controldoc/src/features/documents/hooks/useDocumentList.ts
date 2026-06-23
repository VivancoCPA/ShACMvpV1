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
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const pendientes = searchParams.get('pendientes') === 'true'

  const query = useDocuments({
    search,
    // pendientes mode and deleted view both skip the estado filter
    estado: includeDeleted || pendientes ? undefined : estado,
    tipo,
    area,
    page,
    pageSize: 20,
    includeDeleted,
    pendientes: pendientes || undefined,
  })

  return {
    documentos: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    pagination: query.data?.pagination,
    refetch: query.refetch,
  }
}
