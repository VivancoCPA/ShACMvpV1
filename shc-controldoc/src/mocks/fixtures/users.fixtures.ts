import type { User } from '../../types/auth.types'

export const userFixtures: User[] = [
  {
    id: 'user-001',
    nombre: 'Ricardo',
    apellido: 'Flores',
    email: 'ricardo.flores@shac.internal',
    rol: 'ALTA_DIRECCION',
    area: 'Gerencia',
  },
  {
    id: 'user-002',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    email: 'carlos.mendoza@shac.internal',
    rol: 'OPERARIO',
    area: 'Almacén Norte',
  },
  {
    id: 'user-003',
    nombre: 'María',
    apellido: 'Castro',
    email: 'maria.castro@shac.internal',
    rol: 'SUPERVISOR',
    area: 'Operaciones',
  },
  {
    id: 'user-004',
    nombre: 'Ana',
    apellido: 'Torres',
    email: 'ana.torres@shac.internal',
    rol: 'AUDITOR_INTERNO',
    area: 'Auditoría',
  },
  {
    id: 'user-005',
    nombre: 'Luis',
    apellido: 'Paredes',
    email: 'luis.paredes@shac.internal',
    rol: 'JEFE_CALIDAD_SYST',
    area: 'Calidad',
  },
  {
    id: 'user-008',
    nombre: 'Roberto',
    apellido: 'Silva',
    email: 'roberto.silva@shac.internal',
    rol: 'JEFE_CONTROL_DOCUMENTARIO',
    area: 'Control Documentario',
  },
  {
    // Matches the id issued by /api/auth/login for auditor@shac.pe (see
    // auth.fixtures.ts) — without this entry, the only loginable
    // AUDITOR_INTERNO account can never appear in the /api/users
    // auditor-assignment picker, so no real session could ever satisfy
    // `user.id === qe.auditorAsignadoId` (M5-S10).
    id: 'user-auditor-001',
    nombre: 'Miguel',
    apellido: 'Flores',
    email: 'auditor@shac.pe',
    rol: 'AUDITOR_INTERNO',
    area: 'Auditoría',
  },
]

export const USER_NOMBRE_MAP: Record<string, string> = {
  'user-001': 'Ricardo Flores',
  'user-002': 'Carlos Mendoza',
  'user-003': 'María Castro',
  'user-004': 'Ana Torres',
  'user-005': 'Luis Paredes',
  'user-006': 'Pedro Quispe',
  'user-007': 'Jorge Ramos',
  'user-008': 'Roberto Silva',
  'user-009': 'Rosa Villanueva',
  'user-auditor-001': 'Miguel Flores',
}
