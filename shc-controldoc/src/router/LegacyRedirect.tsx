import { Navigate, useParams } from 'react-router-dom'

interface Props {
  /** Prefijo de la ruta real, p.ej. `/incidents`. */
  to: string
}

// notification-links (incidentes-qe-estado-alertas D9/D11): rutas en español heredadas
// (`/incidentes/:id`, `/no-conformidades/:id`) que llegaron a guardarse en notificaciones o
// enlaces externos. Redirige con replace al detalle real; el RoleGuard del destino decide el acceso.
export function LegacyRedirect({ to }: Props) {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`${to}/${id ?? ''}`} replace />
}
