export function formatShortDate(isoDate: string, locale = 'es-PE'): string {
  const date = new Date(isoDate)
  const parts = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date)

  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  const month = (parts.find((p) => p.type === 'month')?.value ?? '').replace(/\.$/, '')
  const year = parts.find((p) => p.type === 'year')?.value ?? ''

  return `${day} ${month} ${year}`
}

export function formatDateTime(isoDate: string, locale = 'es-PE'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate))
}
