import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { localesApi } from '../../../api/endpoints/locales.api'
import type { Local } from '../types/incident.types'

export function useLocales() {
  const query = useQuery({
    queryKey: ['locales', 'list', { activo: true }] as const,
    queryFn: () => localesApi.getLocales({ activo: true }),
  })

  const locales: Local[] = query.data ?? []

  return {
    locales,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

// proteccion-documental (design.md D7) — el plano ya no es una URL estática: se obtiene como
// blob autenticado y se expone como object URL. La derivación del object URL a partir del blob
// es un cálculo puro (useMemo); el único useEffect es para revocarlo al desmontar o cuando
// cambia el blob — un efecto secundario de limpieza, no una derivación de estado.
export function usePlanoBlob(localId: string | undefined) {
  const query = useQuery({
    queryKey: ['locales', 'plano', localId] as const,
    queryFn: () => localesApi.getPlanoBlob(localId!),
    enabled: !!localId,
    retry: false,
  })

  const planoUrl = useMemo(() => (query.data ? URL.createObjectURL(query.data) : null), [query.data])

  useEffect(() => {
    return () => {
      if (planoUrl) URL.revokeObjectURL(planoUrl)
    }
  }, [planoUrl])

  return { planoUrl, isLoading: query.isLoading, isError: query.isError }
}
