import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEvidenciaACBlob } from '../api/quality-events.api'

// Las evidencias de AC se sirven autenticadas (nunca como estático): se descargan como Blob y se
// muestran con un object URL — mismo patrón que useEvidenciaBlob de incidentes.
export const evidenciaACBlobQueryKey = (qeId: string, acId: string, evidenciaId: string) =>
  ['quality-events', 'ac-evidencia', qeId, acId, evidenciaId] as const

export function useEvidenciaACBlob(qeId: string, acId: string, evidenciaId: string, enabled = true) {
  const query = useQuery({
    queryKey: evidenciaACBlobQueryKey(qeId, acId, evidenciaId),
    queryFn: () => getEvidenciaACBlob(qeId, acId, evidenciaId),
    enabled,
    retry: false,
    staleTime: Infinity,
  })

  const blobUrl = useMemo(() => (query.data ? URL.createObjectURL(query.data) : null), [query.data])

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  return { blobUrl, isLoading: query.isLoading, isError: query.isError }
}

// Abre la evidencia en una pestaña nueva. La pestaña se abre de forma síncrona (antes del await)
// para que el navegador no la bloquee como popup.
export function useAbrirEvidenciaAC(qeId: string, acId: string) {
  const queryClient = useQueryClient()
  return async (evidenciaId: string) => {
    const ventana = window.open('', '_blank')
    try {
      const blob = await queryClient.fetchQuery({
        queryKey: evidenciaACBlobQueryKey(qeId, acId, evidenciaId),
        queryFn: () => getEvidenciaACBlob(qeId, acId, evidenciaId),
        staleTime: Infinity,
      })
      const url = URL.createObjectURL(blob)
      if (ventana) ventana.location.href = url
      else window.open(url, '_blank')
    } catch {
      ventana?.close()
      throw new Error('evidencia-no-disponible')
    }
  }
}
