import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { authHandlers } from '../../../mocks/handlers/auth.handlers'
import { localesHandlers } from '../../../mocks/handlers/locales.handlers'
import { incidentHandlers } from '../../../mocks/handlers/incidents.handlers'
import { useAuthStore } from '../../../stores/authStore'
import { loginUser } from '../../auth/api/auth.api'
import {
  listarLocales,
  crearLocal,
  desactivarLocal,
  crearZona,
  desactivarZona,
} from '../api/locales.api'
import { LocalList } from './LocalList'

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

const server = setupServer(...authHandlers, ...localesHandlers, ...incidentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
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
      <MemoryRouter initialEntries={['/admin/locales']}>
        <Routes>
          <Route path="/admin/locales" element={<LocalList />} />
          <Route path="/admin/locales/new" element={<div data-testid="nuevo-local-page" />} />
          <Route
            path="/admin/locales/:localId/zonas/new"
            element={<div data-testid="nueva-zona-page" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LocalList — renderizado con datos mockeados', () => {
  it('muestra los locales y sus contadores tras cargar', async () => {
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())
    expect(screen.getByText('Almacén Principal')).toBeInTheDocument()
    expect(screen.getByText('Patio de Minerales')).toBeInTheDocument()
    expect(screen.getByText('Bodega Norte')).toBeInTheDocument()
  })
})

describe('LocalList — expandir/colapsar filas', () => {
  it('expandir un Local muestra sus Zonas, colapsar las oculta', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())
    expect(screen.queryByTestId('zona-row-zon-001')).not.toBeInTheDocument()

    const filaLoc001 = screen.getByTestId('local-row-loc-001')
    await user.click(within(filaLoc001).getByRole('button', { name: 'actions.expandir' }))

    await waitFor(() => expect(screen.getByTestId('zona-row-zon-001')).toBeInTheDocument())

    await user.click(within(filaLoc001).getByRole('button', { name: 'actions.colapsar' }))

    await waitFor(() => expect(screen.queryByTestId('zona-row-zon-001')).not.toBeInTheDocument())
  })

  it('el botón Nuevo local navega a /admin/locales/new', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'header.nuevoLocal' }))

    expect(screen.getByTestId('nuevo-local-page')).toBeInTheDocument()
  })

  it('el enlace Nueva zona navega a /admin/locales/:localId/zonas/new', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())
    const filaLoc001 = screen.getByTestId('local-row-loc-001')
    await user.click(within(filaLoc001).getByRole('button', { name: 'actions.expandir' }))

    await waitFor(() => expect(screen.getByText('list.nuevaZona')).toBeInTheDocument())
    await user.click(screen.getByText('list.nuevaZona'))

    expect(screen.getByTestId('nueva-zona-page')).toBeInTheDocument()
  })
})

describe('LocalList — visibilidad de acciones para ADMINISTRADOR_SISTEMA', () => {
  it('muestra los botones de administración (crear/editar/desactivar/reactivar)', async () => {
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'header.nuevoLocal' })).toBeInTheDocument()

    // loc-001 está activo (fixtures): expone editar/desactivar, no reactivar
    const filaActiva = screen.getByTestId('local-row-loc-001')
    expect(within(filaActiva).getByRole('button', { name: 'actions.editar' })).toBeInTheDocument()
    expect(within(filaActiva).getByRole('button', { name: 'actions.desactivar' })).toBeInTheDocument()
    expect(
      within(filaActiva).queryByRole('button', { name: 'actions.reactivar' }),
    ).not.toBeInTheDocument()

    // loc-003 (Bodega Norte) está inactivo (fixtures): expone editar/reactivar, no desactivar
    const filaInactiva = screen.getByTestId('local-row-loc-003')
    expect(within(filaInactiva).getByRole('button', { name: 'actions.editar' })).toBeInTheDocument()
    expect(
      within(filaInactiva).getByRole('button', { name: 'actions.reactivar' }),
    ).toBeInTheDocument()
    expect(
      within(filaInactiva).queryByRole('button', { name: 'actions.desactivar' }),
    ).not.toBeInTheDocument()
  })
})

