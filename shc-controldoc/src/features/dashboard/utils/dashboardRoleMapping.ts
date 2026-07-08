import type { UserRole } from '../../../types/auth.types'
import type { DashboardSummaryData } from '../types/dashboardData.types'

type DashboardRol = DashboardSummaryData['rol']

const ROLE_TO_DASHBOARD_TYPE: Partial<Record<UserRole, DashboardRol>> = {
  OPERARIO: 'OPERARIO',
  SUPERVISOR: 'SUPERVISOR',
  JEFE_CALIDAD_SYST: 'JEFE_CALIDAD',
  JEFE_CONTROL_DOCUMENTARIO: 'JEFE_CALIDAD',
  ALTA_DIRECCION: 'ALTA_DIRECCION',
  AUDITOR_INTERNO: 'AUDITOR',
}

export function getDashboardDataTypeForRole(rol: UserRole): DashboardRol | undefined {
  return ROLE_TO_DASHBOARD_TYPE[rol]
}
