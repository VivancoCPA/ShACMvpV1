import { render, screen, cleanup, configure, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import { useAuthStore } from '../../../stores/authStore'
import { createMockUser } from '../../../mocks/fixtures/mockUser'
import {
  aplicarFiltrosBaseAC,
  aplicarFiltrosDeEstadoAC,
  contarAC,
  ordenarAC,
  parseFiltrosAC,
} from '../../../mocks/utils/accionesCorrectivas.mock'
import { AccionesCorrectivasPage } from './AccionesCorrectivasPage'
import { AccionCorrectivaOrigenRedirect } from '../components/AccionCorrectivaOrigenRedirect'
import type { ACListadoFiltros, AccionCorrectivaListadoItem } from '../types/accionesCorrectivasListado.types'

// La suite completa corre en paralelo: margen para los waitFor/findBy de esta página.
configure({ asyncUtilTimeout: 5000 })

// 30 vencidas (2 páginas de 25) + 3 al día. La API se simula con la misma lógica de filtros y
// contadores que los handlers MSW (mocks/utils/accionesCorrectivas.mock.ts).
function ac(i: number, over: Partial<AccionCorrectivaListadoItem> = {}): AccionCorrectivaListadoItem {
  return {
    id: `ac-${i}`,
    origenTipo: 'QE',
    origenId: `qe-${i}`,
    origenNumero: `QE-2026-${String(i).padStart(3, '0')}`,
    titulo: '',
    descripcion: `Acción ${i}`,
    tipo: 'CORRECTIVA',
    prioridad: 'MEDIA',
    responsableId: 'user-ope',
    responsableNombre: 'Ana Pérez',
    areaId: 'area-001',
    areaNombre: 'Almacén',
    plazoFecha: '2026-11-01T00:00:00Z',
    estadoNormalizado: 'EN_EJECUCION',
    estadoOriginal: 'EN_EJECUCION',
    ejecutadaEn: null,
    verificadaEn: null,
    verificadaPorNombre: null,
    creadoEn: '2026-10-01T00:00:00Z',
    fechaCierre: null,
    vencida: true,
    diasHabilesRestantes: -3,
    ...over,
  }
}
const DATOS: AccionCorrectivaListadoItem[] = [
  ...Array.from({ length: 30 }, (_, i) => ac(i + 1)),
  ac(31, { vencida: false, diasHabilesRestantes: 10, plazoFecha: '2026-12-15T00:00:00Z', estadoNormalizado: 'PENDIENTE', estadoOriginal: 'PENDIENTE' }),
  ac(32, { origenTipo: 'NC', origenId: 'nc-1', origenNumero: 'NC-2026-001', vencida: false, diasHabilesRestantes: 2 }),
  ac(33, { origenTipo: 'INCIDENTE', origenId: 'inc-1', origenNumero: 'INC-2026-001', vencida: false, estadoNormalizado: 'CERRADA', estadoOriginal: 'CERRADA' }),
]

function toSearchParams(f: ACListadoFiltros): URLSearchParams {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined) continue
    p.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  return p
}

const listarMock = vi.fn(async (f: ACListadoFiltros) => {
  const filtros = parseFiltrosAC(toSearchParams(f))
  const ahora = new Date()
  const base = aplicarFiltrosBaseAC(DATOS, filtros)
  const filtradas = ordenarAC(aplicarFiltrosDeEstadoAC(base, filtros, ahora), filtros)
  return {
    items: filtradas.slice((filtros.page - 1) * filtros.pageSize, filtros.page * filtros.pageSize),
    pagination: {
      page: filtros.page,
      pageSize: filtros.pageSize,
      totalItems: filtradas.length,
      totalPages: Math.ceil(filtradas.length / filtros.pageSize),
    },
    contadores: contarAC(base, filtros, ahora),
  }
})
const origenMock = vi.fn()

vi.mock('../api/accionesCorrectivasListado.api', () => ({
  listarAccionesCorrectivas: (f: ACListadoFiltros) => listarMock(f),
  exportarAccionesCorrectivas: vi.fn(async () => []),
  obtenerOrigenAccionCorrectiva: (id: string) => origenMock(id),
}))
vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: [{ id: 'area-001', nombre: 'Almacén', activo: true }] }),
}))
vi.mock('../../users/hooks/useCandidatosUsuarios', () => ({
  useCandidatosUsuarios: () => ({ data: [{ id: 'user-ope', nombreCompleto: 'Ana Pérez', rol: 'OPERARIO' }] }),
}))

function UbicacionActual() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>
}

