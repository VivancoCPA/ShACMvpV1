import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { areaHandlers } from './areas.handlers'
import { qualityEventHandlers } from './quality-events.handlers'
import type { Area, AreaConteoBloqueo } from '../../features/areas/types/area.types'

const server = setupServer(...areaHandlers, ...qualityEventHandlers)

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
  conteo?: AreaConteoBloqueo
}

describe('areas.handlers — CRUD', () => {
  it('GET /api/areas refleja un POST inmediatamente anterior', async () => {
    const created = await call<Area>(api.post('/api/areas', { nombre: 'Patio de Concentrado' }))
    expect(created.status).toBe(201)

    const list = await api.get<Area[]>('/api/areas')
    expect(list.data.some((a) => a.id === created.data.id)).toBe(true)
  })

  it('RN-ARE-002: crear un Área nueva con 19+ áreas activas ya existentes no tiene límite', async () => {
    const result = await call<Area>(api.post('/api/areas', { nombre: 'Área Sintética de Prueba' }))
    expect(result.status).toBe(201)
    expect(result.data.activo).toBe(true)
  })

  it('RN-ARE-004: crear con nombre duplicado (distinta capitalización) es rechazado', async () => {
    await api.post('/api/areas', { nombre: 'Zona Duplicada Test' })
    const result = await call<ErrorBody>(api.post('/api/areas', { nombre: 'ZONA DUPLICADA TEST' }))
    expect(result.status).toBe(409)
  })

  it('RN-ARE-004: editar sin cambiar el propio nombre no es rechazado', async () => {
    const created = await api.post<Area>('/api/areas', { nombre: 'Área Editable' })
    const result = await call<Area>(
      api.patch(`/api/areas/${created.data.id}`, { nombre: 'Área Editable', descripcion: 'Actualizada' }),
    )
    expect(result.status).toBe(200)
  })

  it('PATCH /api/areas/:id responde 404 si no existe', async () => {
    const result = await call<ErrorBody>(api.patch('/api/areas/no-existe', { nombre: 'X' }))
    expect(result.status).toBe(404)
  })

  it('PATCH /api/areas/:id/reactivar marca activo: true sin restricción de cupo', async () => {
    const created = await api.post<Area>('/api/areas', { nombre: 'Área Para Reactivar' })
    await api.patch(`/api/areas/${created.data.id}/desactivar`)

    const result = await call<Area>(api.patch(`/api/areas/${created.data.id}/reactivar`))
    expect(result.status).toBe(200)
    expect(result.data.activo).toBe(true)
  })
})

describe('areas.handlers — RN-ARE-001 (bloqueo cross-dominio)', () => {
  it('Área sin referencias bloqueantes se desactiva', async () => {
    const area = await api.post<Area>('/api/areas', { nombre: 'Área Sin Referencias' })
    const result = await call<Area>(api.patch(`/api/areas/${area.data.id}/desactivar`))
    expect(result.status).toBe(200)
    expect(result.data.activo).toBe(false)
  })

  it('el bloqueo refleja un QE creado en la misma sesión, no solo el fixture inicial', async () => {
    const area = await api.post<Area>('/api/areas', { nombre: 'Área Con QE Reciente' })

    await api.post('/api/quality-events', {
      origen: 'O4_REPORTE_EXTERNO',
      tipo: 'OPERACIONAL',
      severidad: 'BAJA',
      descripcion: 'QE sintético de prueba para bloqueo cross-dominio',
      areaId: area.data.id,
      turno: 'DIA',
      fechaHoraEvento: new Date().toISOString(),
      reporteExternoRef: { nombreCliente: 'Cliente Test', fechaRecepcion: '2026-01-01' },
    })

    const result = await call<ErrorBody>(api.patch(`/api/areas/${area.data.id}/desactivar`))
    expect(result.status).toBe(409)
    expect(result.data.conteo?.qe).toBe(1)
    expect(result.data.conteo?.total).toBe(1)

    const detail = await api.get<Area>(`/api/areas/${area.data.id}`)
    expect(detail.data.activo).toBe(true)
  })
})
