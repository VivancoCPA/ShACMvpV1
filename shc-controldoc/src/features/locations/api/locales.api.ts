import api from '../../../lib/axios'
import type { Local, Zona } from '../../incidents/types/incident.types'
import type { LocalFormInput } from '../schemas/localForm.schema'
import type { ZonaFormInput } from '../schemas/zonaForm.schema'

export interface LocalConZonas extends Local {
  zonas: Zona[]
}

function buildLocalFormData(data: Partial<LocalFormInput>): FormData {
  const formData = new FormData()
  if (data.nombre !== undefined) formData.append('nombre', data.nombre)
  if (data.direccion !== undefined) formData.append('direccion', data.direccion)
  if (data.planoUrl instanceof File) formData.append('planoUrl', data.planoUrl)
  return formData
}

export async function listarLocales(): Promise<Local[]> {
  const response = await api.get<Local[]>('/api/locales')
  return response.data
}

export async function listarZonas(): Promise<Zona[]> {
  const response = await api.get<Zona[]>('/api/zonas')
  return response.data
}

export async function obtenerLocal(id: string): Promise<LocalConZonas> {
  const response = await api.get<LocalConZonas>(`/api/locales/${id}`)
  return response.data
}

// El header Content-Type se elimina explícitamente (en vez de fijarlo a
// 'multipart/form-data') para que axios/el navegador calculen el boundary
// real del FormData; fijarlo a mano rompería el parseo en el handler MSW.
const MULTIPART_CONFIG = { headers: { 'Content-Type': undefined } }

export async function crearLocal(data: LocalFormInput): Promise<Local> {
  if (data.planoUrl instanceof File) {
    const response = await api.post<Local>('/api/locales', buildLocalFormData(data), MULTIPART_CONFIG)
    return response.data
  }
  const response = await api.post<Local>('/api/locales', data)
  return response.data
}

export async function actualizarLocal(id: string, data: Partial<LocalFormInput>): Promise<Local> {
  if (data.planoUrl instanceof File) {
    const response = await api.patch<Local>(`/api/locales/${id}`, buildLocalFormData(data), MULTIPART_CONFIG)
    return response.data
  }
  const response = await api.patch<Local>(`/api/locales/${id}`, data)
  return response.data
}

export async function desactivarLocal(id: string): Promise<Local> {
  const response = await api.patch<Local>(`/api/locales/${id}/desactivar`)
  return response.data
}

export async function reactivarLocal(id: string): Promise<Local> {
  const response = await api.patch<Local>(`/api/locales/${id}/reactivar`)
  return response.data
}

export async function crearZona(localId: string, data: ZonaFormInput): Promise<Zona> {
  const response = await api.post<Zona>(`/api/locales/${localId}/zonas`, data)
  return response.data
}

export async function actualizarZona(zonaId: string, data: Partial<ZonaFormInput>): Promise<Zona> {
  const response = await api.patch<Zona>(`/api/zonas/${zonaId}`, data)
  return response.data
}

export async function desactivarZona(zonaId: string): Promise<Zona> {
  const response = await api.patch<Zona>(`/api/zonas/${zonaId}/desactivar`)
  return response.data
}

export async function reactivarZona(zonaId: string): Promise<Zona> {
  const response = await api.patch<Zona>(`/api/zonas/${zonaId}/reactivar`)
  return response.data
}
