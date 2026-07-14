import type { UserRole } from '../../types/auth.types'

export interface MockUser {
  id: string
  nombre: string
  apellido: string
  email: string
  password: string
  rol: UserRole
  area?: string
  areasAsignadas?: string[]
  avatarUrl: undefined
  createdAt: string
  lastLogin?: string
  activo: boolean
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
    activo: true,
    createdAt: '2024-11-04T09:15:00.000Z',
  },
  {
    id: 'user-supervisor-001',
    nombre: 'Carmen',
    apellido: 'Torres',
    email: 'supervisor@shac.pe',
    password: 'Shac2025!',
    rol: 'SUPERVISOR',
    area: 'Operaciones',
    areasAsignadas: ['Galpón B', 'Galpón C'],
    avatarUrl: undefined,
    activo: true,
    createdAt: '2024-08-12T14:30:00.000Z',
  },
  {
    id: 'user-supervisor-002',
    nombre: 'Diego',
    apellido: 'Salazar',
    email: 'supervisor.almacen@shac.pe',
    password: 'Shac2025!',
    rol: 'SUPERVISOR',
    area: 'Almacén Norte',
    areasAsignadas: ['Almacén Norte', 'Almacén Sur'],
    avatarUrl: undefined,
    activo: true,
    createdAt: '2025-01-20T11:00:00.000Z',
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
    activo: true,
    createdAt: '2023-06-15T08:45:00.000Z',
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
    activo: true,
    createdAt: '2024-03-02T10:20:00.000Z',
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
    activo: true,
    createdAt: '2024-09-28T16:00:00.000Z',
  },
  {
    // Matches documents.fixtures.ts AUTOR_ID — lets a real session satisfy
    // `documento.autorId === user.id` (AUTOR docRole in permissions.ts /
    // DocumentEditGuard), which was previously unreachable behind a phantom UUID.
    id: 'user-autor-001',
    nombre: 'Carlos',
    apellido: 'Autor',
    email: 'autor@shac.pe',
    password: 'Shac2025!',
    rol: 'SUPERVISOR',
    area: 'Calidad',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2025-02-10T13:10:00.000Z',
  },
  {
    // RN-QE-013 (edit own report) / responsable AC ajuste de plazo — user-004 is
    // heavily reused as reportadoPorId/responsableId across QE and AC fixtures;
    // giving it real login credentials lets those flows be tested end-to-end
    // as the actual reporter/responsible instead of only via manual store mutation.
    id: 'user-004',
    nombre: 'Ana',
    apellido: 'Torres',
    email: 'ana.torres@shac.pe',
    password: 'Shac2025!',
    rol: 'AUDITOR_INTERNO',
    area: 'Auditoría',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2023-11-22T09:00:00.000Z',
  },
  {
    // Same rationale as user-004 above — second most reused id in the QE/AC pool.
    id: 'user-005',
    nombre: 'Luis',
    apellido: 'Paredes',
    email: 'luis.paredes@shac.pe',
    password: 'Shac2025!',
    rol: 'JEFE_CALIDAD_SYST',
    area: 'Calidad',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2024-05-30T15:40:00.000Z',
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
    activo: true,
    createdAt: '2022-10-01T12:00:00.000Z',
  },
  {
    id: 'user-admin-001',
    nombre: 'Rodrigo',
    apellido: 'Castillo',
    email: 'admin@shac.pe',
    password: 'Shac2025!',
    rol: 'ADMINISTRADOR_SISTEMA',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2022-01-15T08:00:00.000Z',
  },
]

// Store mutable compartido entre auth.handlers.ts (login) y users.handlers.ts
// (CRUD de administración) — misma referencia de array, nunca una copia, para
// que una baja hecha desde /usuarios bloquee el login sin recargar el mock.
export function getUsersStore(): MockUser[] {
  return authFixtures
}
