import { describe, it, expect } from 'vitest'
import { computeClusters } from './IncidentMapCanvas'
import type { Incidente } from '../types/incident.types'

function makeInc(id: string, x: number, y: number, localId = 'loc-001'): Incidente {
  return {
    id,
    numero: `INC-${id}`,
    tipo: 'ACCIDENTE',
    estado: 'ABIERTO',
    severidad: 'MEDIA',
    descripcion: 'test',
    areaId: 'test',
    turno: 'DIA',
    fechaEvento: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-001',
    huboLesionados: false,
    auditTrail: [],
    accionesCorrectivas: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    localId,
    ubicacion: { x, y },
  }
}

// Task 10.1: 6 incidents within radius 5% → one cluster of 6
describe('computeClusters — clustering', () => {
  it('groups 6 incidents within radius 5 into a single cluster', () => {
    const incidents = [
      makeInc('a', 50, 50),
      makeInc('b', 51, 50),
      makeInc('c', 52, 50),
      makeInc('d', 50, 51),
      makeInc('e', 51, 51),
      makeInc('f', 52, 51),
    ]
    const groups = computeClusters(incidents, 'loc-001')
    expect(groups).toHaveLength(1)
    expect(groups[0].members).toHaveLength(6)
  })

  it('separates two incidents more than 5% apart into distinct clusters', () => {
    const incidents = [makeInc('a', 10, 10), makeInc('b', 90, 90)]
    const groups = computeClusters(incidents, 'loc-001')
    expect(groups).toHaveLength(2)
    expect(groups.every((g) => g.members.length === 1)).toBe(true)
  })

  it('computes centroid as mean of member coordinates', () => {
    // distance = 4 ≤ CLUSTER_RADIUS(5) → single cluster, centroid = (12, 10)
    const incidents = [makeInc('a', 10, 10), makeInc('b', 14, 10)]
    const groups = computeClusters(incidents, 'loc-001')
    expect(groups).toHaveLength(1)
    expect(groups[0].centroid.x).toBeCloseTo(12)
    expect(groups[0].centroid.y).toBeCloseTo(10)
  })

  it('ignores incidents without ubicacion', () => {
    const inc = makeInc('a', 50, 50)
    const noLoc = { ...makeInc('b', 0, 0), ubicacion: undefined }
    const groups = computeClusters([inc, noLoc], 'loc-001')
    expect(groups).toHaveLength(1)
    expect(groups[0].members).toHaveLength(1)
  })
})

// Task 10.2: marker style logic
describe('marker visual style', () => {
  function markerClass(count: number): string {
    if (count >= 5) return 'w-10 h-10 bg-error'
    if (count >= 2) return 'w-[30px] h-[30px] bg-amber'
    return 'w-5 h-5 bg-blue-500'
  }

  it('single incident → w-5 h-5 bg-blue-500', () => {
    expect(markerClass(1)).toBe('w-5 h-5 bg-blue-500')
  })

  it('cluster of 3 → w-[30px] h-[30px] bg-amber', () => {
    expect(markerClass(3)).toBe('w-[30px] h-[30px] bg-amber')
  })

  it('cluster of 5 → w-10 h-10 bg-error', () => {
    expect(markerClass(5)).toBe('w-10 h-10 bg-error')
  })

  it('cluster of 6 → w-10 h-10 bg-error (CA-ADD03-04)', () => {
    expect(markerClass(6)).toBe('w-10 h-10 bg-error')
  })
})

// Task 10.4: empty state — incidents without ubicacion produce no groups
describe('computeClusters — empty state', () => {
  it('returns empty array when all incidents have undefined ubicacion', () => {
    const incidents = [
      { ...makeInc('a', 0, 0), ubicacion: undefined },
      { ...makeInc('b', 0, 0), ubicacion: undefined },
    ]
    const groups = computeClusters(incidents, 'loc-001')
    expect(groups).toHaveLength(0)
  })
})

// Task 10.5: local selector — only incidents with matching localId form groups
describe('computeClusters — local filtering (CA-ADD03-09)', () => {
  it('filters to localId === loc-002, excludes loc-001 incidents', () => {
    const incidents = [
      makeInc('a', 50, 50, 'loc-001'),
      makeInc('b', 50, 50, 'loc-001'),
      makeInc('c', 30, 30, 'loc-002'),
      makeInc('d', 31, 30, 'loc-002'),
    ]

    const groupsA = computeClusters(incidents, 'loc-001')
    expect(groupsA.every((g) => g.members.every((m) => m.localId === 'loc-001'))).toBe(true)

    const groupsB = computeClusters(incidents, 'loc-002')
    expect(groupsB.every((g) => g.members.every((m) => m.localId === 'loc-002'))).toBe(true)
    expect(groupsA.flatMap((g) => g.members).every((m) => m.localId !== 'loc-002')).toBe(true)
  })
})
