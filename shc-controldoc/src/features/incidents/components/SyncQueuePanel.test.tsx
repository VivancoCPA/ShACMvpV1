import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SyncQueuePanel } from './SyncQueuePanel'
import type { QueuedIncident } from '../../../lib/offlineQueue'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

function buildItem(overrides: Partial<QueuedIncident> = {}): QueuedIncident {
  return {
    localId: 1,
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
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => cleanup())

describe('SyncQueuePanel', () => {
  it('muestra el estado vacío cuando no hay items', () => {
    render(<SyncQueuePanel items={[]} onRetry={vi.fn()} />)
    expect(screen.getByText('mobile.offline.panel.empty')).toBeInTheDocument()
  })

  it('lista 2-3 reportes en el orden FIFO recibido, cada uno con su propio estado', () => {
    const items = [
      buildItem({ localId: 1, status: 'pending', createdAt: '2026-01-01T08:00:00.000Z' }),
      buildItem({ localId: 2, status: 'syncing', createdAt: '2026-01-01T08:05:00.000Z' }),
      buildItem({ localId: 3, status: 'error', createdAt: '2026-01-01T08:10:00.000Z', errorMessage: 'fallo de red' }),
    ]
    render(<SyncQueuePanel items={items} onRetry={vi.fn()} />)

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('mobile.offline.panel.status.pending')
    expect(rows[1]).toHaveTextContent('mobile.offline.panel.status.syncing')
    expect(rows[2]).toHaveTextContent('mobile.offline.panel.status.error')
    expect(rows[2]).toHaveTextContent('fallo de red')
  })

  it('solo muestra el botón "Reintentar" en la entrada en error, y lo invoca con su localId', async () => {
    const items = [
      buildItem({ localId: 1, status: 'pending' }),
      buildItem({ localId: 2, status: 'error', errorMessage: 'fallo' }),
    ]
    const onRetry = vi.fn()
    render(<SyncQueuePanel items={items} onRetry={onRetry} />)

    const retryButtons = screen.getAllByRole('button', { name: /mobile.offline.retry/ })
    expect(retryButtons).toHaveLength(1)

    await userEvent.setup().click(retryButtons[0])
    expect(onRetry).toHaveBeenCalledWith(2)
  })
})
