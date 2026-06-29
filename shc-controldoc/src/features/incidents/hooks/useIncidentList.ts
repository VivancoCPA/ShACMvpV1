import { useSearchParams } from 'react-router-dom'
import { useIncidents } from './useIncidents'
import type { IncidentType, IncidentStatus, IncidentSeveridad } from '../types/incident.types'

export function useIncidentList() {
  const [searchParams] = useSearchParams()

  const tipo = (searchParams.get('tipo') || undefined) as IncidentType | undefined
  const estado = (searchParams.get('estado') || undefined) as IncidentStatus | undefined
  const severidad = (searchParams.get('severidad') || undefined) as IncidentSeveridad | undefined
  const areaId = searchParams.get('areaId') || undefined
  const fechaDesde = searchParams.get('fechaDesde') || undefined
  const fechaHasta = searchParams.get('fechaHasta') || undefined
  const search = searchParams.get('search') || undefined
  const showDeleted = searchParams.get('showDeleted') === 'true' ? true : undefined
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const query = useIncidents({
    tipo,
    estado,
    severidad,
    areaId,
    fechaDesde,
    fechaHasta,
    search,
    showDeleted,
    page,
    pageSize: 10,
  })

  const incidentes = query.data?.items ?? []
  const pagination = query.data?.pagination ?? null

  return {
    incidentes,
    isLoading: query.isLoading,
    isError: query.isError,
    pagination,
    refetch: query.refetch,
  }
}
