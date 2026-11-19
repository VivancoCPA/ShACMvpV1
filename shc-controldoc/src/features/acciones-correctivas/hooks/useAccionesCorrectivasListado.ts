import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listarAccionesCorrectivas, obtenerOrigenAccionCorrectiva } from '../api/accionesCorrectivasListado.api'
import type { ACListadoFiltros } from '../types/accionesCorrectivasListado.types'

// Prefijo propio ['acciones-correctivas', 'listado'] — no se invalida junto con la configuración ni
// los candidatos de responsables, que comparten la raíz ['acciones-correctivas'] (D11).
export const AC_LISTADO_QUERY_KEYS = {
  all: ['acciones-correctivas', 'listado'] as const,
  list: (filtros: ACListadoFiltros) => ['acciones-correctivas', 'listado', filtros] as const,
  origen: (id: string) => ['acciones-correctivas', 'origen', id] as const,
}

export function useAccionesCorrectivasListado(filtros: ACListadoFiltros) {
  return useQuery({
    queryKey: AC_LISTADO_QUERY_KEYS.list(filtros),
    queryFn: () => listarAccionesCorrectivas(filtros),
    placeholderData: keepPreviousData,
  })
}

export function useOrigenAccionCorrectiva(id: string | undefined) {
  return useQuery({
    queryKey: AC_LISTADO_QUERY_KEYS.origen(id ?? ''),
    queryFn: () => obtenerOrigenAccionCorrectiva(id ?? ''),
    enabled: !!id,
    retry: false,
  })
}
