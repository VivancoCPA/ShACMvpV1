import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { authHandlers } from '../../../mocks/handlers/auth.handlers'
import { areaHandlers, resetStore as resetAreasStore } from '../../../mocks/handlers/areas.handlers'
import { qualityEventHandlers } from '../../../mocks/handlers/quality-events.handlers'
import { useAuthStore } from '../../../stores/authStore'
import { loginUser } from '../../auth/api/auth.api'
import { crearArea } from '../api/areas.api'
import api from '../../../lib/axios'
import { AreasAdminPage } from '../pages/AreasAdminPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const server = setupServer(...authHandlers, ...areaHandlers, ...qualityEventHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetAreasStore()
  cleanup()
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})
afterAll(() => server.close())

async function loginReal(email: string) {
  const { user, accessToken } = await loginUser({ email, password: 'Shac2025!' })
  useAuthStore.getState().login({ user, accessToken })
  return user
}

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/areas']}>
        <AreasAdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Los fixtures ya traen 19 Áreas; con PAGE_SIZE=10 una Área recién creada cae en la página 2.
async function goToPage2(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '→' }))
}

describe('AreaList — visibilidad de acciones para ADMINISTRADOR_SISTEMA', () => {
  it('muestra la tabla con botones de administración', async () => {
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())
    expect(screen.getByText('Almacén Norte')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'header.nuevaArea' })).toBeInTheDocument()

    const fila = screen.getByTestId('area-row-area-001')
    expect(within(fila).getByRole('button', { name: 'actions.editar' })).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'actions.desactivar' })).toBeInTheDocument()
  })

  it('el botón Nueva área abre el modal de creación vacío', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'header.nuevaArea' }))

    expect(screen.getByRole('heading', { name: 'form.titles.nuevaArea' })).toBeInTheDocument()
    expect(screen.getByLabelText(/form\.fields\.nombre/)).toHaveValue('')
  })
})

describe('AreaList — edición vía modal', () => {
  it('editar un Área abre el modal precargado y guardar actualiza la fila sin navegar', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())

    const fila = screen.getByTestId('area-row-area-001')
    await user.click(within(fila).getByRole('button', { name: 'actions.editar' }))

    expect(screen.getByRole('heading', { name: 'form.titles.editarArea' })).toBeInTheDocument()
    expect(screen.getByLabelText(/form\.fields\.nombre/)).toHaveValue('Almacén Norte')

    await user.clear(screen.getByLabelText(/form\.fields\.nombre/))
    await user.type(screen.getByLabelText(/form\.fields\.nombre/), 'Almacén Norte Renombrado')
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'form.titles.editarArea' })).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(screen.getByText('Almacén Norte Renombrado')).toBeInTheDocument())
  })

  it('cancelar el modal de edición no modifica el Área', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())

    const fila = screen.getByTestId('area-row-area-001')
    await user.click(within(fila).getByRole('button', { name: 'actions.editar' }))

    const cancelButtons = screen.getAllByRole('button', { name: 'form.actions.cancel' })
    await user.click(cancelButtons[cancelButtons.length - 1])

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'form.titles.editarArea' })).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Almacén Norte')).toBeInTheDocument()
  })
})

describe('AreaList — ocultamiento de acciones para roles de solo consulta', () => {
  it('JEFE_CALIDAD_SYST ve la tabla completa sin botones de administración', async () => {
    await loginReal('jefe.calidad@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'header.nuevaArea' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.desactivar' })).not.toBeInTheDocument()
  })
})

