import { AREAS_SHAC } from '../../constants/shared.constants'

export interface HorasTrabajadasEntry {
  area: string
  periodo: string
  horas: number
}

// Alineado con el rango de fechas usado en incidents.fixtures.ts (2026-01 a 2026-05+).
const PERIODOS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'] as const

function horasParaAreaYMes(areaIndex: number, mesIndex: number): number {
  const base = 800 + (areaIndex * 173) % 3200
  const variacion = (mesIndex * 97) % 400
  return base + variacion
}

export const horasTrabajadasFixtures: HorasTrabajadasEntry[] = AREAS_SHAC.flatMap((area, areaIndex) =>
  PERIODOS.map((periodo, mesIndex) => ({
    area,
    periodo,
    horas: horasParaAreaYMes(areaIndex, mesIndex),
  })),
)
