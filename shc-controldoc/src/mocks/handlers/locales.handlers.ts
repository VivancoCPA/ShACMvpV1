import { http, HttpResponse, delay } from 'msw'
import { localFixtures, zonaFixtures } from '../fixtures/locales.fixtures'
import { getIncidentsStore } from './incidents.handlers'
import {
  puedeCrearLocalActivo,
  puedeDesactivarLocal,
  puedeDesactivarZona,
} from '../../features/locations/utils/localesBusinessRules'
import type { Local, Zona } from '../../features/incidents/types/incident.types'

const LATENCY = 400
const MAX_PLANO_BYTES = 2 * 1024 * 1024

let locales: Local[] = localFixtures.map((l) => ({ ...l }))
let zonas: Zona[] = zonaFixtures.map((z) => ({ ...z }))

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function err(message: string, status: number, errors?: string[]) {
  return HttpResponse.json({ success: false, data: null, message, errors }, { status })
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function generateCodigoLocal(): string {
  return `LOC-${String(locales.length + 1).padStart(3, '0')}`
}

function generateCodigoZona(): string {
  return `ZON-${String(zonas.length + 1).padStart(3, '0')}`
}

interface PlanoValidationResult {
  ok: boolean
  message?: string
  file?: File
}

// RN-LOC-003: tipo image/png y tamaño <=2MB. Extraída como función pura para
// poder probarla sin depender del transporte real de un File por HTTP.
export function validatePlano(file: { type: string; size: number }): { ok: boolean; message?: string } {
  if (file.type !== 'image/png') {
    return { ok: false, message: 'El plano debe estar en formato PNG' }
  }
  if (file.size > MAX_PLANO_BYTES) {
    return { ok: false, message: 'El plano no debe superar 2 MB' }
  }
  return { ok: true }
}

async function validatePlanoFromRequest(request: Request): Promise<PlanoValidationResult> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return { ok: true }
  }

  const formData = await request.formData()
  const file = formData.get('planoUrl')
  // No usamos `instanceof File`: el File parseado por el runtime de fetch del
  // handler puede venir de un realm distinto al `File` global del entorno de test.
  if (file === null || typeof file === 'string') {
    return { ok: true }
  }

  const validation = validatePlano(file)
  if (!validation.ok) {
    return validation
  }

  return { ok: true, file }
}

async function parseLocalBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const body: Record<string, unknown> = {}
    formData.forEach((value, key) => {
      if (key !== 'planoUrl') body[key] = value
    })
    return body
  }
  return (await request.json()) as Record<string, unknown>
}

