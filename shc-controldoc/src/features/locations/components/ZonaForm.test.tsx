import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ZonaForm } from './ZonaForm'
import type { Zona } from '../../incidents/types/incident.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const crearZonaMutateAsync = vi.fn()
const actualizarZonaMutateAsync = vi.fn()

vi.mock('../hooks/useLocales', () => ({
  useCrearZona: () => ({ mutateAsync: crearZonaMutateAsync, isPending: false }),
  useActualizarZona: () => ({ mutateAsync: actualizarZonaMutateAsync, isPending: false }),
}))

afterEach(() => cleanup())

const zonaFixture: Zona = {
  id: 'zon-005',
  localId: 'loc-001',
  nombre: 'Zona de Carga',
  codigo: 'ZON-005',
  activo: true,
  creadoEn: '2026-01-01T00:00:00.000Z',
  actualizadoEn: '2026-01-01T00:00:00.000Z',
  descripcion: 'Área de carga y descarga',
}

describe('ZonaForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crear zona invoca useCrearZona con el localId provisto', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    crearZonaMutateAsync.mockResolvedValue({ id: 'zon-new' })

    render(<ZonaForm mode="create" localId="loc-001" onSaved={onSaved} />)

    await user.type(screen.getByLabelText(/form\.fields\.nombre/), 'Zona Nueva')
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() =>
      expect(crearZonaMutateAsync).toHaveBeenCalledWith({
        localId: 'loc-001',
        data: expect.objectContaining({ nombre: 'Zona Nueva' }),
      }),
    )
    expect(onSaved).toHaveBeenCalled()
    expect(actualizarZonaMutateAsync).not.toHaveBeenCalled()
  })

  it('editar zona precarga nombre y descripción', () => {
    render(<ZonaForm mode="edit" localId="loc-001" zona={zonaFixture} onSaved={vi.fn()} />)

    expect(screen.getByLabelText(/form\.fields\.nombre/)).toHaveValue('Zona de Carga')
    expect(screen.getByLabelText(/form\.fields\.descripcion/)).toHaveValue('Área de carga y descarga')
  })

  it('editar zona invoca useActualizarZona con el id de la zona', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    actualizarZonaMutateAsync.mockResolvedValue(zonaFixture)

    render(<ZonaForm mode="edit" localId="loc-001" zona={zonaFixture} onSaved={onSaved} />)

    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() =>
      expect(actualizarZonaMutateAsync).toHaveBeenCalledWith({
        zonaId: 'zon-005',
        data: expect.objectContaining({ nombre: 'Zona de Carga' }),
      }),
    )
    expect(onSaved).toHaveBeenCalled()
    expect(crearZonaMutateAsync).not.toHaveBeenCalled()
  })
})
