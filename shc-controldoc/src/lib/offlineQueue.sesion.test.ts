import { describe, it, expect, beforeEach } from 'vitest'
import { enqueue, listPending, listVisible, clearAll, type EnqueueInput } from './offlineQueue'
import { endSession } from './sessionEnd'
import { useAuthStore } from '../stores/authStore'

// sesion-timeout-inactividad design.md D13: la cola offline sobrevive al cierre de sesión y se
// aísla por usuario.

function input(usuarioId?: string): EnqueueInput {
  return {
    payload: {
      tipo: 'INCIDENTE',
      descripcion: 'Descripción de prueba con al menos veinte caracteres',
      areaId: 'area-001',
      turno: 'DIA',
      fechaEvento: '2026-01-01T00:00:00.000Z',
      huboLesionados: false,
    },
    photoBlobs: [],
    empresaId: 'empresa-001',
    usuarioId,
  }
}

describe('offlineQueue — aislamiento por usuario', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('listPending/listVisible de un usuario no incluyen entradas de otro', async () => {
    await enqueue(input('u1'))
    const propia = await enqueue(input('u2'))

    expect((await listPending('u2')).map((e) => e.localId)).toEqual([propia])
    expect((await listVisible('u2')).map((e) => e.localId)).toEqual([propia])
  })

  it('una entrada legacy sin usuarioId la procesa quien esté logueado', async () => {
    const legacy = await enqueue(input(undefined))

    expect((await listPending('u2')).map((e) => e.localId)).toEqual([legacy])
  })

  it('la cola sobrevive al cierre de sesión por inactividad', async () => {
    const localId = await enqueue(input('u1'))
    useAuthStore.setState({ isAuthenticated: true, accessToken: 't' })

    await endSession('INACTIVIDAD', { notifyServer: false })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    const pendientes = await listPending('u1')
    expect(pendientes.map((e) => e.localId)).toEqual([localId])
    expect(pendientes[0].status).toBe('pending')
  })
})
