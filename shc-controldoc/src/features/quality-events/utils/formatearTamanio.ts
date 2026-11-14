export function formatearTamanio(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024)
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return mb >= 1 ? `${formatter.format(mb)} MB` : `${formatter.format(bytes / 1024)} KB`
}
