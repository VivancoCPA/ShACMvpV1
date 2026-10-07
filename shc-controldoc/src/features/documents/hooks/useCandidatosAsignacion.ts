import { useQuery } from '@tanstack/react-query'
import { getCandidatosAsignacion } from '../../../api/endpoints/documents.api'
import type { TipoAsignacion } from '../../../types/documents.types'
import { QUERY_KEYS } from '../constants'

// Candidatos reales (usuarios activos de la empresa activa con rol elegible, sin el autor) para
// los selects de Revisor/Aprobador. `documentoId` solo aplica en edición: el backend excluye al
// autor persistido del documento en vez de al usuario de la sesión.
export function useCandidatosAsignacion(tipo: TipoAsignacion, documentoId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.documents.candidatosAsignacion(tipo, documentoId),
    queryFn: () => getCandidatosAsignacion(tipo, documentoId),
    staleTime: 60_000,
  })
}
