import { http, HttpResponse, delay } from 'msw'
import { areaFixtures } from '../fixtures/areas.fixtures'
import { getQeStore } from './quality-events.handlers'
import { getNonconformitiesStore } from './nonconformities.handlers'
import { getIncidentsStore } from './incidents.handlers'
import { puedeDesactivarArea } from '../../features/areas/utils/areaBusinessRules'
import type { Area } from '../../features/areas/types/area.types'

const LATENCY = 400

let areas: Area[] = areaFixtures.map((a) => ({ ...a }))

function resetStore() {
  areas = areaFixtures.map((a) => ({ ...a }))
}

function getAreasStore(): Area[] {
  return areas
}

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function err(message: string, status: number, extra?: Record<string, unknown>) {
  return HttpResponse.json({ success: false, data: null, message, ...extra }, { status })
}

function generateId(): string {
  return `area-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function nombreDuplicado(nombre: string, excludeId?: string): boolean {
  const normalizado = nombre.trim().toLowerCase()
  return areas.some((a) => a.id !== excludeId && a.nombre.trim().toLowerCase() === normalizado)
}

export const areaHandlers = [
  http.get('/api/areas', async () => {
    await delay(LATENCY)
    return ok(areas)
  }),

  http.get('/api/areas/:id', async ({ params }) => {
    await delay(LATENCY)
    const area = areas.find((a) => a.id === params.id)
    if (!area) return err('Área no encontrada', 404)
    return ok(area)
  }),

  // POST /api/areas — RN-ARE-002 (sin límite), RN-ARE-004 (unicidad de nombre)
  http.post('/api/areas', async ({ request }) => {
    await delay(LATENCY)

    const body = (await request.json()) as { nombre: string; descripcion?: string }

    if (nombreDuplicado(body.nombre)) {
      return err('Ya existe un Área con ese nombre', 409)
    }

    const now = new Date().toISOString()
    const newArea: Area = {
      id: generateId(),
      nombre: body.nombre,
      activo: true,
      creadoEn: now,
      ...(body.descripcion !== undefined ? { descripcion: body.descripcion } : {}),
    }

    areas = [...areas, newArea]

    return ok(newArea, 201)
  }),

  // PATCH /api/areas/:id — actualizar nombre/descripcion (RN-ARE-004)
  http.patch('/api/areas/:id', async ({ params, request }) => {
    await delay(LATENCY)

    const area = areas.find((a) => a.id === params.id)
    if (!area) return err('Área no encontrada', 404)

    const body = (await request.json()) as { nombre?: string; descripcion?: string }

    if (body.nombre !== undefined && nombreDuplicado(body.nombre, area.id)) {
      return err('Ya existe un Área con ese nombre', 409)
    }

    const updated: Area = {
      ...area,
      ...(body.nombre !== undefined ? { nombre: body.nombre } : {}),
      ...(body.descripcion !== undefined ? { descripcion: body.descripcion } : {}),
    }

    areas = areas.map((a) => (a.id === params.id ? updated : a))

    return ok(updated)
  }),

  // PATCH /api/areas/:id/desactivar — RN-ARE-001, desglose cross-dominio
  http.patch('/api/areas/:id/desactivar', async ({ params }) => {
    await delay(LATENCY)

    const area = areas.find((a) => a.id === params.id)
    if (!area) return err('Área no encontrada', 404)

    const { permitido, conteo } = puedeDesactivarArea(
      area,
      getQeStore(),
      getNonconformitiesStore(),
      getIncidentsStore(),
    )
    if (!permitido) {
      return err('No se puede desactivar: hay registros activos que referencian esta Área', 409, { conteo })
    }

    const updated: Area = { ...area, activo: false }
    areas = areas.map((a) => (a.id === params.id ? updated : a))

    return ok(updated)
  }),

  // PATCH /api/areas/:id/reactivar — sin restricción de cupo
  http.patch('/api/areas/:id/reactivar', async ({ params }) => {
    await delay(LATENCY)

    const area = areas.find((a) => a.id === params.id)
    if (!area) return err('Área no encontrada', 404)

    const updated: Area = { ...area, activo: true }
    areas = areas.map((a) => (a.id === params.id ? updated : a))

    return ok(updated)
  }),
]

export { resetStore, getAreasStore }
