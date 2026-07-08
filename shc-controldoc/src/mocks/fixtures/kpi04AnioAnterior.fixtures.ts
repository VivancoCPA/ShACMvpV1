export interface Kpi04AnioAnteriorEntry {
  /** Periodo del año actual ('YYYY-MM'); el valor representa el índice ya calculado para el mismo periodo del año anterior */
  periodo: string
  valor: number
}

// Mismo rango que incidents.fixtures.ts (2026-01 a 2026-07). Valores precalculados,
// superiores a los del periodo actual, para dejar margen de "reducción" interanual
// verificable en navegador (ver design.md decisión 3).
export const kpi04AnioAnteriorFixtures: Kpi04AnioAnteriorEntry[] = [
  { periodo: '2026-01', valor: 30 },
  { periodo: '2026-02', valor: 28 },
  { periodo: '2026-03', valor: 26 },
  { periodo: '2026-04', valor: 24 },
  { periodo: '2026-05', valor: 22 },
  { periodo: '2026-06', valor: 20 },
  { periodo: '2026-07', valor: 18 },
]
