import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../stores/authStore'
import { useZonas } from '../hooks/useLocales'
import { puedeAdministrarLocales } from '../permissions/localesPermissions'
import { LocalesAdminPage } from './LocalesAdminPage'
import { ZonaFormModal } from '../components/ZonaFormModal'

export function ZonaFormPage() {
  const { localId, zonaId } = useParams<{ localId: string; zonaId?: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: zonas } = useZonas()
  const zona = zonaId ? zonas?.find((z) => z.id === zonaId) : undefined

  const permissions = user ? puedeAdministrarLocales(user) : null

  useEffect(() => {
    if (permissions === false) {
      navigate('/admin/locales', { replace: true })
    }
  }, [permissions, navigate])

  if (!permissions || !localId) return null

  return (
    <>
      <LocalesAdminPage />
      <ZonaFormModal localId={localId} zona={zona} mode={zonaId ? 'edit' : 'create'} />
    </>
  )
}
