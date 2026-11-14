import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import axios, { isAxiosError } from 'axios'
import { authHandlers } from './auth.handlers'
import { accionesCorrectivasHandlers } from './acciones-correctivas.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getAuditoriaSesionStore, resetSesionStores } from '../fixtures/sesion.fixtures'
import { resetResponsablesAcStore } from '../fixtures/responsablesAc.fixtures'
import { useAuthStore } from '../../stores/authStore'
import type { ConfiguracionResponsablesAc } from '../../features/acciones-correctivas/types/responsablesAc.types'
import type { CandidatoUsuario } from '../../constants/accionCorrectivaTipo.constants'

// Cliente axios "crudo" (sin los interceptores de lib/axios.ts) para inspeccionar las respuestas tal cual.
const http = axios.create()

const server = setupServer(...authHandlers, ...accionesCorrectivasHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  resetSesionStores()
  resetResponsablesAcStore()
  useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null, empresaActivaId: null })
})

async function login(email: string) {
  const fixture = authFixtures.find((u) => u.email === email)
  if (!fixture) throw new Error(`Fixture no encontrado: ${email}`)
  const res = await http.post('/api/auth/login', { email, password: fixture.password, empresaId: 'empresa-001' })
  const data = res.data.data as {
    accessToken: string
    user: import('../../types/auth.types').User
    empresaActivaId: string
  }
  useAuthStore.setState({
    user: data.user,
    accessToken: data.accessToken,
    isAuthenticated: true,
    empresaActivaId: data.empresaActivaId,
  })
  return { headers: { Authorization: `Bearer ${data.accessToken}` } }
}

const RUTA = '/api/empresas/empresa-001/responsables-ac'

const BODY_DEFAULTS = {
  tipos: [
    {
      tipo: 'CORRECTIVA',
      roles: ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
    },
    { tipo: 'PREVENTIVA', roles: ['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'ALTA_DIRECCION'] },
    { tipo: 'MEJORA', roles: ['JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'ALTA_DIRECCION'] },
  ],
}

function bodyCon(tipo: 'CORRECTIVA' | 'PREVENTIVA' | 'MEJORA', roles: string[]) {
  return { tipos: BODY_DEFAULTS.tipos.map((t) => (t.tipo === tipo ? { tipo, roles } : t)) }
}

async function expectStatus(promise: Promise<unknown>, status: number): Promise<string[]> {
  try {
    await promise
  } catch (error) {
    expect(isAxiosError(error) && error.response?.status).toBe(status)
    return (isAxiosError(error) && (error.response?.data.errors as string[] | undefined)) || []
  }
  throw new Error(`se esperaba ${status}`)
}

describe('acciones-correctivas.handlers — configuración de responsables de AC', () => {
  it('sin configuración devuelve los defaults con esDefault', async () => {
    const auth = await login('admin.empresa@shac.pe')

    const res = await http.get(RUTA, auth)

    const dto = res.data.data as ConfiguracionResponsablesAc
    expect(dto.tipos.map((t) => t.tipo)).toEqual(['CORRECTIVA', 'PREVENTIVA', 'MEJORA'])
    expect(dto.tipos.every((t) => t.esDefault)).toBe(true)
    expect(dto.rolesDisponibles).toHaveLength(6)
  })

  it('PUT válido guarda, audita solo el tipo que cambió y los candidatos usan la regla nueva', async () => {
    const admin = await login('admin.empresa@shac.pe')
    const res = await http.put(RUTA, bodyCon('MEJORA', ['JEFE_CALIDAD_SYST']), admin)

    const dto = res.data.data as ConfiguracionResponsablesAc
    expect(dto.tipos[2]).toEqual({ tipo: 'MEJORA', roles: ['JEFE_CALIDAD_SYST'], esDefault: false })
    expect(dto.tipos[0].esDefault).toBe(true)
    const auditoria = getAuditoriaSesionStore()
    expect(auditoria).toHaveLength(1)
    expect(auditoria[0].campo).toBe('responsablesAc.MEJORA')

    const jca = await login('jefe.calidad@shac.pe')
    const candidatos = await http.get('/api/acciones-correctivas/candidatos-responsable?tipo=MEJORA', jca)
    expect((candidatos.data.data as CandidatoUsuario[]).every((c) => c.rol === 'JEFE_CALIDAD_SYST')).toBe(true)
  })

  it('PUT con un tipo sin roles responde 400 en el campo', async () => {
    const auth = await login('admin.empresa@shac.pe')

    const errors = await expectStatus(http.put(RUTA, bodyCon('PREVENTIVA', []), auth), 400)

    expect(errors.some((e) => e.startsWith('tipos[1].roles:'))).toBe(true)
  })

  it('PUT con un rol de administración o sin un tipo responde 400', async () => {
    const auth = await login('admin.empresa@shac.pe')

    await expectStatus(http.put(RUTA, bodyCon('MEJORA', ['ADMINISTRADOR_EMPRESA']), auth), 400)
    const errors = await expectStatus(http.put(RUTA, { tipos: BODY_DEFAULTS.tipos.slice(0, 2) }, auth), 400)
    expect(errors.some((e) => e.startsWith('tipos:'))).toBe(true)
  })

  it('restablecer vuelve a los defaults', async () => {
    const auth = await login('admin.empresa@shac.pe')
    await http.put(RUTA, bodyCon('MEJORA', ['JEFE_CALIDAD_SYST']), auth)

    const res = await http.post(`${RUTA}/restablecer`, undefined, auth)

    const dto = res.data.data as ConfiguracionResponsablesAc
    expect(dto.tipos.every((t) => t.esDefault)).toBe(true)
    expect(dto.tipos[2].roles).toEqual(['JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'ALTA_DIRECCION'])
  })

  it('ADMINISTRADOR_EMPRESA sobre otra empresa recibe 404 y un JCA recibe 403', async () => {
    const admin = await login('admin.empresa@shac.pe')
    await expectStatus(http.get('/api/empresas/empresa-002/responsables-ac', admin), 404)

    const jca = await login('jefe.calidad@shac.pe')
    await expectStatus(http.get(RUTA, jca), 403)
  })
})