describe('LocalList — ocultamiento de acciones para JEFE_CALIDAD_SYST', () => {
  it('muestra el listado completo sin botones de administración', async () => {
    await loginReal('jefe.calidad@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())
    expect(screen.getByText('Patio de Minerales')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'header.nuevoLocal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.desactivar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.reactivar' })).not.toBeInTheDocument()
  })
})

describe('LocalList — flujo de desactivación exitosa (200)', () => {
  it('confirma la desactivación de un Local sin incidentes y muestra toast de éxito', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    const nuevoLocal = await crearLocal({ nombre: 'Local Sin Incidentes', direccion: 'Av. Prueba 1' })

    renderList()

    await waitFor(() => expect(screen.getByTestId(`local-row-${nuevoLocal.id}`)).toBeInTheDocument())

    const fila = screen.getByTestId(`local-row-${nuevoLocal.id}`)
    await user.click(within(fila).getByRole('button', { name: 'actions.desactivar' }))

    expect(
      screen.getByRole('heading', { name: 'confirmarDesactivar.tituloLocal' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'confirmarDesactivar.confirmar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'confirmarDesactivar.tituloLocal' }),
      ).not.toBeInTheDocument(),
    )

    const { toast } = await import('sonner')
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('cancelar el modal de confirmación no ejecuta la mutation', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())

    const filaLocal = screen.getByTestId('local-row-loc-001')
    await user.click(within(filaLocal).getByRole('button', { name: 'actions.desactivar' }))

    expect(
      screen.getByRole('heading', { name: 'confirmarDesactivar.tituloLocal' }),
    ).toBeInTheDocument()

    // El botón "Cancelar" del pie del modal comparte accesible-name con el ícono
    // "X" de cierre (ambos usan la misma clave i18n); el del pie es el segundo en el DOM.
    const cancelButtons = screen.getAllByRole('button', { name: 'confirmarDesactivar.cancelar' })
    await user.click(cancelButtons[cancelButtons.length - 1])

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'confirmarDesactivar.tituloLocal' }),
      ).not.toBeInTheDocument(),
    )

    const { toast } = await import('sonner')
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('LocalList — flujo de desactivación bloqueada por incidentes (409)', () => {
  it('desactivar un Local bloqueado muestra el modal de bloqueo con el mensaje del backend', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    // loc-001 (Almacén Principal) tiene incidentes ABIERTO/EN_INVESTIGACION asociados (fixtures)
    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())

    const filaLocal = screen.getByTestId('local-row-loc-001')
    await user.click(within(filaLocal).getByRole('button', { name: 'actions.desactivar' }))
    await user.click(screen.getByRole('button', { name: 'confirmarDesactivar.confirmar' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'bloqueoIncidentes.titulo' })).toBeInTheDocument(),
    )
    expect(screen.getByText(/No se puede desactivar/i)).toBeInTheDocument()
  })

  it('desactivar una Zona bloqueada muestra el modal de bloqueo con el conteo simple', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())
    const filaLoc001 = screen.getByTestId('local-row-loc-001')
    await user.click(within(filaLoc001).getByRole('button', { name: 'actions.expandir' }))

    // zon-002 (Zona de Almacenamiento) tiene incidentes EN_INVESTIGACION/EN_EJECUCION (fixtures)
    await waitFor(() => expect(screen.getByTestId('zona-row-zon-002')).toBeInTheDocument())

    const filaZona = screen.getByTestId('zona-row-zon-002')
    await user.click(within(filaZona).getByRole('button', { name: 'actions.desactivar' }))
    await user.click(screen.getByRole('button', { name: 'confirmarDesactivar.confirmar' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'bloqueoIncidentes.titulo' })).toBeInTheDocument(),
    )
  })
})

