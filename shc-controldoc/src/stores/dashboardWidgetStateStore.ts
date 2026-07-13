import { create } from 'zustand'

export type HeatmapRango = 3 | 6 | 12

interface DashboardWidgetStateStore {
  heatmapRango: HeatmapRango
  setHeatmapRango(rango: HeatmapRango): void
}

/**
 * Publica el rango (3/6/12 meses) actualmente seleccionado en HeatmapIncidentesWidget
 * para que ExportButton pueda reflejarlo en la tabla exportada sin acoplarse al estado
 * interno del widget. El valor por defecto coincide con el default propio del widget,
 * por lo que no requiere sincronización adicional si el usuario nunca interactúa con él.
 */
export const useDashboardWidgetStateStore = create<DashboardWidgetStateStore>((set) => ({
  heatmapRango: 6,
  setHeatmapRango: (rango) => set({ heatmapRango: rango }),
}))
