import { useQuery } from '@tanstack/react-query'
import { getDocuments, getDocumentById } from '../../../api/endpoints/documents.api'
import { QUERY_KEYS } from '../constants'
import type { DocFilters } from '../../../types/documents.types'

export function useDocuments(filters: DocFilters = {}, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.documents.list(filters),
    queryFn: () => getDocuments(filters),
    enabled,
  })
}

export function useDocumentsByCode(codigo: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.documents.list({ codigo }),
    queryFn: () => getDocuments({ codigo, pageSize: 20 }),
    enabled: enabled && !!codigo,
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.documents.detail(id),
    queryFn: () => getDocumentById(id),
    enabled: id !== '',
  })
}
