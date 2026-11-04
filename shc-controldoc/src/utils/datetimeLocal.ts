// Un <input type="datetime-local"> siempre opera en hora LOCAL sin offset. Convertir explícitamente
// hora-local <-> UTC en el límite del formulario — nunca `.slice(0, 16)` sobre el ISO UTC, que deja
// la hora corrida por el offset local (5 h en Lima). Movidas desde IncidentForm
// (qe-precarga-incidente-responsable D9) para compartirlas con QualityEventForm.
export function toDatetimeLocalValue(isoUtc: string): string {
  const d = new Date(isoUtc)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString()
}
