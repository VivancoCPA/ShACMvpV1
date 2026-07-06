import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { localesHandlers, validatePlano } from './locales.handlers'
import { crearLocal, actualizarLocal } from '../../features/locations/api/locales.api'
import type { Local, Zona } from '../../features/incidents/types/incident.types'

const server = setupServer(...localesHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

interface Result<T> {
  status: number
  data: T
}

async function call<T>(promise: Promise<{ data: T; status: number }>): Promise<Result<T>> {
  try {
    const res = await promise
    return { status: res.status, data: res.data }
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      return { status: error.response.status, data: error.response.data as T }
    }
    throw error
  }
}

interface ErrorBody {
  message: string
}

function pngFile(sizeBytes: number, name = 'plano.png'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: 'image/png' })
}

async function countLocalesActivos(): Promise<number> {
  const res = await api.get<Local[]>('/api/locales', { params: { activo: true } })
  return res.data.length
}

describe('locales.handlers — validatePlano (RN-LOC-003)', () => {
  it('acepta un PNG de 1MB', () => {
    expect(validatePlano({ type: 'image/png', size: 1 * 1024 * 1024 })).toEqual({ ok: true })
  })

  it('rechaza un archivo mayor a 2MB', () => {
    const result = validatePlano({ type: 'image/png', size: 3 * 1024 * 1024 })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/2 ?MB/i)
  })

  it('rechaza un archivo que no es PNG', () => {
    const result = validatePlano({ type: 'image/jpeg', size: 1024 })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/PNG/i)
  })
})

describe('locales.handlers — Locales', () => {
  it('GET /api/locales refleja un POST inmediatamente anterior', async () => {
    const result = await call<Local>(api.post('/api/locales', { nombre: 'Depósito Temporal', direccion: 'Km 12' }))
    expect(result.status).toBe(201)

    const list = await api.get<Local[]>('/api/locales')
    expect(list.data.some((l) => l.id === result.data.id)).toBe(true)
  })

  it('RN-LOC-003: un PNG dentro del límite se acepta y asigna planoPngUrl', async () => {
    const local = await crearLocal({ nombre: 'Local con plano', direccion: 'Dir', planoUrl: pngFile(1024) })
    expect(local.planoPngUrl).toBeDefined()
  })

  it('RN-LOC-003: archivo que no es PNG se rechaza', async () => {
    const jpeg = new File([new Uint8Array(1024)], 'plano.jpg', { type: 'image/jpeg' })
    const result = await call<ErrorBody>(crearLocal({ nombre: 'Local con jpeg', direccion: 'Dir', planoUrl: jpeg }))
    expect(result.status).toBe(400)
  })

  it('RN-LOC-001: con 4 locales activos permite crear el quinto', async () => {
    let activos = await countLocalesActivos()
    while (activos < 4) {
      const result = await call<Local>(api.post('/api/locales', { nombre: `Local relleno ${activos}`, direccion: 'Dir' }))
      expect(result.status).toBe(201)
      activos += 1
    }

    const result = await call<Local>(api.post('/api/locales', { nombre: 'Local quinto activo', direccion: 'Dir' }))
    expect(result.status).toBe(201)
    expect(await countLocalesActivos()).toBe(5)
  })

  it('RN-LOC-001: con 5 locales activos bloquea la creación', async () => {
    expect(await countLocalesActivos()).toBe(5)
    const result = await call<ErrorBody>(api.post('/api/locales', { nombre: 'Local sexto (debe fallar)', direccion: 'Dir' }))
    expect(result.status).toBe(400)
    expect(await countLocalesActivos()).toBe(5)
  })

  it('RN-LOC-002: local sin incidentes bloqueantes se desactiva', async () => {
    // Libera un cupo desactivando uno de los locales de relleno (sin incidentes
    // asociados) creados en las pruebas de RN-LOC-001, para no violar RN-LOC-001
    // al crear el local nuevo que usará esta prueba.
    const activeList = await api.get<Local[]>('/api/locales', { params: { activo: true } })
    const filler = activeList.data.find((l) => !['loc-001', 'loc-002', 'loc-003'].includes(l.id))
    if (filler) await api.patch(`/api/locales/${filler.id}/desactivar`)

    const created = await call<Local>(api.post('/api/locales', { nombre: 'Local Nuevo Sin Incidentes', direccion: 'Dir' }))
    expect(created.status).toBe(201)

    const result = await call<Local>(api.patch(`/api/locales/${created.data.id}/desactivar`))
    expect(result.status).toBe(200)
    expect(result.data.activo).toBe(false)
  })

  it('RN-LOC-002: local con incidente ABIERTO/EN_INVESTIGACION no se desactiva', async () => {
    // loc-001 tiene inc-002 (EN_INVESTIGACION) e inc-004 (ABIERTO)
    const result = await call<ErrorBody>(api.patch('/api/locales/loc-001/desactivar'))
    expect(result.status).toBe(409)
    expect(result.data.message).toMatch(/\d+/)

    const detail = await api.get<Local>('/api/locales/loc-001')
    expect(detail.data.activo).toBe(true)
  })

  it('RN-LOC-001: reactivar con menos de 5 activos marca activo: true', async () => {
    // loc-003 es inactivo desde los fixtures originales; en este punto de la
    // suite hay 4 locales activos, así que reactivar loc-003 debe permitirse.
    expect(await countLocalesActivos()).toBe(4)

    const result = await call<Local>(api.patch('/api/locales/loc-003/reactivar'))
    expect(result.status).toBe(200)
    expect(result.data.activo).toBe(true)
  })

  it('RN-LOC-001: con 5 locales activos bloquea la reactivación', async () => {
    expect(await countLocalesActivos()).toBe(5)

    const inactiveList = await api.get<Local[]>('/api/locales', { params: { activo: false } })
    const target = inactiveList.data[0]
    expect(target).toBeDefined()

    const result = await call<ErrorBody>(api.patch(`/api/locales/${target.id}/reactivar`))
    expect(result.status).toBe(400)

    const detail = await api.get<Local>(`/api/locales/${target.id}`)
    expect(detail.data.activo).toBe(false)
    expect(await countLocalesActivos()).toBe(5)
  })

  it('GET /api/locales/:id incluye zonas embebidas', async () => {
    const result = await api.get<Local & { zonas: Zona[] }>('/api/locales/loc-001')
    expect(Array.isArray(result.data.zonas)).toBe(true)
    expect(result.data.zonas.length).toBeGreaterThan(0)
  })

  it('GET /api/locales/:id responde 404 si no existe', async () => {
    const result = await call<ErrorBody>(api.get('/api/locales/no-existe'))
    expect(result.status).toBe(404)
  })

  it('PATCH /api/locales/:id actualiza un campo', async () => {
    const local = await actualizarLocal('loc-002', { nombre: 'Patio de Minerales Renombrado' })
    expect(local.nombre).toBe('Patio de Minerales Renombrado')
  })

  it('PATCH /api/locales/:id responde 404 si no existe', async () => {
    const result = await call<ErrorBody>(api.patch('/api/locales/no-existe', { nombre: 'X' }))
    expect(result.status).toBe(404)
  })
})

