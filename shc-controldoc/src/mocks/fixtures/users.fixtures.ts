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
  {
    // Matches documents.fixtures.ts AUTOR_ID and the auth.fixtures.ts login for
    // autor@shac.pe — lets a real session appear as the AUTOR of documents.
    id: 'user-autor-001',
    nombre: 'Carlos',
    apellido: 'Autor',
    email: 'autor@shac.pe',
    rol: 'SUPERVISOR',
    area: 'Calidad',
  },
]

export const USER_NOMBRE_MAP: Record<string, string> = {
  'user-001': 'Ricardo Flores',
  'user-002': 'Carlos Mendoza',
  'user-003': 'María Castro',
  'user-004': 'Ana Torres',
  'user-005': 'Luis Paredes',
  'user-008': 'Roberto Silva',
  'user-auditor-001': 'Miguel Flores',
  'user-autor-001': 'Carlos Autor',
}
