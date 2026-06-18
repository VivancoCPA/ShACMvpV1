import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types/auth.types'

interface RoleGuardProps {
  requiredRoles?: UserRole[]
}

export function RoleGuard({ requiredRoles }: RoleGuardProps) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRoles && user && !requiredRoles.includes(user.rol)) {
    return <Navigate to="/no-autorizado" replace />
  }

  return <Outlet />
}
