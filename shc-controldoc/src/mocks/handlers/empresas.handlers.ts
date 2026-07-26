import { http, HttpResponse, delay } from 'msw'
import { getSessionUser } from './shared/session'
import {
  getEmpresasStore,
  getUsuarioEmpresaStore,
} from '../fixtures/empresas.fixtures'
import { getUsersStore } from '../fixtures/auth.fixtures'
import { empresaFormSchema } from '../../features/empresas/schemas/empresaForm.schema'
import { asignarUsuarioEmpresaSchema } from '../../features/empresas/schemas/asignarUsuarioEmpresa.schema'
import type { Empresa, UsuarioEmpresa } from '../../features/empresas/types/empresa.types'

const LATENCY = 400

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function err(message: string, status: number) {
  return HttpResponse.json({ success: false, data: null, message }, { status })
}

function requireSuperadmin(request: Request) {
  const user = getSessionUser(request)
  if (!user) return { error: err('Sesión expirada', 401) } as const
  if (user.rol !== 'SUPERADMIN') return { error: err('Acceso exclusivo de SUPERADMIN', 403) } as const
  return { user } as const
}

/** RN-EMP-005: al desactivar una empresa, todas sus filas UsuarioEmpresa pasan a INACTIVO. */
function cascadaDesactivarEmpresa(empresaId: string) {
  getUsuarioEmpresaStore()
    .filter((ue) => ue.empresaId === empresaId)
    .forEach((ue) => {
      ue.estado = 'INACTIVO'
    })
}

