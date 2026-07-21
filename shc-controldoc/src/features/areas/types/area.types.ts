export interface Area {
  id: string
  nombre: string
  activo: boolean
  creadoEn: string
  descripcion?: string
}

export interface AreaConteoBloqueo {
  qe: number
  nc: number
  incidentes: number
  total: number
}
