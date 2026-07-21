import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types/auth.types'

interface RoleGuardProps {
  requiredRoles?: UserRole[]
}

export function RoleGuard({ requiredRoles }: RoleGuardProps) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRoles && user && !requiredRoles.includes(user.rol)) {
    return <Navigate to="/no-autorizado" replace />
  }

  return <Outlet />
}
