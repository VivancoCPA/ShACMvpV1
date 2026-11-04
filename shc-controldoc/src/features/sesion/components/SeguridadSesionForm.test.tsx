// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeguridadSesionForm } from './SeguridadSesionForm'
import { PARAMETROS_SESION_SEMILLA } from '../../../mocks/fixtures/sesion.fixtures'
import type { SeguridadSesionEmpresa } from '../types/sesion.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))

const mutate = vi.fn()
const data: SeguridadSesionEmpresa = {
  empresaId: 'empresa-001',
  inactividadMinutos: null,
  sesionMaximaHoras: null,
  efectiva: { inactividadMinutos: 30, sesionMaximaHoras: 12 },
  parametrosGlobales: PARAMETROS_SESION_SEMILLA,
  actualizadoPorId: null,
  actualizadoPorNombre: null,
  actualizadoEn: null,
}
vi.mock('../hooks/useSesion', () => ({
  useSeguridadSesionEmpresa: () => ({ data, isLoading: false, isError: false }),
  useUpdateSeguridadSesionEmpresa: () => ({ mutate, isPending: false }),
}))

afterEach(() => cleanup())
beforeEach(() => mutate.mockClear())

async function setValue(label: string, value: string) {
  const input = screen.getByLabelText(label)
  await userEvent.clear(input)
  await userEvent.type(input, value)
}

describe('SeguridadSesionForm', () => {
  it('rechaza una inactividad fuera de rango y no envía', async () => {
    render(<SeguridadSesionForm empresaId="empresa-001" />)
    await userEvent.click(screen.getAllByLabelText('config.useDefault')[0])
    await setValue('config.inactividadLabel', '2')

    await userEvent.click(screen.getByRole('button', { name: 'config.save' }))

    expect(await screen.findByText('sesion:errors.outOfRange')).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('rechaza una sesión máxima menor que la inactividad', async () => {
    render(<SeguridadSesionForm empresaId="empresa-001" />)
    const [usarDefaultInactividad, usarDefaultSesion] = screen.getAllByLabelText('config.useDefault')
    await userEvent.click(usarDefaultInactividad)
    await userEvent.click(usarDefaultSesion)
    await setValue('config.inactividadLabel', '120')
    await setValue('config.sesionMaximaLabel', '1')

    await userEvent.click(screen.getByRole('button', { name: 'config.save' }))

    expect(await screen.findByText('sesion:errors.sesionMenorQueInactividad')).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('envía null para "Usar valor por defecto del sistema"', async () => {
    render(<SeguridadSesionForm empresaId="empresa-001" />)
    await userEvent.click(screen.getAllByLabelText('config.useDefault')[0])
    await setValue('config.inactividadLabel', '5')

    await userEvent.click(screen.getByRole('button', { name: 'config.save' }))

    await waitFor(() => expect(mutate).toHaveBeenCalled())
    expect(mutate.mock.calls[0][0]).toEqual({ inactividadMinutos: 5, sesionMaximaHoras: null })
  })
})
