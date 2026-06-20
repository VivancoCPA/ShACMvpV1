import { useQuery } from '@tanstack/react-query'
import { getDocumentById } from '../../../api/endpoints/documents.api'
import { QUERY_KEYS } from '../constants'

export function useDocumentDetail(id: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.documents.detail(id),
    queryFn: () => getDocumentById(id),
    enabled: id !== '',
  })

  return {
    documento: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}
