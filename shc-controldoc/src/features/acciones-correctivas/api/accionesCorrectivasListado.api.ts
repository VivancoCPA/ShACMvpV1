import api from '../../../lib/axios'
import type {
  ACListadoFiltros,
  ACListadoResponse,
  ACOrigen,
  AccionCorrectivaListadoItem,
} from '../types/accionesCorrectivasListado.types'

// Axios serializaría el array como `estado[]=…`; el backend acepta la lista separada por comas.
function toParams(filtros: ACListadoFiltros): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {}
  for (const [clave, valor] of Object.entries(filtros) as [keyof ACListadoFiltros, ACListadoFiltros[keyof ACListadoFiltros]][]) {
    if (valor === undefined || valor === '') continue
    if (Array.isArray(valor)) {
      if (valor.length > 0) params[clave] = valor.join(',')
    } else {
      params[clave] = valor
    }
  }
  return params
}

export async function listarAccionesCorrectivas(filtros: ACListadoFiltros): Promise<ACListadoResponse> {
  const response = await api.get<ACListadoResponse>('/api/acciones-correctivas', { params: toParams(filtros) })
  return response.data
}

/** Mismos filtros que el listado, sin paginar (tope 5.000 filas; 422 EXPORT_DEMASIADAS_FILAS). */
export async function exportarAccionesCorrectivas(filtros: ACListadoFiltros): Promise<AccionCorrectivaListadoItem[]> {
  const { page: _page, pageSize: _pageSize, ...sinPaginacion } = filtros
  void _page
  void _pageSize
  const response = await api.get<AccionCorrectivaListadoItem[]>('/api/acciones-correctivas/export', {
    params: toParams(sinPaginacion),
  })
  return response.data
}

export async function obtenerOrigenAccionCorrectiva(id: string): Promise<ACOrigen> {
  const response = await api.get<ACOrigen>(`/api/acciones-correctivas/${id}/origen`)
  return response.data
}
