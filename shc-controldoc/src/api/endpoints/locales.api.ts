import api from '../../lib/axios'
import type { Local } from '../../features/incidents/types/incident.types'

export const localesApi = {
  getLocales: async (params: { activo?: boolean } = {}): Promise<Local[]> => {
    const response = await api.get<Local[]>('/api/locales', { params })
    return response.data
  },
}