describe('LocalList — flujo de reactivación', () => {
  it('reactivar un Local inactivo muestra el modal de confirmación', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    // loc-003 (Bodega Norte) está inactivo en las fixtures
    await waitFor(() => expect(screen.getByTestId('local-row-loc-003')).toBeInTheDocument())

    const filaLocal = screen.getByTestId('local-row-loc-003')
    await user.click(within(filaLocal).getByRole('button', { name: 'actions.reactivar' }))

    expect(
      screen.getByRole('heading', { name: 'confirmarReactivar.tituloLocal' }),
    ).toBeInTheDocument()
  })

  it('cancelar el modal de reactivar de un Local no ejecuta la mutation', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-003')).toBeInTheDocument())

    const filaLocal = screen.getByTestId('local-row-loc-003')
    await user.click(within(filaLocal).getByRole('button', { name: 'actions.reactivar' }))

    // El botón "Cancelar" del pie del modal comparte accesible-name con el ícono
    // "X" de cierre; el del pie es el segundo en el DOM.
    const cancelButtons = screen.getAllByRole('button', { name: 'confirmarReactivar.cancelar' })
    await user.click(cancelButtons[cancelButtons.length - 1])

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'confirmarReactivar.tituloLocal' }),
      ).not.toBeInTheDocument(),
    )

    const { toast } = await import('sonner')
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('confirmar el modal de reactivar de un Local ejecuta la mutation y muestra toast de éxito', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-003')).toBeInTheDocument())

    const filaLocal = screen.getByTestId('local-row-loc-003')
    await user.click(within(filaLocal).getByRole('button', { name: 'actions.reactivar' }))
    await user.click(screen.getByRole('button', { name: 'confirmarReactivar.confirmar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'confirmarReactivar.tituloLocal' }),
      ).not.toBeInTheDocument(),
    )

    const { toast } = await import('sonner')
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('confirmar el modal de reactivar de una Zona ejecuta la mutation y muestra toast de éxito', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    const zonaNueva = await crearZona('loc-002', { nombre: 'Zona de Prueba Inactiva' })
    await desactivarZona(zonaNueva.id)

    renderList()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-002')).toBeInTheDocument())
    const filaLoc002 = screen.getByTestId('local-row-loc-002')
    await user.click(within(filaLoc002).getByRole('button', { name: 'actions.expandir' }))

    await waitFor(() => expect(screen.getByTestId(`zona-row-${zonaNueva.id}`)).toBeInTheDocument())

    const filaZona = screen.getByTestId(`zona-row-${zonaNueva.id}`)
    await user.click(within(filaZona).getByRole('button', { name: 'actions.reactivar' }))

    expect(
      screen.getByRole('heading', { name: 'confirmarReactivar.tituloZona' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'confirmarReactivar.confirmar' }))

    const { toast } = await import('sonner')
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('reactivar un Local bloqueado por el límite de 5 activos (RN-LOC-001) muestra el mensaje del backend', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')

    // Deja un Local garantizado inactivo y sin incidentes para reactivar en el test.
    const localObjetivo = await crearLocal({
      nombre: 'Local Objetivo Reactivar',
      direccion: 'Av. Prueba 2',
    })
    await desactivarLocal(localObjetivo.id)

    const localesActuales = await listarLocales()
    const activosActuales = localesActuales.filter((l) => l.activo).length
    const faltantes = Math.max(0, 5 - activosActuales)
    for (let i = 0; i < faltantes; i++) {
      await crearLocal({ nombre: `Local Relleno ${i}`, direccion: 'Av. Relleno' })
    }

    renderList()

    await waitFor(() =>
      expect(screen.getByTestId(`local-row-${localObjetivo.id}`)).toBeInTheDocument(),
    )

    const filaLocal = screen.getByTestId(`local-row-${localObjetivo.id}`)
    await user.click(within(filaLocal).getByRole('button', { name: 'actions.reactivar' }))
    await user.click(screen.getByRole('button', { name: 'confirmarReactivar.confirmar' }))

    const { toast } = await import('sonner')
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/5 locales activos/i)),
    )
  })
})

describe('LocalList — loading y empty state', () => {
  it('muestra un skeleton mientras useLocales está cargando', async () => {
    await loginReal('admin@shac.pe')

    const { container } = renderList()

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('local-row-loc-001')).toBeInTheDocument())
  })

  it('muestra el estado vacío cuando no hay locales', async () => {
    server.use(
      http.get('/api/locales', async () => {
        await delay(10)
        return HttpResponse.json({ success: true, data: [] })
      }),
    )

    await loginReal('admin@shac.pe')

    renderList()

    await waitFor(() => expect(screen.getByText('list.empty')).toBeInTheDocument())
  })
})
