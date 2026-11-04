import { afterEach, describe, expect, it, vi } from 'vitest'
import api from '../../../lib/axios'
import { createIncident, createIncidentOfflineSync, updateIncident } from './incidents.api'
import type { CreateIncidentInput } from '../schemas/createIncident.schema'

const baseInput: CreateIncidentInput = {
  tipo: 'INCIDENTE',
  descripcion: 'Descripción de prueba con al menos veinte caracteres.',
  areaId: 'area-1',
  turno: 'DIA',
  fechaEvento: '2026-10-20T08:00:00Z',
  huboLesionados: false,
} as CreateIncidentInput

describe('incidents.api — traducción de ubicacion a ubicacionX/ubicacionY', () => {
  afterEach(() => vi.restoreAllMocks())

  it('createIncident envía ubicacionX/ubicacionY y no envía ubicacion', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await createIncident({ ...baseInput, ubicacion: { x: 45, y: 30 } })

    const body = post.mock.calls[0][1] as Record<string, unknown>
    expect(body).toMatchObject({ ubicacionX: 45, ubicacionY: 30 })
    expect(body).not.toHaveProperty('ubicacion')
  })

  it('createIncident sin ubicación no envía ninguno de los campos de ubicación', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await createIncident(baseInput)

    const body = post.mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('ubicacion')
    expect(body).not.toHaveProperty('ubicacionX')
    expect(body).not.toHaveProperty('ubicacionY')
  })

  it('createIncidentOfflineSync traduce la ubicación y conserva empresaId', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await createIncidentOfflineSync({ ...baseInput, ubicacion: { x: 5, y: 95 } }, 'emp-1')

    const body = post.mock.calls[0][1] as Record<string, unknown>
    expect(body).toMatchObject({ ubicacionX: 5, ubicacionY: 95, empresaId: 'emp-1' })
    expect(body).not.toHaveProperty('ubicacion')
  })

  it('updateIncident envía ubicacionX/ubicacionY y no envía ubicacion', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} })

    await updateIncident('inc-001', { ubicacion: { x: 10, y: 90 } })

    expect(patch.mock.calls[0][0]).toBe('/api/incidents/inc-001')
    const body = patch.mock.calls[0][1] as Record<string, unknown>
    expect(body).toEqual({ ubicacionX: 10, ubicacionY: 90 })
  })
})
