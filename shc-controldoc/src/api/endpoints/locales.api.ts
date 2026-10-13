import api from '../../lib/axios'
import type { Local } from '../../features/incidents/types/incident.types'

export const localesApi = {
  getLocales: async (params: { activo?: boolean } = {}): Promise<Local[]> => {
    const response = await api.get<Local[]>('/api/locales', { params })
    return response.data
  },
  // proteccion-documental (design.md D7) — el plano ya no se sirve como URL estática; se obtiene
  // siempre como blob autenticado vía la instancia `api` (JWT adjunto por el interceptor existente).
  getPlanoBlob: async (localId: string): Promise<Blob> => {
    const response = await api.get(`/api/locales/${localId}/plano`, { responseType: 'blob' })
    return response.data
  },
}
