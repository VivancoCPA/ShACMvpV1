import type { Empresa, UsuarioEmpresa } from '../../features/empresas/types/empresa.types'
import type { UserRole } from '../../types/auth.types'

export const empresaFixtures: Empresa[] = [
  {
    id: 'empresa-001',
    razonSocial: 'Minera Andina del Sur S.A.C.',
    ruc: '20512345678',
    estado: 'ACTIVA',
    logoUrl: '/mock/empresas/empresa-001-logo.png',
    fechaAlta: '2022-01-01T00:00:00Z',
  },
  {
    id: 'empresa-002',
    razonSocial: 'Terminal Portuario Ilo S.A.C.',
    ruc: '20598765432',
    estado: 'ACTIVA',
    logoUrl: '/mock/empresas/empresa-002-logo.png',
    fechaAlta: '2026-01-01T00:00:00Z',
  },
]

export const usuarioEmpresaFixtures: UsuarioEmpresa[] = [
  // empresa-001 — Minera Andina del Sur S.A.C. (usuarios existentes)
  { usuarioId: 'user-operario-001', empresaId: 'empresa-001', rol: 'OPERARIO', estado: 'ACTIVO', fechaAsignacion: '2024-11-04T09:15:00.000Z' },
  { usuarioId: 'user-supervisor-001', empresaId: 'empresa-001', rol: 'SUPERVISOR', estado: 'ACTIVO', fechaAsignacion: '2024-08-12T14:30:00.000Z' },
  { usuarioId: 'user-supervisor-002', empresaId: 'empresa-001', rol: 'SUPERVISOR', estado: 'ACTIVO', fechaAsignacion: '2025-01-20T11:00:00.000Z' },
  { usuarioId: 'user-jefecalidad-001', empresaId: 'empresa-001', rol: 'JEFE_CALIDAD_SYST', estado: 'ACTIVO', fechaAsignacion: '2023-06-15T08:45:00.000Z' },
  { usuarioId: 'user-jefedocs-001', empresaId: 'empresa-001', rol: 'JEFE_CONTROL_DOCUMENTARIO', estado: 'ACTIVO', fechaAsignacion: '2024-03-02T10:20:00.000Z' },
  { usuarioId: 'user-auditor-001', empresaId: 'empresa-001', rol: 'AUDITOR_INTERNO', estado: 'ACTIVO', fechaAsignacion: '2024-09-28T16:00:00.000Z' },
  { usuarioId: 'user-autor-001', empresaId: 'empresa-001', rol: 'SUPERVISOR', estado: 'ACTIVO', fechaAsignacion: '2025-02-10T13:10:00.000Z' },
  { usuarioId: 'user-004', empresaId: 'empresa-001', rol: 'AUDITOR_INTERNO', estado: 'ACTIVO', fechaAsignacion: '2023-11-22T09:00:00.000Z' },
  { usuarioId: 'user-005', empresaId: 'empresa-001', rol: 'JEFE_CALIDAD_SYST', estado: 'ACTIVO', fechaAsignacion: '2024-05-30T15:40:00.000Z' },
  { usuarioId: 'user-gerencia-001', empresaId: 'empresa-001', rol: 'ALTA_DIRECCION', estado: 'ACTIVO', fechaAsignacion: '2022-10-01T12:00:00.000Z' },
  { usuarioId: 'user-admin-001', empresaId: 'empresa-001', rol: 'ADMINISTRADOR_SISTEMA', estado: 'ACTIVO', fechaAsignacion: '2022-01-15T08:00:00.000Z' },

  // empresa-002 — Terminal Portuario Ilo S.A.C. (usuarios nuevos)
  { usuarioId: 'user-operario-101', empresaId: 'empresa-002', rol: 'OPERARIO', estado: 'ACTIVO', fechaAsignacion: '2026-01-01T00:00:00.000Z' },
  { usuarioId: 'user-supervisor-101', empresaId: 'empresa-002', rol: 'SUPERVISOR', estado: 'ACTIVO', fechaAsignacion: '2026-01-01T00:00:00.000Z' },
  { usuarioId: 'user-jefecalidad-101', empresaId: 'empresa-002', rol: 'JEFE_CALIDAD_SYST', estado: 'ACTIVO', fechaAsignacion: '2026-01-01T00:00:00.000Z' },
  { usuarioId: 'user-jefedocs-101', empresaId: 'empresa-002', rol: 'JEFE_CONTROL_DOCUMENTARIO', estado: 'ACTIVO', fechaAsignacion: '2026-01-01T00:00:00.000Z' },

  // Usuario con doble asignación (verificación multiempresa, RN-EMP-002): mismo usuario,
  // rol distinto en cada empresa. En empresa-001 sigue siendo SUPERVISOR (fila de arriba).
  { usuarioId: 'user-supervisor-001', empresaId: 'empresa-002', rol: 'JEFE_CALIDAD_SYST', estado: 'ACTIVO', fechaAsignacion: '2026-07-01T00:00:00.000Z' },

  // me-f4-admin-empresas — ADMINISTRADOR_EMPRESA de verificación, uno por empresa.
  // user-superadmin-001 deliberadamente NO tiene fila aquí (ver auth.fixtures.ts).
  { usuarioId: 'user-adminempresa-001', empresaId: 'empresa-001', rol: 'ADMINISTRADOR_EMPRESA', estado: 'ACTIVO', fechaAsignacion: '2026-07-01T00:00:00.000Z' },
  { usuarioId: 'user-adminempresa-101', empresaId: 'empresa-002', rol: 'ADMINISTRADOR_EMPRESA', estado: 'ACTIVO', fechaAsignacion: '2026-07-01T00:00:00.000Z' },
]

// Stores mutables — misma referencia de array siempre, nunca una copia (mismo
// patrón que `getUsersStore()` en auth.fixtures.ts). `empresas.handlers.ts`
// (CRUD de administración) y esta función leen/escriben la misma referencia,
// así una asignación o desactivación reciente es visible en el siguiente
// login/refresh/switch-empresa sin reiniciar MSW.
export function getEmpresasStore(): Empresa[] {
  return empresaFixtures
}

export function getUsuarioEmpresaStore(): UsuarioEmpresa[] {
  return usuarioEmpresaFixtures
}

/**
 * Empresas con asignación ACTIVA para un usuario, en el orden en que existen
 * sus filas `UsuarioEmpresa` — usado por los handlers de auth para resolver
 * la empresa activa en login/refresh/switch-empresa (me-f2-sesion-rbac-login).
 */
export function getEmpresasActivasForUsuario(usuarioId: string): Empresa[] {
  const empresaIds = getUsuarioEmpresaStore()
    .filter((ue) => ue.usuarioId === usuarioId && ue.estado === 'ACTIVO')
    .map((ue) => ue.empresaId)
  return getEmpresasStore().filter((e) => empresaIds.includes(e.id))
}

/** Rol efectivo de `usuarioId` en `empresaId`, o `undefined` si no tiene una asignación ACTIVA ahí. */
export function getRolEfectivo(usuarioId: string, empresaId: string): UserRole | undefined {
  return getUsuarioEmpresaStore().find(
    (ue) => ue.usuarioId === usuarioId && ue.empresaId === empresaId && ue.estado === 'ACTIVO',
  )?.rol
}
