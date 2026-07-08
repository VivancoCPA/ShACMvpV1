import { useAuthStore } from '../../../stores/authStore'
import { getDashboardDataTypeForRole } from '../utils/dashboardRoleMapping'
import { ComingSoon } from '../../../router/ComingSoonPages'
import { OperarioDashboard } from './OperarioDashboard'
import { SupervisorDashboard } from './SupervisorDashboard'
import { JefeCalidadDashboard } from './JefeCalidadDashboard'

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const dashboardType = user ? getDashboardDataTypeForRole(user.rol) : undefined

  if (dashboardType === 'OPERARIO') {
    return <OperarioDashboard />
  }

  if (dashboardType === 'SUPERVISOR') {
    return <SupervisorDashboard />
  }

  if (dashboardType === 'JEFE_CALIDAD') {
    return <JefeCalidadDashboard />
  }

  return <ComingSoon label="Dashboard" />
}
