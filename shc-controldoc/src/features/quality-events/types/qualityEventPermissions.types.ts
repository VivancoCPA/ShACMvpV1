export interface QEPermissions {
  puedeEditarCabecera: boolean
  puedeEditarCausaRaiz: boolean
  puedeAvanzarEstado: boolean
  puedeCerrar: boolean
  puedeFirmarCierre: boolean
  puedeVerificar: boolean
  puedeReabrir: boolean
  soloLectura: boolean
}

export interface QEEditAccess {
  reporteInicial: boolean
  severidad: boolean
  mineral: boolean
}
