import { useAuthStore } from '../../../stores/authStore'
import { getDashboardDataTypeForRole } from '../utils/dashboardRoleMapping'
import { ComingSoon } from '../../../router/ComingSoonPages'
import { OperarioDashboard } from './OperarioDashboard'
import { SupervisorDashboard } from './SupervisorDashboard'
import { JefeCalidadDashboard } from './JefeCalidadDashboard'
import { AltaDireccionDashboard } from './AltaDireccionDashboard'
import { AuditorDashboard } from './AuditorDashboard'
import { JefeControlDocumentarioDashboard } from './JefeControlDocumentarioDashboard'

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

  if (dashboardType === 'ALTA_DIRECCION') {
    return <AltaDireccionDashboard />
  }

  if (dashboardType === 'AUDITOR') {
    return <AuditorDashboard />
  }

  if (dashboardType === 'JEFE_CONTROL_DOC') {
    return <JefeControlDocumentarioDashboard />
  }

  return <ComingSoon label="Dashboard" />
}