describe('locales.handlers — Zonas', () => {
  it('RN-ZON-003: crear zona adicional sin límite', async () => {
    const before = await api.get<Zona[]>('/api/zonas', { params: { localId: 'loc-001' } })
    const countBefore = before.data.length

    for (let i = 0; i < 3; i++) {
      const result = await call<Zona>(api.post('/api/locales/loc-001/zonas', { nombre: `Zona extra ${i}` }))
      expect(result.status).toBe(201)
    }

    const after = await api.get<Zona[]>('/api/zonas', { params: { localId: 'loc-001' } })
    expect(after.data.length).toBe(countBefore + 3)
  })

  it('POST /api/locales/:id/zonas responde 404 si el local no existe', async () => {
    const result = await call<ErrorBody>(api.post('/api/locales/no-existe/zonas', { nombre: 'Zona X' }))
    expect(result.status).toBe(404)
  })

  it('RN-ZON-002: zona sin incidentes bloqueantes se desactiva', async () => {
    const created = await api.post<Zona>('/api/locales/loc-002/zonas', { nombre: 'Zona Nueva Sin Incidentes' })

    const result = await call<Zona>(api.patch(`/api/zonas/${created.data.id}/desactivar`))
    expect(result.status).toBe(200)
    expect(result.data.activo).toBe(false)
  })

  it('RN-ZON-002: zona con incidente EN_EJECUCION no se desactiva', async () => {
    // zon-002 (Zona de Almacenamiento, loc-001) tiene inc-011 EN_EJECUCION
    const result = await call<ErrorBody>(api.patch('/api/zonas/zon-002/desactivar'))
    expect(result.status).toBe(409)
    expect(result.data.message).toMatch(/\d+/)
  })

  it('PATCH /api/zonas/:id actualiza nombre', async () => {
    const result = await call<Zona>(api.patch('/api/zonas/zon-001', { nombre: 'Zona Renombrada' }))
    expect(result.status).toBe(200)
    expect(result.data.nombre).toBe('Zona Renombrada')
  })

  it('PATCH /api/zonas/:id responde 404 si no existe', async () => {
    const result = await call<ErrorBody>(api.patch('/api/zonas/no-existe', { nombre: 'X' }))
    expect(result.status).toBe(404)
  })

  it('PATCH /api/zonas/:id/reactivar marca activo: true', async () => {
    const result = await call<Zona>(api.patch('/api/zonas/zon-002/reactivar'))
    expect(result.status).toBe(200)
    expect(result.data.activo).toBe(true)
  })
})