function renderEn(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/acciones-correctivas" element={<AccionesCorrectivasPage />} />
            <Route path="/acciones-correctivas/:id" element={<AccionCorrectivaOrigenRedirect />} />
            <Route path="*" element={null} />
          </Routes>
          <UbicacionActual />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

const ubicacion = () => screen.getByTestId('location').textContent ?? ''
const filasEnPantalla = () => document.querySelectorAll('tbody tr').length

beforeEach(async () => {
  await i18n.changeLanguage('es-PE')
  useAuthStore.setState({ user: createMockUser({ id: 'user-jca', rol: 'JEFE_CALIDAD_SYST' }), empresaActivaId: 'empresa-001' })
})
afterEach(() => {
  cleanup()
  listarMock.mockClear()
  origenMock.mockReset()
})

describe('AccionesCorrectivasPage', () => {
  it('clic en "Vencidas": URL con vencida=true y la tabla tiene exactamente esa cantidad de filas', async () => {
    renderEn('/acciones-correctivas')
    const tarjeta = await screen.findByRole('button', { name: '30 Vencidas' })
    expect(tarjeta).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(tarjeta)

    await waitFor(() => expect(ubicacion()).toBe('/acciones-correctivas?vencida=true'))
    expect(screen.getByRole('button', { name: '30 Vencidas' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(filasEnPantalla()).toBe(25))

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Paginación' })).getByRole('button', { name: '2' }))
    await waitFor(() => expect(filasEnPantalla()).toBe(5))
    expect(ubicacion()).toBe('/acciones-correctivas?vencida=true&page=2')
  })

  it('los filtros de la URL se aplican al cargar (F5)', async () => {
    renderEn('/acciones-correctivas?origenTipo=NC&tipo=CORRECTIVA')
    await waitFor(() => expect(filasEnPantalla()).toBe(1))
    expect(screen.getByLabelText('Origen')).toHaveValue('NC')
    expect(screen.getByLabelText('Tipo')).toHaveValue('CORRECTIVA')
    expect(listarMock).toHaveBeenCalledWith(expect.objectContaining({ origenTipo: 'NC', tipo: 'CORRECTIVA', page: 1 }))
  })

  it('el OPERARIO ve "Mis acciones correctivas" y no tiene filtro de responsable', async () => {
    useAuthStore.setState({ user: createMockUser({ id: 'user-ope', rol: 'OPERARIO' }) })
    renderEn('/acciones-correctivas')
    expect(await screen.findByRole('heading', { name: 'Mis acciones correctivas' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Responsable')).not.toBeInTheDocument()
  })

  it('el JCA ve "Acciones correctivas" con filtro de responsable', async () => {
    renderEn('/acciones-correctivas')
    expect(await screen.findByRole('heading', { name: 'Acciones correctivas' })).toBeInTheDocument()
    expect(screen.getByLabelText('Responsable')).toBeInTheDocument()
  })

  it('clic en una fila de origen QE navega a /quality-events/{id}#qe-ac-section', async () => {
    renderEn('/acciones-correctivas')
    const fila = await screen.findByTestId('ac-row-ac-1')
    fireEvent.click(within(fila).getByText('Acción 1'))
    await waitFor(() => expect(ubicacion()).toBe('/quality-events/qe-1#qe-ac-section'))
  })

  it('el OPERARIO no tiene enlace a una AC de origen NC', async () => {
    useAuthStore.setState({ user: createMockUser({ id: 'user-ope', rol: 'OPERARIO' }) })
    renderEn('/acciones-correctivas?origenTipo=NC')
    const fila = await screen.findByTestId('ac-row-ac-32')
    expect(within(fila).queryByRole('link')).not.toBeInTheDocument()
    fireEvent.click(fila)
    expect(ubicacion()).toBe('/acciones-correctivas?origenTipo=NC')
  })

  it('estado vacío', async () => {
    renderEn('/acciones-correctivas?search=no-existe')
    expect(await screen.findByText('No hay acciones correctivas con estos filtros.')).toBeInTheDocument()
  })
})

describe('AccionCorrectivaOrigenRedirect', () => {
  it('redirige al origen de la AC', async () => {
    origenMock.mockResolvedValue({ origenTipo: 'INCIDENTE', origenId: 'inc-9' })
    renderEn('/acciones-correctivas/ac-77')
    await waitFor(() => expect(ubicacion()).toBe('/incidents/inc-9'))
    expect(origenMock).toHaveBeenCalledWith('ac-77')
  })

  it('si la AC no existe vuelve al listado', async () => {
    origenMock.mockRejectedValue(new Error('404'))
    renderEn('/acciones-correctivas/no-existe')
    await waitFor(() => expect(ubicacion()).toBe('/acciones-correctivas'))
  })
})
