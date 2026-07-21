import type { Area } from '../../features/areas/types/area.types'

// Migrado 1:1 desde AREAS_SHAC (src/constants/shared.constants.ts, ahora eliminado) —
// mismo orden, mismos 19 valores, sin renombrar ni agregar áreas nuevas.
export const areaFixtures: Area[] = [
  { id: 'area-001', nombre: 'Almacén Norte', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-002', nombre: 'Almacén Sur', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-003', nombre: 'Área de Carga', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-004', nombre: 'Área de Contenedores', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-005', nombre: 'Archivo Documentario', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-006', nombre: 'Auditoría', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-007', nombre: 'Calidad', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-008', nombre: 'Control de Calidad', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-009', nombre: 'Control Documentario', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-010', nombre: 'Galpón B', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-011', nombre: 'Galpón C', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-012', nombre: 'Gerencia', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-013', nombre: 'Laboratorio de Calidad', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-014', nombre: 'Laboratorio de Muestras', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-015', nombre: 'Logística', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-016', nombre: 'Operaciones', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-017', nombre: 'Operaciones Aduaneras', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-018', nombre: 'RR.HH.', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-019', nombre: 'SyST', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
]
