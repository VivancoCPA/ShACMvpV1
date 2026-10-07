// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { EmpresaForm } from './EmpresaForm'
import type { Empresa } from '../types/empresa.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const updateMutateAsync = vi.fn()
const createMutateAsync = vi.fn()
vi.mock('../hooks/useEmpresas', () => ({
  useCreateEmpresa: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateEmpresa: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}))

afterEach(() => cleanup())

const empresa: Empresa = {
  id: 'e-1',
  razonSocial: 'Minera Andina SAC',
  ruc: '20100000001',
  estado: 'ACTIVA',
  logoUrl: 'data:image/png;base64,AAAA',
  fechaAlta: '2026-01-01T00:00:00Z',
}

function axiosError(status: number, message?: string) {
  return new AxiosError('fail', undefined, undefined, undefined, {
    status,
    data: message ? { message } : null,
  } as AxiosResponse)
}

describe('EmpresaForm (edición)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('editar sin tocar el logo no reenvía logoBase64', async () => {
    updateMutateAsync.mockResolvedValue(empresa)
    const onSuccess = vi.fn()
    render(<EmpresaForm mode="edit" empresa={empresa} onCancel={vi.fn()} onSuccess={onSuccess} />)

    const input = screen.getByLabelText(/form.fields.razonSocial/)
    await userEvent.clear(input)
    await userEvent.type(input, 'Minera Nueva SAC')
    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled())
    expect(updateMutateAsync).toHaveBeenCalledWith({ id: 'e-1', data: { razonSocial: 'Minera Nueva SAC' } })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('quitar logo envía logoBase64 vacío', async () => {
    updateMutateAsync.mockResolvedValue(empresa)
    render(<EmpresaForm mode="edit" empresa={empresa} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'form.actions.quitarLogo' }))
    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled())
    expect(updateMutateAsync).toHaveBeenCalledWith({ id: 'e-1', data: { logoBase64: '' } })
  })

  it('un error 500 deja el modal abierto con error visible y botones operativos', async () => {
    updateMutateAsync.mockRejectedValue(axiosError(500))
    const onSuccess = vi.fn()
    render(<EmpresaForm mode="edit" empresa={empresa} onCancel={vi.fn()} onSuccess={onSuccess} />)

    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(await screen.findByText('form.errors.generico')).toBeTruthy()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'form.actions.submit' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'form.actions.cancel' })).toBeEnabled()
  })

  it('un 409 se muestra en el campo RUC, no como error genérico', async () => {
    updateMutateAsync.mockRejectedValue(axiosError(409, 'El RUC ya está registrado'))
    render(<EmpresaForm mode="edit" empresa={empresa} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(await screen.findByText('El RUC ya está registrado')).toBeTruthy()
    expect(screen.queryByText('form.errors.generico')).toBeNull()
  })
})
