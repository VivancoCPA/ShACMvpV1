import type { Documento } from '../../../types/documents.types'

export interface DatosPublicacion {
  firmadoPorId: string
  fecha: string
  hash?: string
}

/**
 * resumen-info-publicacion: resuelve quién firmó/publicó un documento, cuándo, y con qué hash —
 * fuente única usada tanto por la tarjeta "Documento publicado" de la pestaña Resumen como por la
 * ficha de la sidebar (antes cada una tenía su propia versión parcial de esta lógica).
 *
 * Orden de resolución (el primero que aplique gana):
 * 1. La entrada `FIRMA_REGISTRADA` más reciente del audit trail (hash = su `valorNuevo`).
 * 2. La entrada `ESTADO_CAMBIADO` más reciente con `estadoNuevo === 'PUBLICADO'` (sin hash) —
 *    documentos publicados antes de que se registrara la firma con hash.
 * 3. `aprobadorId` + `fechaEmision`, solo si ambos están presentes (sin hash) — último recurso
 *    para datos legacy sin ninguna de las dos entradas anteriores.
 * 4. `undefined` si nada de lo anterior aplica.
 */
export function getDatosPublicacion(documento: Documento): DatosPublicacion | undefined {
  const porFecha = [...documento.auditTrail].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const firma = porFecha.find((e) => e.accion === 'FIRMA_REGISTRADA')
  if (firma) {
    return { firmadoPorId: firma.realizadoPorId, fecha: firma.timestamp, hash: firma.valorNuevo }
  }

  const publicacion = porFecha.find((e) => e.accion === 'ESTADO_CAMBIADO' && e.estadoNuevo === 'PUBLICADO')
  if (publicacion) {
    return { firmadoPorId: publicacion.realizadoPorId, fecha: publicacion.timestamp }
  }

  if (documento.aprobadorId && documento.fechaEmision) {
    return { firmadoPorId: documento.aprobadorId, fecha: documento.fechaEmision }
  }

  return undefined
}
