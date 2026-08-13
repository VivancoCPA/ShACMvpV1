import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SyncQueueBadge } from './SyncQueueBadge'
import { useOfflineQueueStore } from '../stores/offlineQueueStore'
import type { QueuedIncident } from '../../../lib/offlineQueue'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
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

beforeEach(() => {
  useOfflineQueueStore.setState({ items: [], pendingCount: 0, syncingId: null, hasErrors: false })
})

afterEach(() => cleanup())

describe('SyncQueueBadge', () => {
  it('no se muestra cuando la cola está vacía', () => {
    render(<SyncQueueBadge onRetry={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('se muestra en ámbar con el conteo cuando hay pendientes sin errores', () => {
    useOfflineQueueStore.setState({
      items: [buildItem()],
      pendingCount: 1,
      syncingId: null,
      hasErrors: false,
    })
    render(<SyncQueueBadge onRetry={vi.fn()} />)

    const button = screen.getByRole('button')
    expect(button.className).toContain('text-amber')
    expect(button).toHaveTextContent('mobile.offline.pendingBadge:{"count":1}')
  })

  it('se muestra en rojo cuando hay al menos un error', () => {
    useOfflineQueueStore.setState({
      items: [buildItem({ status: 'error', errorMessage: 'fallo' })],
      pendingCount: 1,
      syncingId: null,
      hasErrors: true,
    })
    render(<SyncQueueBadge onRetry={vi.fn()} />)

    expect(screen.getByRole('button').className).toContain('text-error')
  })

  it('abre el panel al hacer click y reintenta un reporte específico', async () => {
    useOfflineQueueStore.setState({
      items: [buildItem({ localId: 7, status: 'error', errorMessage: 'fallo de red' })],
      pendingCount: 1,
      syncingId: null,
      hasErrors: true,
    })
    const onRetry = vi.fn()
    render(<SyncQueueBadge onRetry={onRetry} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'mobile.offline.badgeAriaLabel' }))

    expect(screen.getByText('mobile.offline.panel.title')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /mobile.offline.retry/ }))

    expect(onRetry).toHaveBeenCalledWith(7)
  })
})
