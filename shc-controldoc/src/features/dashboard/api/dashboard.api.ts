import api from '../../../lib/axios'
import type { KpiResult } from '../types/kpi.types'
import type { DashboardSummaryData } from '../types/dashboardData.types'

export async function getDashboardKpis(periodo?: string): Promise<KpiResult[]> {
  const params: Record<string, unknown> = {}
  if (periodo) params.periodo = periodo
  const response = await api.get<KpiResult[]>('/api/dashboard/kpis', { params })
  return response.data
}

export async function getDashboardSummary(): Promise<DashboardSummaryData> {
  const response = await api.get<DashboardSummaryData>('/api/dashboard/summary')
  return response.data
}
