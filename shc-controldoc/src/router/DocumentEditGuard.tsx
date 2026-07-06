import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useDocument } from '../features/documents/hooks/useDocuments'

const GLOBAL_ROLES_ALLOWED = new Set(['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST'])

export function DocumentEditGuard() {
  const { isAuthenticated, user } = useAuthStore()
  const { id } = useParams<{ id: string }>()
  const { data: documento, isLoading } = useDocument(id ?? '')

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return null
  }

  const isGlobalRole = !!user && GLOBAL_ROLES_ALLOWED.has(user.rol)
  const isAuthor = !!user && documento?.autorId === user.id

  if (!isGlobalRole && !isAuthor) {
    return <Navigate to="/no-autorizado" replace />
  }

  return <Outlet />
}
