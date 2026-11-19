// Fechas de calendario en hora de Lima para el listado de AC (modulo-acciones-correctivas D4/D8).
// Perú no aplica horario de verano: America/Lima es UTC−5 fijo, así que el inicio de un día de
// Lima en UTC es siempre las 05:00 UTC de ese día.
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000

const fechaLimaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** `yyyy-MM-dd` del instante dado, en hora de Lima. */
export function fechaLima(instante: Date): string {
  return fechaLimaFormatter.format(instante)
}

/** Instante UTC (ms) de las 00:00 en Lima del día `yyyy-MM-dd`. */
export function inicioDiaLimaUtc(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  return Date.UTC(y, m - 1, d) + LIMA_OFFSET_MS
}

/** Primer y último día (`yyyy-MM-dd`) del mes calendario actual en Lima. */
export function rangoMesActualLima(ahora: Date = new Date()): { desde: string; hasta: string } {
  const [y, m] = fechaLima(ahora).split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { desde: `${y}-${mm}-01`, hasta: `${y}-${mm}-${String(ultimoDia).padStart(2, '0')}` }
}
