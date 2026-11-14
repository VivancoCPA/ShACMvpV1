import { useQuery } from '@tanstack/react-query'
import { getCandidatosResponsableAC } from '../../../api/endpoints/users.api'
import type { AccionCorrectivaTipo } from '../../../constants/accionCorrectivaTipo.constants'

export const candidatosResponsableACQueryKey = (tipo: AccionCorrectivaTipo) =>
  ['acciones-correctivas', 'candidatos', tipo] as const

// Responsables elegibles para una AC según su tipo (ac-tipo-responsables). Deshabilitado mientras
// el formulario no tenga tipo.
export function useCandidatosResponsableAC(tipo: AccionCorrectivaTipo | undefined) {
  return useQuery({
    queryKey: candidatosResponsableACQueryKey(tipo ?? 'CORRECTIVA'),
    queryFn: () => getCandidatosResponsableAC(tipo ?? 'CORRECTIVA'),
    enabled: !!tipo,
    staleTime: 60_000,
  })
}
