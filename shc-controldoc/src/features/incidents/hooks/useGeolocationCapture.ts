import { useState } from 'react'
import type { IncidenteGeoUbicacion } from '../types/incident.types'

type GeolocationStatus = 'idle' | 'capturing' | 'success' | 'denied' | 'unsupported' | 'error'

/**
 * Captura GPS no bloqueante (M7-F1): un rechazo de permiso, error o falta de
 * soporte nunca impide continuar con el formulario — solo deja `geoUbicacion`
 * en `undefined`.
 */
export function useGeolocationCapture() {
  const [status, setStatus] = useState<GeolocationStatus>('idle')
  const [geoUbicacion, setGeoUbicacion] = useState<IncidenteGeoUbicacion | undefined>(undefined)

  const capture = () => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }

    setStatus('capturing')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoUbicacion({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          capturadoEn: new Date().toISOString(),
        })
        setStatus('success')
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error')
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return { status, geoUbicacion, capture }
}
