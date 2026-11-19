import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useOrigenAccionCorrectiva } from '../hooks/useAccionesCorrectivasListado'
import { rutaOrigenAC } from '../utils/filtrosUrl'

// Enlaces viejos /acciones-correctivas/:id (notificaciones guardadas antes de este módulo): resuelve
// el origen de la AC y redirige con replace a su detalle (modulo-acciones-correctivas D9).
export function AccionCorrectivaOrigenRedirect() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation('accionesCorrectivas')
  const { data, isError } = useOrigenAccionCorrectiva(id)

  // Efecto (no derivación de estado): avisar una sola vez que el enlace ya no resuelve.
  useEffect(() => {
    if (isError) toast.error(t('errors.origenNoEncontrado'), { id: `ac-origen-${id ?? ''}` })
  }, [isError, id, t])

  if (data) return <Navigate to={rutaOrigenAC(data.origenTipo, data.origenId)} replace />
  if (isError) return <Navigate to="/acciones-correctivas" replace />
  return (
    <p role="status" className="p-6 text-sm text-muted dark:text-on-dark-soft">
      {t('redirigiendo')}
    </p>
  )
}
