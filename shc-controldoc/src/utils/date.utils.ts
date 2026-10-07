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

// ── Fechas de calendario (fix-fechas-utc / shared-calendar-date-format) ─────────────────────
//
// Un campo como Documento.fechaVigencia, AccionCorrectiva*.plazoFecha o
// NoConformidad.fechaDeteccion no tiene hora significativa: se captura con
// <input type="date"> y el backend lo persiste como medianoche UTC del día elegido
// (p.ej. "2026-09-29T00:00:00Z"). formatShortDate/formatDateTime construyen un `Date` y lo
// formatean en la zona horaria del NAVEGADOR — correcto para un timestamp real (creadoEn,
// fechaEvento, fechaHoraEvento...), pero en una zona con offset negativo (p.ej. Perú, UTC-5)
// esa medianoche UTC cae en el día anterior en hora local, mostrando "28" cuando el usuario
// eligió "29". Los helpers de abajo leen el día/mes/año en UTC — nunca en la zona local — para
// una fecha de calendario. NUNCA usarlos con un timestamp real (ver clasificación completa en
// la capability `shared-calendar-date-format`).

export function formatCalendarDate(isoDate: string, locale = 'es-PE'): string {
  const parts = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(isoDate))

  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  const month = (parts.find((p) => p.type === 'month')?.value ?? '').replace(/\.$/, '')
  const year = parts.find((p) => p.type === 'year')?.value ?? ''

  return `${day} ${month} ${year}`
}

export function formatCalendarDateMedium(isoDate: string, locale = 'es-PE'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(isoDate))
}

// Días de calendario entre "hoy" (la fecha de calendario del navegador, en su zona local) y una
// fecha de calendario ISO — nunca la diferencia entre dos instantes. Puede dar negativo (fecha
// vencida).
export function calendarDaysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)

  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

// revision-periodica-fecha-editable: "hoy" como fecha de calendario del navegador (YYYY-MM-DD),
// para precargar sugerencias y el atributo `min` de un <input type="date"> sin construir un
// `Date` con hora (que arrastraría la zona local al comparar). El backend sigue siendo la
// fuente de verdad real del margen mínimo — calcula "hoy" en America/Lima, no en la zona del
// navegador (design.md D2) — este helper es solo para la UX de precarga/mínimo del campo.
export function todayCalendarDateIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Suma días de calendario a una fecha ISO (YYYY-MM-DD o con hora), construyendo el cálculo en
// UTC para que no se desfase por la zona local — mismo criterio que el resto de este archivo.
export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Suma meses de calendario a una fecha ISO (YYYY-MM-DD o con hora) — mismo criterio UTC.
export function addCalendarMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}
