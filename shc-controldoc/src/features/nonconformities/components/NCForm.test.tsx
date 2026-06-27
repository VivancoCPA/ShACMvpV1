import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NCForm } from './NCForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false, isError: false }),
  useMutation: () => ({
    mutateAsync: vi.fn(),
    data: undefined,
    reset: vi.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../constants/nonconformity.constants', () => ({
  NC_DOMINIO_LABELS: {
    CALIDAD: 'Calidad',
    SST: 'SST',
    ADUANERO: 'Aduanero',
    OPERACIONAL: 'Operacional',
    PROVEEDOR: 'Proveedores',
  },
}))

vi.mock('../../../constants/shared.constants', () => ({
  AREAS_SHAC: ['Almacén Norte', 'Almacén Sur'],
}))

vi.mock('../hooks/useNonconformities', () => ({
  QUERY_KEYS: { nonconformities: { all: ['nonconformities'] } },
}))

vi.mock('../api/nonconformities.api', () => ({
  createNonconformity: vi.fn(),
  getUsers: vi.fn().mockResolvedValue([]),
  deleteNonconformity: vi.fn(),
  restoreNonconformity: vi.fn(),
}))

describe('NCForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dominio select', () => {
    render(<NCForm />)
    expect(screen.getByLabelText(/form\.fields\.dominio/i)).toBeTruthy()
  })

  it('shows IPER warning when dominio SST is selected', async () => {
    const user = userEvent.setup()
    render(<NCForm />)

    const dominioSelect = screen.getByLabelText(/form\.fields\.dominio/i)
    await act(async () => {
      await user.selectOptions(dominioSelect, 'SST')
    })

    expect(screen.queryByText('form.warnings.iperTitle')).not.toBeNull()
  })

  it('does not show IPER warning when dominio is CALIDAD', async () => {
    const user = userEvent.setup()
    render(<NCForm />)

    const dominioSelect = screen.getByLabelText(/form\.fields\.dominio/i)
    await act(async () => {
      await user.selectOptions(dominioSelect, 'CALIDAD')
    })

    expect(screen.queryByText('form.warnings.iperTitle')).toBeNull()
  })

  it('shows aduana warning when dominio ADUANERO is selected', async () => {
    const user = userEvent.setup()
    render(<NCForm />)

    const dominioSelect = screen.getByLabelText(/form\.fields\.dominio/i)
    await act(async () => {
      await user.selectOptions(dominioSelect, 'ADUANERO')
    })

    expect(screen.queryByText('form.warnings.aduanaTitle')).not.toBeNull()
  })

  it('disables requiereIPER checkbox when dominio is SST', async () => {
    const user = userEvent.setup()
    render(<NCForm />)

    const dominioSelect = screen.getByLabelText(/form\.fields\.dominio/i)
    await act(async () => {
      await user.selectOptions(dominioSelect, 'SST')
    })

    const iperCheckbox = screen.getByLabelText(/form\.fields\.requiereIPER/i) as HTMLInputElement
    expect(iperCheckbox.disabled).toBe(true)
  })
})
