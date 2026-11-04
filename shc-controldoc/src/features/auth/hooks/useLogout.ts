import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { endSession } from '../../../lib/sessionEnd'

/** Cierre de sesión manual — mismo camino único que el cierre por inactividad (sesion-timeout-
 *  inactividad design.md D11): logout en el backend, store, caché de TanStack Query y aviso a las
 *  demás pestañas. */
export function useLogout() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => endSession(null),
    onSettled: () => {
      navigate('/login')
    },
  })
}
