// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ResponsablesAcForm } from './ResponsablesAcForm'
import { ResponsablesAcSection } from './ResponsablesAcSection'
import { ResponsablesAcEmpresaModal } from './ResponsablesAcEmpresaModal'
import { useAuthStore } from '../../../stores/authStore'
import type { ConfiguracionResponsablesAc } from '../types/responsablesAc.types'
import type { User } from '../../../types/auth.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => (opts?.empresa ? `${key}:${opts.empresa}` : key),
    i18n: { language: 'es-PE' },
  }),
}))

const { updateMock, restablecerMock, useResponsablesAcMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  restablecerMock: vi.fn(),
  useResponsablesAcMock: vi.fn(),
}))

const data: ConfiguracionResponsablesAc = {
  empresaId: 'empresa-001',
  tipos: [
    {
      tipo: 'CORRECTIVA',
      roles: ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
      esDefault: true,
    },
    { tipo: 'PREVENTIVA', roles: ['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'ALTA_DIRECCION'], esDefault: true },
    { tipo: 'MEJORA', roles: ['JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'ALTA_DIRECCION'], esDefault: true },
  ],
  rolesDisponibles: ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  actualizadoPorNombre: null,
  actualizadoEn: null,
}

vi.mock('../hooks/useResponsablesAc', () => ({
  useResponsablesAc: useResponsablesAcMock,
  useActualizarResponsablesAc: () => ({ mutate: updateMock, isPending: false }),
  useRestablecerResponsablesAc: () => ({ mutate: restablecerMock, isPending: false }),
}))

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

function setRol(rol: User['rol']) {
  useAuthStore.setState({
    user: { id: 'u1', nombre: 'A', apellido: 'B', email: 'a@b.pe', rol } as User,
    empresaActivaId: 'empresa-001',
  })
}

afterEach(() => cleanup())
beforeEach(() => {
  updateMock.mockClear()
  restablecerMock.mockClear()
  useResponsablesAcMock.mockReturnValue({ data, isLoading: false, isError: false })
})

describe('ResponsablesAcForm', () => {
  it('muestra la matriz 3×6 con los defaults marcados y el badge "Por defecto"', () => {
    render(<ResponsablesAcForm empresaId="empresa-001" />, { wrapper })

    expect(screen.getAllByRole('checkbox')).toHaveLength(18)
    expect(screen.getAllByText('responsablesAc.porDefecto')).toHaveLength(3)
    expect(screen.getByLabelText('acTipo.MEJORA — roles.ALTA_DIRECCION')).toBeChecked()
    expect(screen.getByLabelText('acTipo.MEJORA — roles.OPERARIO')).not.toBeChecked()
  })

  it('desmarcar todos los roles de una fila la marca en error y deshabilita Guardar', async () => {
    render(<ResponsablesAcForm empresaId="empresa-001" />, { wrapper })

    for (const rol of ['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'ALTA_DIRECCION']) {
      await userEvent.click(screen.getByLabelText(`acTipo.PREVENTIVA — roles.${rol}`))
    }

    expect(await screen.findByText('users:responsablesAc.alMenosUno')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'responsablesAc.guardar' })).toBeDisabled()
  })

  it('guardar envía los 3 tipos con la fila editada', async () => {
    render(<ResponsablesAcForm empresaId="empresa-001" />, { wrapper })

    await userEvent.click(screen.getByLabelText('acTipo.MEJORA — roles.ALTA_DIRECCION'))
    await userEvent.click(screen.getByRole('button', { name: 'responsablesAc.guardar' }))

    expect(updateMock).toHaveBeenCalledWith({
      tipos: [
        { tipo: 'CORRECTIVA', roles: data.tipos[0].roles },
        { tipo: 'PREVENTIVA', roles: data.tipos[1].roles },
        { tipo: 'MEJORA', roles: ['JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO'] },
      ],
    })
  })

  it('restablecer pide confirmación antes de llamar al endpoint', async () => {
    useResponsablesAcMock.mockReturnValue({
      data: { ...data, tipos: data.tipos.map((t) => (t.tipo === 'MEJORA' ? { ...t, roles: ['JEFE_CALIDAD_SYST'], esDefault: false } : t)) },
      isLoading: false,
      isError: false,
    })
    render(<ResponsablesAcForm empresaId="empresa-001" />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: 'responsablesAc.restablecer' }))
    expect(restablecerMock).not.toHaveBeenCalled()
    expect(screen.getByText('responsablesAc.confirmarRestablecer')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'responsablesAc.confirmar' }))
    expect(restablecerMock).toHaveBeenCalledTimes(1)
  })
})

describe('ResponsablesAcSection', () => {
  it('se muestra al ADMINISTRADOR_EMPRESA', () => {
    setRol('ADMINISTRADOR_EMPRESA')
    render(<ResponsablesAcSection />, { wrapper })

    expect(screen.getByRole('heading', { name: 'responsablesAc.title' })).toBeInTheDocument()
  })

  it('no aparece para el JEFE_CALIDAD_SYST', () => {
    setRol('JEFE_CALIDAD_SYST')
    const { container } = render(<ResponsablesAcSection />, { wrapper })

    expect(container).toBeEmptyDOMElement()
  })
})

describe('ResponsablesAcEmpresaModal', () => {
  it('abre la configuración de la empresa elegida', () => {
    render(<ResponsablesAcEmpresaModal empresaId="empresa-002" empresaNombre="Ilo SAC" onClose={() => {}} />, { wrapper })

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('responsablesAc.modalTitle:Ilo SAC')).toBeInTheDocument()
    expect(useResponsablesAcMock).toHaveBeenCalledWith('empresa-002')
  })
})
