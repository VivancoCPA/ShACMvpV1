import { AREAS_SHAC } from '../../constants/shared.constants'

export interface HorasTrabajadasEntry {
  area: string
  periodo: string
  horas: number
}

// Cobertura de 12 meses hacia atrás desde el mes actual del sistema (2026-07), necesaria
// para la tendencia mensual de KPI-04 en JefeCalidadDashboard (rango de hasta 12 meses).
const PERIODOS = [
  '2025-08',
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
] as const

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
