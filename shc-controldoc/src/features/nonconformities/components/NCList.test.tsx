import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NCList } from './NCList'
import { nonconformityFixtures } from '../../../mocks/fixtures/nonconformities.fixtures'
import type { NoConformidad } from '../types/nonconformity.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

let mockNCs: NoConformidad[] = []
vi.mock('../hooks/useNCList', () => ({
  useNCList: () => ({
    nonconformidades: mockNCs,
    isLoading: false,
    isError: false,
    pagination: { page: 1, pageSize: 20, totalItems: mockNCs.length, totalPages: 1 },
    refetch: vi.fn(),
  }),
}))

vi.mock('../hooks/useNonconformities', () => ({
  useDeleteNC: () => ({ mutate: vi.fn(), isPending: false }),
  useRestoreNC: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: [] }),
}))

const baseNC = nonconformityFixtures.find((nc) => nc.accionesCorrectivas.length > 0)!

describe('NCList — columna de responsable (ac-tipo-responsables)', () => {
  it('muestra el nombre del responsable de la AC, nunca su id', () => {
    const ac = { ...baseNC.accionesCorrectivas[0], responsableId: 'user-xyz', responsableNombre: 'Rosa Quispe' }
    mockNCs = [{ ...baseNC, deletedAt: undefined, accionesCorrectivas: [ac] }]

    render(<NCList />, { wrapper: MemoryRouter })

    expect(screen.getByText('Rosa Quispe')).toBeInTheDocument()
    expect(screen.queryByText('user-xyz')).not.toBeInTheDocument()
  })

  it('sin nombre resuelto muestra "Usuario no disponible"', () => {
    const ac = { ...baseNC.accionesCorrectivas[0], responsableId: 'user-xyz', responsableNombre: '' }
    mockNCs = [{ ...baseNC, deletedAt: undefined, accionesCorrectivas: [ac] }]

    render(<NCList />, { wrapper: MemoryRouter })

    expect(screen.getByText('common:userNames.noDisponible')).toBeInTheDocument()
    expect(screen.queryByText('user-xyz')).not.toBeInTheDocument()
  })
})
