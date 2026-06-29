import type { Local, Zona } from '../../features/incidents/types/incident.types'

export const localFixtures: Local[] = [
  {
    id: 'loc-001',
    nombre: 'Almacén Principal',
    codigo: 'LOC-001',
    activo: true,
    planoPngUrl: '/mock/plano-placeholder.png',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-002',
    nombre: 'Patio de Minerales',
    codigo: 'LOC-002',
    activo: true,
    planoPngUrl: '/mock/plano-placeholder.png',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-003',
    nombre: 'Bodega Norte',
    codigo: 'LOC-003',
    activo: false,
    planoPngUrl: undefined,
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
]

export const zonaFixtures: Zona[] = [
  // LOC-001 — Almacén Principal (3 zonas)
  { id: 'zon-001', localId: 'loc-001', nombre: 'Zona de Recepción', codigo: 'ZON-001', activo: true, creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  { id: 'zon-002', localId: 'loc-001', nombre: 'Zona de Almacenamiento', codigo: 'ZON-002', activo: true, creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  { id: 'zon-003', localId: 'loc-001', nombre: 'Zona de Despacho', codigo: 'ZON-003', activo: true, creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  // LOC-002 — Patio de Minerales (2 zonas)
  { id: 'zon-004', localId: 'loc-002', nombre: 'Área de Acopio Norte', codigo: 'ZON-004', activo: true, creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
  { id: 'zon-005', localId: 'loc-002', nombre: 'Zona de Pesaje', codigo: 'ZON-005', activo: true, creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z' },
]
