import { useQuery } from '@tanstack/react-query'
import { getFuncionalidades } from '../api/quality-events.api'

export const FUNCIONALIDADES_QUERY_KEY = ['config', 'funcionalidades'] as const

// Configuración del servidor: no cambia durante la sesión. Si falla, los consumidores tratan
// cada funcionalidad como desactivada (qe-asistente-ia D9).
export function useFuncionalidades() {
  return useQuery({
    queryKey: FUNCIONALIDADES_QUERY_KEY,
    queryFn: getFuncionalidades,
    staleTime: Infinity,
    retry: false,
  })
}
