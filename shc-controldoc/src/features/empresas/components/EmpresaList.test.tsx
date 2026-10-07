// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { EmpresaList } from './EmpresaList'
import type { Empresa } from '../types/empresa.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))

let empresasData: Empresa[] | undefined = []
vi.mock('../hooks/useEmpresas', () => ({
  useEmpresas: () => ({ data: empresasData, isLoading: false }),
  useUpdateEmpresa: () => ({ mutate: vi.fn(), isPending: false }),
}))

afterEach(() => cleanup())

function makeEmpresas(n: number): Empresa[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e-${i}`,
    razonSocial: `Empresa ${String(i).padStart(2, '0')} SAC`,
    ruc: `2010000${String(i).padStart(4, '0')}`,
    estado: i % 5 === 0 ? 'INACTIVA' : 'ACTIVA',
    logoUrl: '',
    fechaAlta: '2026-01-01T00:00:00Z',
  }))
}

function renderList() {
  return render(
    <MemoryRouter>
      <EmpresaList onEdit={vi.fn()} canAdminister />
    </MemoryRouter>,
  )
}

function bodyRows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

describe('EmpresaList', () => {
  it('pagina de 10 en 10', () => {
    empresasData = makeEmpresas(25)
    renderList()
    expect(bodyRows()).toHaveLength(10)
  })

  it('filtra por razón social sin distinguir mayúsculas', async () => {
    empresasData = makeEmpresas(25)
    renderList()
    await userEvent.type(screen.getByLabelText('list.filters.buscar'), 'empresa 07')
    expect(bodyRows()).toHaveLength(1)
  })

  it('filtra por RUC parcial', async () => {
    empresasData = makeEmpresas(25)
    renderList()
    await userEvent.type(screen.getByLabelText('list.filters.buscar'), '0000012')
    expect(bodyRows()).toHaveLength(1)
    expect(screen.getByText('Empresa 12 SAC')).toBeTruthy()
  })

  it('filtra por estado Inactivas', async () => {
    empresasData = makeEmpresas(25)
    renderList()
    await userEvent.selectOptions(screen.getByLabelText('list.filters.estado'), 'INACTIVAS')
    expect(bodyRows()).toHaveLength(5)
  })

  it('cambiar un filtro vuelve a la página 1', async () => {
    empresasData = makeEmpresas(25)
    renderList()
    await userEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText('Empresa 10 SAC')).toBeTruthy()
    await userEvent.selectOptions(screen.getByLabelText('list.filters.estado'), 'ACTIVAS')
    expect(screen.getByText('Empresa 01 SAC')).toBeTruthy()
  })

  it('distingue "sin empresas" de "sin coincidencias"', async () => {
    empresasData = []
    const { unmount } = renderList()
    expect(screen.getByText('list.vacio')).toBeTruthy()
    unmount()

    empresasData = makeEmpresas(3)
    renderList()
    await userEvent.type(screen.getByLabelText('list.filters.buscar'), 'zzz')
    expect(screen.getByText('list.sinResultados')).toBeTruthy()
    expect(screen.queryByText('list.vacio')).toBeNull()
  })
})
