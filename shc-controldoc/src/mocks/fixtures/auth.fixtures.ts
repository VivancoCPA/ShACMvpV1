import type { UserRole } from '../../types/auth.types'

export interface MockUser {
  id: string
  nombre: string
  apellido: string
  email: string
  password: string
  rol: UserRole
  area: string
  avatarUrl: undefined
}

export const MOCK_RESET_TOKEN = 'mock-reset-token'

export const authFixtures: MockUser[] = [
  {
    id: 'user-operario-001',
    nombre: 'Luis',
    apellido: 'Quispe',
    email: 'operario@shac.pe',
    password: 'Shac2025!',
    rol: 'OPERARIO',
    area: 'Operaciones',
    avatarUrl: undefined,
  },
  {
    id: 'user-supervisor-001',
    nombre: 'Carmen',
    apellido: 'Torres',
    email: 'supervisor@shac.pe',
    password: 'Shac2025!',
    rol: 'SUPERVISOR',
    area: 'Operaciones',
    avatarUrl: undefined,
  },
  {
    id: 'user-jefecalidad-001',
    nombre: 'Juan',
    apellido: 'Mendoza',
    email: 'jefe.calidad@shac.pe',
    password: 'Shac2025!',
    rol: 'JEFE_CALIDAD_SYST',
    area: 'Calidad y SyST',
    avatarUrl: undefined,
  },
  {
    id: 'user-jefedocs-001',
    nombre: 'Sofía',
    apellido: 'Vargas',
    email: 'jefe.docs@shac.pe',
    password: 'Shac2025!',
    rol: 'JEFE_CONTROL_DOCUMENTARIO',
    area: 'Control Documentario',
    avatarUrl: undefined,
  },
  {
    id: 'user-auditor-001',
    nombre: 'Miguel',
    apellido: 'Flores',
    email: 'auditor@shac.pe',
    password: 'Shac2025!',
    rol: 'AUDITOR_INTERNO',
    area: 'Auditoría',
    avatarUrl: undefined,
  },
  {
    id: 'user-gerencia-001',
    nombre: 'Patricia',
    apellido: 'Huanca',
    email: 'gerencia@shac.pe',
    password: 'Shac2025!',
    rol: 'ALTA_DIRECCION',
    area: 'Gerencia General',
    avatarUrl: undefined,
  },
]
