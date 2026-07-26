import type { Local, Zona } from '../../features/incidents/types/incident.types'

export const localFixtures: Local[] = [
  {
    id: 'loc-001',
    nombre: 'Almacén Principal',
    codigo: 'LOC-001',
    activo: true,
    empresaId: 'empresa-001',
    planoPngUrl: '/mock/plano-placeholder.png',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-002',
    nombre: 'Patio de Minerales',
    codigo: 'LOC-002',
    activo: true,
    empresaId: 'empresa-001',
    planoPngUrl: '/mock/plano-placeholder.png',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-003',
    nombre: 'Bodega Norte',
    codigo: 'LOC-003',
    activo: false,
    empresaId: 'empresa-001',
    planoPngUrl: undefined,
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
  {
    // Sembrado inactivo deliberadamente para no alterar el conteo de locales activos
    // (RN-LOC-001, límite global de 5) del que depende la suite existente de
    // locales.handlers.test.ts — ver incident-locales spec (me-f1-modelo-datos).
    id: 'loc-e2-001',
    nombre: 'Terminal de Almacenamiento Ilo',
    codigo: 'LOC-E2-001',
    activo: false,
    empresaId: 'empresa-002',
    planoPngUrl: '/mock/plano-placeholder.png',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
]

export const zonaFixtures: Zona[] = [
  // LOC-001 — Almacén Principal (3 zonas)
  { id: 'zon-001', localId: 'loc-001', nombre: 'Zona de Recepción', codigo: 'ZON-001', activo: true, empresaId: 'empresa-001', creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  { id: 'zon-002', localId: 'loc-001', nombre: 'Zona de Almacenamiento', codigo: 'ZON-002', activo: true, empresaId: 'empresa-001', creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  { id: 'zon-003', localId: 'loc-001', nombre: 'Zona de Despacho', codigo: 'ZON-003', activo: true, empresaId: 'empresa-001', creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  // LOC-002 — Patio de Minerales (2 zonas)
  { id: 'zon-004', localId: 'loc-002', nombre: 'Área de Acopio Norte', codigo: 'ZON-004', activo: true, empresaId: 'empresa-001', creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  { id: 'zon-005', localId: 'loc-002', nombre: 'Zona de Pesaje', codigo: 'ZON-005', activo: true, empresaId: 'empresa-001', creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  // loc-e2-001 — Terminal de Almacenamiento Ilo (2 zonas)
  { id: 'zon-e2-001', localId: 'loc-e2-001', nombre: 'Zona de Recepción Portuaria', codigo: 'ZON-E2-001', activo: true, empresaId: 'empresa-002', creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  { id: 'zon-e2-002', localId: 'loc-e2-001', nombre: 'Zona de Almacenamiento Ilo', codigo: 'ZON-E2-002', activo: true, empresaId: 'empresa-002', creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
]
