import { format } from 'date-fns'

export function contarDiasHabiles(desde: Date, hasta: Date, feriados: string[] = []): number {
  const feriadosSet = new Set(feriados)
  let count = 0
  const cursor = new Date(desde)
  cursor.setHours(0, 0, 0, 0)
  const fin = new Date(hasta)
  fin.setHours(0, 0, 0, 0)

  while (cursor < fin) {
    cursor.setDate(cursor.getDate() + 1)
    const dia = cursor.getDay()
    if (dia !== 0 && dia !== 6 && !feriadosSet.has(format(cursor, 'yyyy-MM-dd'))) {
      count++
    }
  }
  return count
}

export function calcularDiasHabilesRestantes(
  hoy: Date,
  fechaVencimiento: Date,
  feriados: string[] = [],
): number {
  if (fechaVencimiento >= hoy) {
    return contarDiasHabiles(hoy, fechaVencimiento, feriados)
  }
  return -contarDiasHabiles(fechaVencimiento, hoy, feriados)
}
