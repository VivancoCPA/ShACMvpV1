import { useSearchParams } from 'react-router-dom'
import { useNonconformities } from './useNonconformities'
import type { NCStatus, NCSeveridad, NCDominio } from '../types/nonconformity.types'

export function useNCList() {
  const [searchParams] = useSearchParams()

  const search = searchParams.get('search') ?? undefined
  const estadoRaw = searchParams.get('estado')
  const dominioRaw = searchParams.get('dominio')
  const severidadRaw = searchParams.get('severidad')
  const areaAfectada = searchParams.get('areaAfectada') ?? undefined
  const fechaDesde = searchParams.get('fechaDesde') ?? undefined
  const fechaHasta = searchParams.get('fechaHasta') ?? undefined
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const estado = estadoRaw as NCStatus | undefined
  const dominio = dominioRaw as NCDominio | undefined
  const severidad = severidadRaw as NCSeveridad | undefined

  const query = useNonconformities({
    search,
    estado: estado || undefined,
    dominio: dominio || undefined,
    severidad: severidad || undefined,
    areaAfectada,
    fechaDesde,
    fechaHasta,
    page,
    pageSize: 5,
  })

  const nonconformidades = query.data?.items ?? []
  const pagination = query.data?.pagination ?? null

  return {
    nonconformidades,
    isLoading: query.isLoading,
    isError: query.isError,
    pagination,
    refetch: query.refetch,
  }
}
