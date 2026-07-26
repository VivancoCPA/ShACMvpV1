import { describe, it, expect, afterEach } from 'vitest'
import { useAuthStore } from './authStore'
import type { User } from '../types/auth.types'
import type { Empresa } from '../features/empresas/types/empresa.types'

const baseUser: User = {
  id: 'user-supervisor-001',
  nombre: 'Carmen',
  apellido: 'Torres',
  email: 'supervisor@shac.pe',
  rol: 'SUPERVISOR',
  createdAt: '2024-08-12T14:30:00.000Z',
  activo: true,
}

const empresa1: Empresa = {
  id: 'empresa-001',
  razonSocial: 'Minera Andina del Sur S.A.C.',
  ruc: '20512345678',
  estado: 'ACTIVA',
  logoUrl: '/mock/empresas/empresa-001-logo.png',
  fechaAlta: '2022-01-01T00:00:00Z',
}

const empresa2: Empresa = {
  id: 'empresa-002',
  razonSocial: 'Terminal Portuario Ilo S.A.C.',
  ruc: '20598765432',
  estado: 'ACTIVA',
  logoUrl: '/mock/empresas/empresa-002-logo.png',
  fechaAlta: '2026-01-01T00:00:00Z',
}

afterEach(() => {
  localStorage.clear()
  useAuthStore.setState({
    user: null,
    empresaActivaId: null,
    empresasDisponibles: [],
    accessToken: null,
    isAuthenticated: false,
    isBootstrapping: false,
  })
})

describe('authStore — login', () => {
  it('guarda empresaActivaId y empresasDisponibles junto con el usuario', () => {
    useAuthStore.getState().login({
      user: baseUser,
      accessToken: 'mock-access-token-user-supervisor-001-123',
      empresaActivaId: 'empresa-001',
      empresasDisponibles: [empresa1, empresa2],
    })

    const state = useAuthStore.getState()
    expect(state.user?.rol).toBe('SUPERVISOR')
    expect(state.empresaActivaId).toBe('empresa-001')
    expect(state.empresasDisponibles).toHaveLength(2)
    expect(state.isAuthenticated).toBe(true)
  })

  it('persiste empresaActivaId en localStorage', () => {
    useAuthStore.getState().login({
      user: baseUser,
      accessToken: 'mock-access-token-user-supervisor-001-123',
      empresaActivaId: 'empresa-001',
      empresasDisponibles: [empresa1, empresa2],
    })

    expect(localStorage.getItem('shac_active_empresa_id')).toBe('empresa-001')
  })
})

describe('authStore — switchEmpresa', () => {
  it('actualiza el rol y la empresa activa de una sesión ya autenticada, sin tocar isAuthenticated', () => {
    useAuthStore.getState().login({
      user: baseUser,
      accessToken: 'mock-access-token-user-supervisor-001-123',
      empresaActivaId: 'empresa-001',
      empresasDisponibles: [empresa1, empresa2],
    })

    useAuthStore.getState().switchEmpresa({
      user: { ...baseUser, rol: 'JEFE_CALIDAD_SYST' },
      accessToken: 'mock-access-token-user-supervisor-001-456',
      empresaActivaId: 'empresa-002',
      empresasDisponibles: [empresa1, empresa2],
    })

    const state = useAuthStore.getState()
    expect(state.user?.rol).toBe('JEFE_CALIDAD_SYST')
    expect(state.empresaActivaId).toBe('empresa-002')
    expect(state.isAuthenticated).toBe(true)
  })

  it('actualiza el valor de empresaActivaId persistido en localStorage', () => {
    useAuthStore.getState().login({
      user: baseUser,
      accessToken: 'mock-access-token-user-supervisor-001-123',
      empresaActivaId: 'empresa-001',
      empresasDisponibles: [empresa1, empresa2],
    })

    useAuthStore.getState().switchEmpresa({
      user: { ...baseUser, rol: 'JEFE_CALIDAD_SYST' },
      accessToken: 'mock-access-token-user-supervisor-001-456',
      empresaActivaId: 'empresa-002',
      empresasDisponibles: [empresa1, empresa2],
    })

    expect(localStorage.getItem('shac_active_empresa_id')).toBe('empresa-002')
  })
})

describe('authStore — logout', () => {
  it('limpia empresaActivaId y empresasDisponibles junto con el resto de la sesión', () => {
    useAuthStore.getState().login({
      user: baseUser,
      accessToken: 'mock-access-token-user-supervisor-001-123',
      empresaActivaId: 'empresa-001',
      empresasDisponibles: [empresa1, empresa2],
    })

    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.empresaActivaId).toBeNull()
    expect(state.empresasDisponibles).toEqual([])
    expect(state.isAuthenticated).toBe(false)
  })

  it('elimina empresaActivaId de localStorage', () => {
    useAuthStore.getState().login({
      user: baseUser,
      accessToken: 'mock-access-token-user-supervisor-001-123',
      empresaActivaId: 'empresa-001',
      empresasDisponibles: [empresa1, empresa2],
    })

    useAuthStore.getState().logout()

    expect(localStorage.getItem('shac_active_empresa_id')).toBeNull()
  })
})
