import api from '../../../lib/axios'
import type { Empresa, UsuarioEmpresa } from '../types/empresa.types'
import type { EmpresaFormInput } from '../schemas/empresaForm.schema'
import type { AsignarUsuarioEmpresaInput } from '../schemas/asignarUsuarioEmpresa.schema'

export interface UsuarioEmpresaConDatos extends UsuarioEmpresa {
  usuarioNombre: string
  usuarioApellido: string
  usuarioEmail: string
  usuarioAvatarUrl?: string
}

export async function listarEmpresas(): Promise<Empresa[]> {
  const response = await api.get<Empresa[]>('/api/empresas')
  return response.data
}

export async function crearEmpresa(data: EmpresaFormInput): Promise<Empresa> {
  const response = await api.post<Empresa>('/api/empresas', data)
  return response.data
}

export async function actualizarEmpresa(
  id: string,
  data: Partial<EmpresaFormInput>,
): Promise<Empresa> {
  const response = await api.patch<Empresa>(`/api/empresas/${id}`, data)
  return response.data
}

export async function listarUsuariosDeEmpresa(empresaId: string): Promise<UsuarioEmpresaConDatos[]> {
  const response = await api.get<UsuarioEmpresaConDatos[]>(`/api/empresas/${empresaId}/usuarios`)
  return response.data
}

export async function asignarUsuarioEmpresa(
  empresaId: string,
  data: AsignarUsuarioEmpresaInput,
): Promise<UsuarioEmpresa> {
  const response = await api.post<UsuarioEmpresa>(`/api/empresas/${empresaId}/usuarios`, data)
  return response.data
}

export async function toggleUsuarioEmpresa(
  empresaId: string,
  usuarioId: string,
  estado: 'ACTIVO' | 'INACTIVO',
): Promise<UsuarioEmpresa> {
  const response = await api.patch<UsuarioEmpresa>(
    `/api/empresas/${empresaId}/usuarios/${usuarioId}`,
    { estado },
  )
  return response.data
}
