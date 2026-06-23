import { useQuery } from '@tanstack/react-query'
import { getDocuments } from '../../../api/endpoints/documents.api'
import { QUERY_KEYS } from '../constants'

export function useDocumentVersiones(codigo: string) {
  return useQuery({
    queryKey: QUERY_KEYS.documents.versionesByCodigo(codigo),
    queryFn: () => getDocuments({ codigo, pageSize: 100 }),
    enabled: codigo !== '',
  })
}
