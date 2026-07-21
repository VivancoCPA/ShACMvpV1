import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { IncidentForm } from './IncidentForm'
import type { Local } from '../types/incident.types'
import type { UserRole } from '../../../types/auth.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

let mockRole: UserRole = 'SUPERVISOR'
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { rol: UserRole } | null }) => unknown) =>
    sel({ user: { rol: mockRole } }),
}))

vi.mock('../hooks/useIncidents', () => ({
  useCreateIncident: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncident: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: [{ id: 'area-syst', nombre: 'SyST', activo: true }] }),
}))

vi.mock('../hooks/useZonasByLocal', () => ({
  useZonasByLocal: () => ({ data: [], isLoading: false, isError: false }),
}))

// Forma real del hook: `{ locales, isLoading, isError }`, nunca `{ data }`.
// Un mock que use `{ data: [...] }` en vez de `{ locales: [...] }` enmascararía
// de nuevo el mismatch de forma diagnosticado en IncidentForm/IncidentDetailPage.
let mockLocales: Local[] = []
let mockIsLoading = false
vi.mock('../hooks/useLocales', () => ({
  useLocales: () => ({ locales: mockLocales, isLoading: mockIsLoading, isError: false }),
}))

const localFixtures: Local[] = [
  {
    id: 'loc-001',
    nombre: 'Almacén Principal',
    codigo: 'LOC-001',
    activo: true,
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-002',
    nombre: 'Patio de Minerales',
    codigo: 'LOC-002',
    activo: true,
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
]

function renderForm() {
  return render(
    <MemoryRouter>
      <IncidentForm mode="create" />
    </MemoryRouter>,
  )
}

describe('IncidentForm — selector de Local', () => {
  beforeEach(() => {
    mockRole = 'SUPERVISOR'
    mockIsLoading = false
  })

  it('muestra las opciones de locales devueltas por useLocales', () => {
    mockLocales = localFixtures
    renderForm()

    const select = screen.getByLabelText('form.fields.localId') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((o) => o.textContent)

    expect(optionLabels).toContain('Almacén Principal')
    expect(optionLabels).toContain('Patio de Minerales')
  })

  it('solo muestra el placeholder mientras useLocales está cargando', () => {
    mockLocales = []
    mockIsLoading = true
    renderForm()

    const select = screen.getByLabelText('form.fields.localId') as HTMLSelectElement
    expect(select.options.length).toBe(1)
    expect(select.options[0].value).toBe('')
  })
})
