import type { UserRole } from '../../types/auth.types'

export interface MockUser {
  id: string
  nombre: string
  apellido: string
  email: string
  password: string
  rol: UserRole
  areaId?: string
  areaIds?: string[]
  avatarUrl: undefined
  createdAt: string
  lastLogin?: string
  activo: boolean
  esSuperadminMultiempresa?: boolean
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
    areaId: 'area-016',
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
    areaId: 'area-016',
    areaIds: ['area-010', 'area-011'],
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
    areaId: 'area-001',
    areaIds: ['area-001', 'area-002'],
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
    areaId: 'area-007',
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
    areaId: 'area-009',
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
    areaId: 'area-006',
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
    areaId: 'area-007',
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
    areaId: 'area-006',
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
    areaId: 'area-007',
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
    areaId: 'area-012',
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
  {
    // empresa-002 (Terminal Portuario Ilo S.A.C.) — usuario nuevo, ver empresa-msw-fixtures
    id: 'user-operario-101',
    nombre: 'Jorge',
    apellido: 'Aliaga',
    email: 'operario@ilo.pe',
    password: 'Shac2025!',
    rol: 'OPERARIO',
    areaId: 'area-016',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    // empresa-002 (Terminal Portuario Ilo S.A.C.) — usuario nuevo, ver empresa-msw-fixtures
    id: 'user-supervisor-101',
    nombre: 'Rosa',
    apellido: 'Chávez',
    email: 'supervisor@ilo.pe',
    password: 'Shac2025!',
    rol: 'SUPERVISOR',
    areaId: 'area-001',
    areaIds: ['area-001'],
    avatarUrl: undefined,
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    // empresa-002 (Terminal Portuario Ilo S.A.C.) — usuario nuevo, ver empresa-msw-fixtures
    id: 'user-jefecalidad-101',
    nombre: 'Fernando',
    apellido: 'Rojas',
    email: 'jefe.calidad@ilo.pe',
    password: 'Shac2025!',
    rol: 'JEFE_CALIDAD_SYST',
    areaId: 'area-007',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    // empresa-002 (Terminal Portuario Ilo S.A.C.) — usuario nuevo, ver empresa-msw-fixtures
    id: 'user-jefedocs-101',
    nombre: 'Karina',
    apellido: 'Ponce',
    email: 'jefe.docs@ilo.pe',
    password: 'Shac2025!',
    rol: 'JEFE_CONTROL_DOCUMENTARIO',
    areaId: 'area-009',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    // me-f4-admin-empresas — Superadmin de verificación. Deliberadamente SIN
    // ninguna fila UsuarioEmpresa (ver empresas.fixtures.ts): prueba el caso
    // "cero asignaciones" del proposal — el flag basta para resolver sesión.
    id: 'user-superadmin-001',
    nombre: 'Valeria',
    apellido: 'Ríos',
    email: 'superadmin@shac.pe',
    password: 'Shac2025!',
    rol: 'SUPERADMIN',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    esSuperadminMultiempresa: true,
  },
  {
    // me-f4-admin-empresas — ADMINISTRADOR_EMPRESA de verificación de empresa-001.
    id: 'user-adminempresa-001',
    nombre: 'Renzo',
    apellido: 'Delgado',
    email: 'admin.empresa@shac.pe',
    password: 'Shac2025!',
    rol: 'ADMINISTRADOR_EMPRESA',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    // me-f4-admin-empresas — ADMINISTRADOR_EMPRESA de verificación de empresa-002.
    id: 'user-adminempresa-101',
    nombre: 'Gabriela',
    apellido: 'Núñez',
    email: 'admin.empresa@ilo.pe',
    password: 'Shac2025!',
    rol: 'ADMINISTRADOR_EMPRESA',
    avatarUrl: undefined,
    activo: true,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
]

// Store mutable compartido entre auth.handlers.ts (login) y users.handlers.ts
// (CRUD de administración) — misma referencia de array, nunca una copia, para
// que una baja hecha desde /usuarios bloquee el login sin recargar el mock.
export function getUsersStore(): MockUser[] {
  return authFixtures
}