export const empresasHandlers = [
  // GET /api/empresas — listado completo, solo SUPERADMIN
  http.get('/api/empresas', async ({ request }) => {
    await delay(LATENCY)
    const auth = requireSuperadmin(request)
    if ('error' in auth) return auth.error

    return ok(getEmpresasStore())
  }),

  // POST /api/empresas — alta
  http.post('/api/empresas', async ({ request }) => {
    await delay(LATENCY)
    const auth = requireSuperadmin(request)
    if ('error' in auth) return auth.error

    const body = await request.json()
    const parsed = empresaFormSchema.partial({ estado: true }).safeParse(body)
    if (!parsed.success) {
      return err('Datos de empresa inválidos', 400)
    }

    const store = getEmpresasStore()
    const rucDuplicado = store.some((e) => e.ruc === parsed.data.ruc)
    if (rucDuplicado) {
      return err('El RUC ya está registrado', 409)
    }

    const nueva: Empresa = {
      id: `empresa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      razonSocial: parsed.data.razonSocial,
      ruc: parsed.data.ruc,
      estado: parsed.data.estado ?? 'ACTIVA',
      logoUrl: parsed.data.logoBase64 ?? '',
      fechaAlta: new Date().toISOString(),
    }
    store.push(nueva)

    return ok(nueva, 201)
  }),

  // PATCH /api/empresas/:id — edición, incluida la cascada de desactivación (RN-EMP-005)
  http.patch('/api/empresas/:id', async ({ params, request }) => {
    await delay(LATENCY)
    const auth = requireSuperadmin(request)
    if ('error' in auth) return auth.error

    const store = getEmpresasStore()
    const idx = store.findIndex((e) => e.id === params.id)
    if (idx === -1) return err('Empresa no encontrada', 404)

    const body = await request.json()
    const parsed = empresaFormSchema.partial().safeParse(body)
    if (!parsed.success) {
      return err('Datos de empresa inválidos', 400)
    }

    if (parsed.data.ruc !== undefined) {
      const rucDuplicado = store.some((e) => e.id !== params.id && e.ruc === parsed.data.ruc)
      if (rucDuplicado) {
        return err('El RUC ya está registrado', 409)
      }
    }

    const current = store[idx]
    const updated: Empresa = {
      ...current,
      ...(parsed.data.razonSocial !== undefined ? { razonSocial: parsed.data.razonSocial } : {}),
      ...(parsed.data.ruc !== undefined ? { ruc: parsed.data.ruc } : {}),
      ...(parsed.data.estado !== undefined ? { estado: parsed.data.estado } : {}),
      ...(parsed.data.logoBase64 !== undefined ? { logoUrl: parsed.data.logoBase64 } : {}),
    }
    store[idx] = updated

    if (current.estado === 'ACTIVA' && updated.estado === 'INACTIVA') {
      cascadaDesactivarEmpresa(updated.id)
    }

    return ok(updated)
  }),

  // GET /api/empresas/:id/usuarios — asignaciones UsuarioEmpresa de una empresa, enriquecidas con datos de Usuario
  http.get('/api/empresas/:id/usuarios', async ({ params, request }) => {
    await delay(LATENCY)
    const auth = requireSuperadmin(request)
    if ('error' in auth) return auth.error

    const empresa = getEmpresasStore().find((e) => e.id === params.id)
    if (!empresa) return err('Empresa no encontrada', 404)

    const usuariosStore = getUsersStore()
    const asignaciones = getUsuarioEmpresaStore()
      .filter((ue) => ue.empresaId === params.id)
      .map((ue) => {
        const usuario = usuariosStore.find((u) => u.id === ue.usuarioId)
        return {
          ...ue,
          usuarioNombre: usuario?.nombre ?? '',
          usuarioApellido: usuario?.apellido ?? '',
          usuarioEmail: usuario?.email ?? '',
          usuarioAvatarUrl: usuario?.avatarUrl,
        }
      })

    return ok(asignaciones)
  }),

  // POST /api/empresas/:id/usuarios — asigna un usuario existente (crea o reactiva)
  http.post('/api/empresas/:id/usuarios', async ({ params, request }) => {
    await delay(LATENCY)
    const auth = requireSuperadmin(request)
    if ('error' in auth) return auth.error

    const empresa = getEmpresasStore().find((e) => e.id === params.id)
    if (!empresa) return err('Empresa no encontrada', 404)

    const body = await request.json()
    const parsed = asignarUsuarioEmpresaSchema.safeParse(body)
    if (!parsed.success) {
      return err('Datos de asignación inválidos', 400)
    }

    const usuario = getUsersStore().find((u) => u.id === parsed.data.usuarioId)
    if (!usuario) return err('Usuario no encontrado', 404)

    const ueStore = getUsuarioEmpresaStore()
    const existente = ueStore.find(
      (ue) => ue.usuarioId === parsed.data.usuarioId && ue.empresaId === params.id,
    )

    if (existente) {
      existente.rol = parsed.data.rol
      existente.estado = 'ACTIVO'
      return ok(existente, 200)
    }

    const nueva: UsuarioEmpresa = {
      usuarioId: parsed.data.usuarioId,
      empresaId: params.id as string,
      rol: parsed.data.rol,
      estado: 'ACTIVO',
      fechaAsignacion: new Date().toISOString(),
    }
    ueStore.push(nueva)

    return ok(nueva, 201)
  }),

  // PATCH /api/empresas/:id/usuarios/:usuarioId — activar/desactivar una asignación puntual
  http.patch('/api/empresas/:id/usuarios/:usuarioId', async ({ params, request }) => {
    await delay(LATENCY)
    const auth = requireSuperadmin(request)
    if ('error' in auth) return auth.error

    const asignacion = getUsuarioEmpresaStore().find(
      (ue) => ue.empresaId === params.id && ue.usuarioId === params.usuarioId,
    )
    if (!asignacion) return err('Asignación no encontrada', 404)

    const body = (await request.json()) as { estado?: 'ACTIVO' | 'INACTIVO' }
    if (body.estado !== 'ACTIVO' && body.estado !== 'INACTIVO') {
      return err('estado inválido', 400)
    }
    asignacion.estado = body.estado

    return ok(asignacion)
  }),
]