export const localesHandlers = [
  http.get('/api/locales', async ({ request }) => {
    await delay(LATENCY)
    const url = new URL(request.url)
    const activo = url.searchParams.get('activo')

    const result = activo !== null
      ? locales.filter((l) => l.activo === (activo === 'true'))
      : locales

    return ok(result)
  }),

  http.get('/api/zonas', async ({ request }) => {
    await delay(LATENCY)
    const url = new URL(request.url)
    const localId = url.searchParams.get('localId')

    const result = localId !== null
      ? zonas.filter((z) => z.localId === localId)
      : zonas

    return ok(result)
  }),

  // GET /api/locales/:id — detalle con zonas embebidas
  http.get('/api/locales/:id', async ({ params }) => {
    await delay(LATENCY)

    const local = locales.find((l) => l.id === params.id)
    if (!local) return err('Local no encontrado', 404)

    const zonasDelLocal = zonas.filter((z) => z.localId === local.id)
    return ok({ ...local, zonas: zonasDelLocal })
  }),

  // POST /api/locales — crear (RN-LOC-001, RN-LOC-003)
  http.post('/api/locales', async ({ request }) => {
    await delay(LATENCY)

    if (!puedeCrearLocalActivo(locales)) {
      return err('No se puede crear el local: ya existen 5 locales activos', 400)
    }

    const planoResult = await validatePlanoFromRequest(request.clone())
    if (!planoResult.ok) {
      return err(planoResult.message ?? 'Archivo de plano inválido', 400)
    }

    const body = await parseLocalBody(request)
    const now = new Date().toISOString()
    const id = generateId('loc')

    const newLocal: Local = {
      id,
      nombre: body.nombre as string,
      codigo: generateCodigoLocal(),
      activo: true,
      creadoEn: now,
      actualizadoEn: now,
      ...(body.direccion ? { direccion: body.direccion as string } : {}),
      ...(planoResult.file ? { planoPngUrl: '/mock/plano-placeholder.png' } : {}),
    }

    locales = [...locales, newLocal]

    return ok(newLocal, 201)
  }),

  // PATCH /api/locales/:id — actualizar campos editables (incluida RN-LOC-003 si hay archivo)
  http.patch('/api/locales/:id', async ({ params, request }) => {
    await delay(LATENCY)

    const local = locales.find((l) => l.id === params.id)
    if (!local) return err('Local no encontrado', 404)

    const planoResult = await validatePlanoFromRequest(request.clone())
    if (!planoResult.ok) {
      return err(planoResult.message ?? 'Archivo de plano inválido', 400)
    }

    const body = await parseLocalBody(request)
    const now = new Date().toISOString()

    const updated: Local = {
      ...local,
      ...(body.nombre !== undefined ? { nombre: body.nombre as string } : {}),
      ...(body.direccion !== undefined ? { direccion: body.direccion as string } : {}),
      ...(planoResult.file ? { planoPngUrl: '/mock/plano-placeholder.png' } : {}),
      actualizadoEn: now,
    }

    locales = locales.map((l) => (l.id === params.id ? updated : l))

    return ok(updated)
  }),

  // PATCH /api/locales/:id/desactivar — RN-LOC-002
  http.patch('/api/locales/:id/desactivar', async ({ params }) => {
    await delay(LATENCY)

    const local = locales.find((l) => l.id === params.id)
    if (!local) return err('Local no encontrado', 404)

    const { permitido, incidentesBloqueantes } = puedeDesactivarLocal(local, getIncidentsStore())
    if (!permitido) {
      return err(
        `No se puede desactivar: ${incidentesBloqueantes} incidentes activos/en investigación asociados`,
        409,
      )
    }

    const now = new Date().toISOString()
    const updated: Local = { ...local, activo: false, actualizadoEn: now }
    locales = locales.map((l) => (l.id === params.id ? updated : l))

    return ok(updated)
  }),

  // PATCH /api/locales/:id/reactivar — RN-LOC-001 (máximo 5 activos, aplica también a reactivación)
  http.patch('/api/locales/:id/reactivar', async ({ params }) => {
    await delay(LATENCY)

    const local = locales.find((l) => l.id === params.id)
    if (!local) return err('Local no encontrado', 404)

    if (!puedeCrearLocalActivo(locales)) {
      return err('No se puede reactivar el local: ya existen 5 locales activos', 400)
    }

    const now = new Date().toISOString()
    const updated: Local = { ...local, activo: true, actualizadoEn: now }
    locales = locales.map((l) => (l.id === params.id ? updated : l))

    return ok(updated)
  }),

  // POST /api/locales/:id/zonas — RN-ZON-003 (sin límite)
  http.post('/api/locales/:id/zonas', async ({ params, request }) => {
    await delay(LATENCY)

    const local = locales.find((l) => l.id === params.id)
    if (!local) return err('Local no encontrado', 404)

    const body = await request.json() as Record<string, unknown>
    const now = new Date().toISOString()

    const newZona: Zona = {
      id: generateId('zon'),
      localId: local.id,
      nombre: body.nombre as string,
      codigo: generateCodigoZona(),
      activo: true,
      creadoEn: now,
      actualizadoEn: now,
      ...(body.descripcion ? { descripcion: body.descripcion as string } : {}),
    }

    zonas = [...zonas, newZona]

    return ok(newZona, 201)
  }),

  // PATCH /api/zonas/:id — actualizar campos editables
  http.patch('/api/zonas/:id', async ({ params, request }) => {
    await delay(LATENCY)

    const zona = zonas.find((z) => z.id === params.id)
    if (!zona) return err('Zona no encontrada', 404)

    const body = await request.json() as Record<string, unknown>
    const now = new Date().toISOString()

    const updated: Zona = {
      ...zona,
      ...(body.nombre !== undefined ? { nombre: body.nombre as string } : {}),
      ...(body.descripcion !== undefined ? { descripcion: body.descripcion as string } : {}),
      actualizadoEn: now,
    }

    zonas = zonas.map((z) => (z.id === params.id ? updated : z))

    return ok(updated)
  }),

  // PATCH /api/zonas/:id/desactivar — RN-ZON-002
  http.patch('/api/zonas/:id/desactivar', async ({ params }) => {
    await delay(LATENCY)

    const zona = zonas.find((z) => z.id === params.id)
    if (!zona) return err('Zona no encontrada', 404)

    const { permitido, incidentesBloqueantes } = puedeDesactivarZona(zona, getIncidentsStore())
    if (!permitido) {
      return err(
        `No se puede desactivar: ${incidentesBloqueantes} incidentes activos/en investigación/en ejecución asociados`,
        409,
      )
    }

    const now = new Date().toISOString()
    const updated: Zona = { ...zona, activo: false, actualizadoEn: now }
    zonas = zonas.map((z) => (z.id === params.id ? updated : z))

    return ok(updated)
  }),

  // PATCH /api/zonas/:id/reactivar
  http.patch('/api/zonas/:id/reactivar', async ({ params }) => {
    await delay(LATENCY)

    const zona = zonas.find((z) => z.id === params.id)
    if (!zona) return err('Zona no encontrada', 404)

    const now = new Date().toISOString()
    const updated: Zona = { ...zona, activo: true, actualizadoEn: now }
    zonas = zonas.map((z) => (z.id === params.id ? updated : z))

    return ok(updated)
  }),
]
