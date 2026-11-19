import { isAxiosError } from 'axios'

/**
 * nc-turno-todos-y-errores-400 — ante un 400 del servidor (datos inválidos: enum desconocido,
 * JSON mal formado, validación), devuelve el `message` de `ApiResponse.Fail`, que ya nombra el
 * campo que falló. Para cualquier otro error (sin respuesta, 5xx, sin `message`) devuelve el
 * `fallback` localizado, para no mostrar textos técnicos al usuario.
 */
export function getServerErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error) || error.response?.status !== 400) return fallback
  const data: unknown = error.response.data
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const { message } = data as { message: unknown }
    if (typeof message === 'string' && message.trim().length > 0) return message
  }
  return fallback
}