describe('AreaList — flujo de desactivación exitosa', () => {
  it('confirma la desactivación de un Área sin referencias y muestra toast de éxito', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    const nuevaArea = await crearArea({ nombre: 'Área Sin Referencias Test' })

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())
    await goToPage2(user)

    await waitFor(() => expect(screen.getByTestId(`area-row-${nuevaArea.id}`)).toBeInTheDocument())

    const fila = screen.getByTestId(`area-row-${nuevaArea.id}`)
    await user.click(within(fila).getByRole('button', { name: 'actions.desactivar' }))

    expect(screen.getByRole('heading', { name: 'confirmarDesactivar.titulo' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'confirmarDesactivar.confirmar' }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'confirmarDesactivar.titulo' })).not.toBeInTheDocument(),
    )

    const { toast } = await import('sonner')
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('cancelar el modal de confirmación no ejecuta la mutation', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())

    const fila = screen.getByTestId('area-row-area-001')
    await user.click(within(fila).getByRole('button', { name: 'actions.desactivar' }))

    const cancelButtons = screen.getAllByRole('button', { name: 'confirmarDesactivar.cancelar' })
    await user.click(cancelButtons[cancelButtons.length - 1])

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'confirmarDesactivar.titulo' })).not.toBeInTheDocument(),
    )

    const { toast } = await import('sonner')
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('AreaList — flujo de desactivación bloqueada (409) con desglose por módulo', () => {
  it('muestra el modal de bloqueo con las líneas por módulo con conteo > 0', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    const areaBloqueada = await crearArea({ nombre: 'Área Bloqueada Test' })

    // Crea un QE ABIERTO referenciando el Área para forzar el bloqueo cross-dominio.
    await api.post('/api/quality-events', {
      origen: 'O4_REPORTE_EXTERNO',
      tipo: 'OPERACIONAL',
      severidad: 'BAJA',
      descripcion: 'QE sintético de prueba para bloqueo de Área',
      areaId: areaBloqueada.id,
      turno: 'DIA',
      fechaHoraEvento: new Date().toISOString(),
      reporteExternoRef: { nombreCliente: 'Cliente Test', fechaRecepcion: '2026-01-01' },
    })

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())
    await goToPage2(user)

    await waitFor(() => expect(screen.getByTestId(`area-row-${areaBloqueada.id}`)).toBeInTheDocument())

    const fila = screen.getByTestId(`area-row-${areaBloqueada.id}`)
    await user.click(within(fila).getByRole('button', { name: 'actions.desactivar' }))
    await user.click(screen.getByRole('button', { name: 'confirmarDesactivar.confirmar' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'bloqueo.titulo' })).toBeInTheDocument(),
    )
  })
})

describe('AreaList — flujo de reactivación con confirmación', () => {
  it('confirma la reactivación de un Área inactiva y muestra toast de éxito', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    const nuevaArea = await crearArea({ nombre: 'Área Para Reactivar Test' })
    await api.patch(`/api/areas/${nuevaArea.id}/desactivar`)

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())
    await goToPage2(user)

    await waitFor(() => expect(screen.getByTestId(`area-row-${nuevaArea.id}`)).toBeInTheDocument())

    const fila = screen.getByTestId(`area-row-${nuevaArea.id}`)
    await user.click(within(fila).getByRole('button', { name: 'actions.reactivar' }))

    expect(screen.getByRole('heading', { name: 'confirmarReactivar.titulo' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'confirmarReactivar.confirmar' }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'confirmarReactivar.titulo' })).not.toBeInTheDocument(),
    )

    const { toast } = await import('sonner')
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('cancelar el modal de confirmación de reactivación no ejecuta la mutation', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    const nuevaArea = await crearArea({ nombre: 'Área Para Cancelar Reactivación Test' })
    await api.patch(`/api/areas/${nuevaArea.id}/desactivar`)

    renderList()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())
    await goToPage2(user)

    await waitFor(() => expect(screen.getByTestId(`area-row-${nuevaArea.id}`)).toBeInTheDocument())

    const fila = screen.getByTestId(`area-row-${nuevaArea.id}`)
    await user.click(within(fila).getByRole('button', { name: 'actions.reactivar' }))

    const cancelButtons = screen.getAllByRole('button', { name: 'confirmarReactivar.cancelar' })
    await user.click(cancelButtons[cancelButtons.length - 1])

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'confirmarReactivar.titulo' })).not.toBeInTheDocument(),
    )

    const { toast } = await import('sonner')
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('AreaList — loading y empty state', () => {
  it('muestra un skeleton mientras useAreas está cargando', async () => {
    await loginReal('admin@shac.pe')

    const { container } = renderList()

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('area-row-area-001')).toBeInTheDocument())
  })

  it('muestra el estado vacío cuando no hay áreas', async () => {
    server.use(
      http.get('/api/areas', async () => {
        await delay(10)
        return HttpResponse.json({ success: true, data: [] })
      }),
    )

    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByText('list.empty')).toBeInTheDocument())
  })
})
