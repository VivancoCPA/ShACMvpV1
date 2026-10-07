const FILENAME_STAR_PATTERN = /filename\*\s*=\s*UTF-8''([^;]+)/i
const FILENAME_PATTERN = /filename\s*=\s*"?([^";]+)"?/i

/**
 * Resuelve el nombre de archivo sugerido a partir del header `Content-Disposition`.
 *
 * Prioriza `filename*=UTF-8''...` (RFC 5987, decodificado) sobre `filename=` (con o sin
 * comillas) — RFC 6266 indica que un user-agent moderno debe preferir `filename*` cuando
 * ambos están presentes. Devuelve `fallback` solo si no encuentra ninguno de los dos.
 */
export function getFileNameFromContentDisposition(
  header: string | undefined,
  fallback: string,
): string {
  if (!header) return fallback

  const starMatch = FILENAME_STAR_PATTERN.exec(header)
  if (starMatch?.[1]) {
    try {
      return decodeURIComponent(starMatch[1].trim())
    } catch {
      // Valor mal codificado — cae a filename= o al fallback, nunca lanza.
    }
  }

  const plainMatch = FILENAME_PATTERN.exec(header)
  if (plainMatch?.[1]) return plainMatch[1].trim()

  return fallback
}
