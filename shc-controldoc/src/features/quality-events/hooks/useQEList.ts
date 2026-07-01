import { useSearchParams } from 'react-router-dom'
import { useQualityEvents } from './useQualityEvents'
import type { QEStatus, QEType, QESeverity, QEOrigin } from '../types/qualityEvent.types'

export function useQEList() {
  const [searchParams] = useSearchParams()

  const estadoRaw = searchParams.get('estado')
  const tipoRaw = searchParams.get('tipo')
  const severidadRaw = searchParams.get('severidad')
  const origenRaw = searchParams.get('origen')
  const fechaDesde = searchParams.get('fechaDesde') ?? undefined
  const fechaHasta = searchParams.get('fechaHasta') ?? undefined
  const soloReincidencias = searchParams.get('soloReincidencias') === 'true' ? true : undefined
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const query = useQualityEvents({
    estado: (estadoRaw as QEStatus) || undefined,
    tipo: (tipoRaw as QEType) || undefined,
    severidad: (severidadRaw as QESeverity) || undefined,
    origen: (origenRaw as QEOrigin) || undefined,
    fechaDesde,
    fechaHasta,
    soloReincidencias,
    page,
    pageSize: 10,
  })

  const qualityEvents = query.data?.items ?? []
  const pagination = query.data?.pagination ?? null

  return {
    qualityEvents,
    isLoading: query.isLoading,
    isError: query.isError,
    pagination,
    refetch: query.refetch,
  }
}
