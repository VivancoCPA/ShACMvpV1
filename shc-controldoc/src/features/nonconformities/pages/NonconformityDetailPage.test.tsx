import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NonconformityDetailPage } from './NonconformityDetailPage'
import type { NoConformidad } from '../types/nonconformity.types'
import type { UserRole } from '../../../types/auth.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))

vi.mock('../components/ACSection', () => ({
  ACSection: () => <div data-testid="ac-section" />,
}))

vi.mock('../components/AnularNCModal', () => ({
  AnularNCModal: () => <div data-testid="anular-modal" />,
}))

const anularMutate = vi.fn()
let mockNC: NoConformidad | undefined
let mockRole: UserRole | undefined = 'SUPERVISOR'
const navigateMock = vi.fn()

vi.mock('../hooks/useNonconformities', () => ({
  useNonconformity: () => ({ data: mockNC, isLoading: false, isError: false, refetch: vi.fn() }),
  useAnularNonconformity: () => ({ mutate: anularMutate, isPending: false }),
}))

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { rol: UserRole } | null }) => unknown) =>
    sel({ user: mockRole ? { rol: mockRole } : null }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

function makeNC(overrides: Partial<NoConformidad> = {}): NoConformidad {
  return {
    id: 'nc-014',
    numero: 'NC-CAL-2026-014',
    dominio: 'CALIDAD',
    origen: 'INSPECCION_INTERNA',
    tipo: 'PROCESO',
    severidad: 'MEDIA',
    estado: 'EN_INVESTIGACION',
    descripcion: 'Descripción de prueba para la no conformidad',
    areaAfectada: 'Almacén Norte',
    reportadoPorId: 'user-1',
    fechaDeteccion: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    accionesCorrectivas: [],
    documentosVinculados: [],
    adjuntos: [],
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/nonconformities/nc-014']}>
      <Routes>
        <Route path="/nonconformities/:id" element={<NonconformityDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NonconformityDetailPage — botón Crear QE', () => {
  it('is visible for SUPERVISOR on an active NC without a linked QE', () => {
    mockNC = makeNC()
    mockRole = 'SUPERVISOR'
    renderPage()
    expect(screen.getByText('detail.actions.crearQE')).toBeInTheDocument()
  })

  it('is absent when the NC already has a linked QE', () => {
    mockNC = makeNC({ qeGeneradoId: 'qe-2026-005' })
    mockRole = 'SUPERVISOR'
    renderPage()
    expect(screen.queryByText('detail.actions.crearQE')).not.toBeInTheDocument()
  })

  it('is absent for OPERARIO', () => {
    mockNC = makeNC()
    mockRole = 'OPERARIO'
    renderPage()
    expect(screen.queryByText('detail.actions.crearQE')).not.toBeInTheDocument()
  })

  it('navigates with the correct vinculación query params on click', async () => {
    mockNC = makeNC()
    mockRole = 'SUPERVISOR'
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText('detail.actions.crearQE'))

    expect(navigateMock).toHaveBeenCalledWith(
      '/quality-events/nuevo?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-CAL-2026-014&ncArea=Almac%C3%A9n%20Norte',
    )
  })
})
